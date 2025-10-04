use crate::commands::quit_app_with_handle;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

const MENU_ID_SETTINGS: &str = "open-settings";
const MENU_ID_CHAT_HISTORY: &str = "open-chat-history";
const MENU_ID_TOGGLE_MAIN: &str = "toggle-main";
const MENU_ID_TOGGLE_DEVTOOLS: &str = "toggle-devtools";
const MENU_ID_QUIT_APP: &str = "quit-app";
const MENU_ID_TEST_NOTIFICATION: &str = "test-notification";
const EVENT_TOGGLE_DEVTOOLS: &str = "lingpet://toggle-devtools";

#[derive(Clone, Copy)]
enum WindowKind {
    Settings,
    ChatHistory,
}

impl WindowKind {
    fn label(self) -> &'static str {
        match self {
            Self::Settings => "settings",
            Self::ChatHistory => "chat-history",
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::Settings => "设置",
            Self::ChatHistory => "聊天记录",
        }
    }

    fn url(self) -> &'static str {
        match self {
            Self::Settings => "/#/settings",
            Self::ChatHistory => "/#/chat-history",
        }
    }

    fn size(self) -> (f64, f64) {
        match self {
            Self::Settings => (800.0, 600.0),
            Self::ChatHistory => (600.0, 700.0),
        }
    }

    fn resizable(self) -> bool {
        matches!(self, Self::Settings) || matches!(self, Self::ChatHistory)
    }
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .item(&MenuItem::with_id(
            app,
            MENU_ID_SETTINGS,
            "打开设置",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            MENU_ID_CHAT_HISTORY,
            "查看聊天记录",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            MENU_ID_TOGGLE_MAIN,
            "显示/隐藏主窗口",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            MENU_ID_TOGGLE_DEVTOOLS,
            "切换开发者工具",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            MENU_ID_TEST_NOTIFICATION,
            "测试通知",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            MENU_ID_QUIT_APP,
            "退出应用",
            true,
            None::<&str>,
        )?)
        .build()?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("LingPet")
        .icon(load_tray_icon()?)
        .on_menu_event(|handle, event| match event.id.as_ref() {
            MENU_ID_SETTINGS => {
                if let Err(error) = toggle_window(handle, WindowKind::Settings) {
                    log::error!("切换设置窗口失败: {error}");
                }
            }
            MENU_ID_CHAT_HISTORY => {
                if let Err(error) = toggle_window(handle, WindowKind::ChatHistory) {
                    log::error!("切换聊天记录窗口失败: {error}");
                }
            }
            MENU_ID_TOGGLE_MAIN => {
                if let Err(error) = toggle_main_window(handle) {
                    log::error!("切换主窗口显示失败: {error}");
                }
            }
            MENU_ID_TOGGLE_DEVTOOLS => {
                if let Err(error) = handle.emit(EVENT_TOGGLE_DEVTOOLS, ()) {
                    log::error!("广播开发者工具切换事件失败: {error}");
                }
            }
            MENU_ID_TEST_NOTIFICATION => {
                // 在菜单中触发一次示例通知，便于快速验证
                let payload = crate::notification::NotificationPayload {
                    title: "来自菜单的提示".into(),
                    message: "这是一条用于测试的通知横幅。".into(),
                    duration_ms: 30000,
                    icon: None,
                };
                if let Err(error) =
                    crate::notification::show_notification_with_handle(handle, payload)
                {
                    log::error!("触发测试通知失败: {error}");
                }
            }
            MENU_ID_QUIT_APP => {
                if let Err(error) = quit_app_with_handle(handle) {
                    log::error!("退出应用失败: {error}");
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn toggle_window(app: &AppHandle, kind: WindowKind) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(kind.label()) {
        window.close()?;
        return Ok(());
    }

    let (width, height) = kind.size();
    let builder = WebviewWindowBuilder::new(app, kind.label(), WebviewUrl::App(kind.url().into()))
        .title(kind.title())
        .inner_size(width, height)
        .resizable(kind.resizable())
        .visible(false);

    let window = builder.build()?;
    window.center().ok();
    window.show()?;
    window.set_focus()?;

    Ok(())
}

fn toggle_main_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(main_window) = app.get_webview_window("main") {
        if main_window.is_visible()? {
            main_window.hide()?;
        } else {
            main_window.show()?;
            main_window.set_focus()?;
        }
    }

    Ok(())
}

fn load_tray_icon() -> tauri::Result<Image<'static>> {
    let icon_bytes = include_bytes!("../icons/icon.png");
    Image::from_bytes(icon_bytes).map_err(Into::into)
}
