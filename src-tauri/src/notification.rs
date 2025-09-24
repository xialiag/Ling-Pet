// 该模块负责管理通知横幅窗口；macOS 使用 NSPanel（通过 tauri-nspanel 插件），Windows 预留空位
// 精简目标：启动时创建隐藏窗口，通知时仅发送事件并显示；移除繁琐的 ensure/ready 队列
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    LogicalPosition, LogicalSize, Position, Size,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;

// macOS: 引入 tauri-nspanel 插件 API（在 Cargo.toml 里仅对 macOS 启用依赖）
#[cfg(target_os = "macos")]
use tauri_nspanel::{tauri_panel, CollectionBehavior, PanelLevel, StyleMask};

// 该结构体定义通知所需的负载字段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPayload {
    // 通知标题
    pub title: String,
    // 通知正文
    pub message: String,
    // 展示时长（毫秒）
    pub duration_ms: u64,
    // 可选图标（目前未在页面中使用，预留）
    pub icon: Option<String>,
}

// 该常量用于标识通知窗口的 label
const NOTIFICATION_LABEL: &str = "notification";

// 初始化：在应用启动时创建通知窗口（隐藏），并完成平台配置与定位
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    // 若已存在则不重复创建
    if app.get_webview_window(NOTIFICATION_LABEL).is_some() {
        return Ok(());
    }

    let w = WebviewWindowBuilder::new(
        app,
        NOTIFICATION_LABEL,
        WebviewUrl::App("/#/notification".into()),
    )
    .title("通知")
    .visible(false)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .inner_size(360.0, 120.0)
    .build()?;

    // 平台特定行为
    #[cfg(target_os = "macos")]
    configure_macos_notification_panel(&w);
    #[cfg(target_os = "windows")]
    configure_windows_notification(&w);

    // 放置到右上角
    position_top_right(app, &w)?;
    Ok(())
}

// 该函数将通知窗口定位到主屏幕右上角
fn position_top_right(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    // 固定尺寸与边距，可后续按内容自适应
    let width = 360.0f64;
    let height = 120.0f64;
    let margin = 20.0f64;
    window.set_size(Size::Logical(LogicalSize::new(width, height)))?;

    if let Some(monitor) = app.primary_monitor()? {
        let scale = monitor.scale_factor();
        let size = monitor.size(); // 物理像素
        let logical = size.to_logical::<f64>(scale);
        let x = logical.width - width - margin;
        let y = margin;
        window.set_position(Position::Logical(LogicalPosition::new(x.max(0.0), y.max(0.0))))?;
    }

    Ok(())
}

// macOS: 定义通知专用 Panel 类（非激活、浮动、仅必要时成为 key）
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(NotificationPanel {
        config: {
            // 通知不主动成为 key，避免打断前台应用
            can_become_key_window: false,
            // 通知不作为主窗口
            can_become_main_window: false,
            // 浮动面板
            is_floating_panel: true,
            // 仅必要时成为 key（此处仍为 false，保持一致行为）
            becomes_key_only_if_needed: true
        }
    })
}

// macOS: 使用 Panel 插件配置通知窗口的 NSPanel 行为
// macOS: PanelBuilder 已直接完成配置，这里不再需要额外处理（保留占位避免误删导出符号）
#[cfg(target_os = "macos")]
fn configure_macos_notification_panel(window: &WebviewWindow) {
    use tauri_nspanel::WebviewWindowExt;
    if let Ok(panel) = window.to_panel::<NotificationPanel>() {
        panel.set_level(PanelLevel::Status.value());
        panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());
        panel.set_collection_behavior(
            CollectionBehavior::new()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .stationary()
                .ignores_cycle()
                .into(),
        );
        panel.set_works_when_modal(true);
        panel.set_hides_on_deactivate(false);
        panel.set_accepts_mouse_moved_events(false);
        panel.set_ignores_mouse_events(false);
    }
}

// Windows: 预留占位实现（后续可改为无边、顶层、穿透等行为）
#[cfg(target_os = "windows")]
fn configure_windows_notification(window: &WebviewWindow) {
    // 置顶以模拟通知的浮动效果；其余高级行为留待后续补充
    let _ = window.set_always_on_top(true);
}

// 该函数对外暴露：显示通知（供系统托盘与命令调用）
pub fn show_notification_with_handle(app: &AppHandle, payload: NotificationPayload) -> tauri::Result<()> {
    // 简化：假设启动时已创建窗口；若未创建（异常场景），则即时创建一次
    if app.get_webview_window(NOTIFICATION_LABEL).is_none() {
        let _ = init(app);
    }
    let window = app
        .get_webview_window(NOTIFICATION_LABEL)
        .expect("notification window must exist after init");

    // 每次展示时尝试重新定位，避免显示器变化导致错位
    let _ = position_top_right(app, &window);

    // 发事件后显示窗口
    window.emit("notification://show", &payload)?;
    window.show()?;

    // 安排自动隐藏任务
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(payload.duration_ms));
        let _ = hide_notification_with_handle(&app_handle);
    });

    Ok(())
}

// 该函数对外暴露：隐藏通知（供系统托盘与命令调用）
pub fn hide_notification_with_handle(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(NOTIFICATION_LABEL) {
        let _ = window.emit("notification://hide", ());
        // 延迟隐藏，等待前端过渡动画结束
        let w2 = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(260));
            let _ = w2.hide();
        });
    }
    Ok(())
}

// 该命令供前端调用：显示通知
#[tauri::command]
pub async fn show_notification(app: AppHandle, payload: NotificationPayload) -> Result<(), String> {
    log::info!("show_notification called with payload: {:?}", payload);
    show_notification_with_handle(&app, payload).map_err(|e| e.to_string())
}

// 该命令供前端调用：隐藏通知
#[tauri::command]
pub async fn hide_notification(app: AppHandle) -> Result<(), String> {
    hide_notification_with_handle(&app).map_err(|e| e.to_string())
}
