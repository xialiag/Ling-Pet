// 使用 NSPanel 作为主窗口：悬浮、跨桌面、可交互
#![allow(unexpected_cfgs, deprecated)]

#[cfg(target_os = "macos")]
use tauri::{ActivationPolicy, AppHandle, Manager, Runtime, WebviewWindow};

// 引入 tauri-nspanel：面板宏、行为与等级、样式掩码、窗口扩展
#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt,
};

// 定义桌宠专用 Panel 类型：可成为 Key、悬浮但仅在需要时获取键盘
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(PetPanel {
        config: {
            // 允许在需要时成为 key window（便于交互）
            can_become_key_window: true,
            // 避免成为主窗口（保持轻量 / 不抢占 App 主窗口语义）
            can_become_main_window: false,
            // 只有必要时才成为 key，减少对前台 App 干扰
            becomes_key_only_if_needed: true,
            // 标记为浮动面板（配合 Level 一起保证悬浮）
            is_floating_panel: true
        }
    })
}

/// 设置 macOS 应用的全局配置
#[cfg(target_os = "macos")]
pub fn setup_app<R: Runtime>(app: &AppHandle<R>) {
    if let Err(error) = app.set_activation_policy(ActivationPolicy::Regular) {
        log::warn!("设置 macOS 激活策略失败: {error}");
    }

    if let Err(error) = app.set_dock_visibility(false) {
        log::warn!("隐藏 Dock 图标失败: {error}");
    }

    request_screen_recording_permission();
}

/// 设置 macOS 窗口的特定行为（转为 NSPanel 并配置悬浮/跨桌面/交互）
#[cfg(target_os = "macos")]
pub fn setup_window(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // 确保窗口本身不忽略光标事件（允许点击/拖拽）
    window.set_ignore_cursor_events(false)?;

    // 将 Tauri 窗口转换为自定义 NSPanel，并注册到插件管理器（便于后续按 label 获取）
    let panel = window
        .to_panel::<PetPanel>()
        .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;

    // 设置窗口层级：浮动级，保证悬浮于普通窗口之上
    panel.set_level(PanelLevel::Floating.value());

    // 设置样式：非激活面板（点击不抢占前台 App 焦点），其余外观由 tauri.conf.json 控制
    panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());

    // 设置集合行为：跨所有空间、在全屏下作为辅助窗口、固定不随工作区切换、避开 Cmd+Tab 循环
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .can_join_all_spaces()
            .full_screen_auxiliary()
            .stationary()
            .ignores_cycle()
            .into(),
    );

    // 设置交互偏好：追踪鼠标、允许交互、可通过窗口背景拖动
    panel.set_accepts_mouse_moved_events(true);
    panel.set_ignores_mouse_events(false);
    panel.set_movable_by_window_background(true);
    panel.set_works_when_modal(true);
    panel.set_hides_on_deactivate(false);

    Ok(())
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    unsafe fn CGPreflightScreenCaptureAccess() -> bool;
    unsafe fn CGRequestScreenCaptureAccess();
}

#[cfg(target_os = "macos")]
pub fn request_screen_recording_permission() {
    unsafe {
        if !CGPreflightScreenCaptureAccess() {
            CGRequestScreenCaptureAccess();
            // 可在这里弹个对话框提示用户去 系统设置 → 隐私与安全性 → 屏幕录制 勾选你的 App，
            // 并重启 App 生效。
        }
    }
}

/// 在非 macOS 平台上的空实现
#[cfg(not(target_os = "macos"))]
pub fn setup_app<R: Runtime>(_app: &AppHandle<R>) {
    // 在非 macOS 平台上什么都不做
}

/// 在非 macOS 平台上的空实现
#[cfg(not(target_os = "macos"))]
pub fn setup_window(_window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // 在非 macOS 平台上什么都不做
    Ok(())
}

/// 检测当前是否运行在 macOS 上
pub fn is_macos() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_macos() {
        // 这个测试会根据编译目标平台返回不同结果
        let result = is_macos();
        #[cfg(target_os = "macos")]
        assert_eq!(result, true);
        #[cfg(not(target_os = "macos"))]
        assert_eq!(result, false);
    }
}
