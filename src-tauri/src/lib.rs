// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

mod commands;
mod notification;
mod os;
mod plugin_config;
mod plugin_manager;
mod plugin_backend_manager;
mod sbv2_manager;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod system_tray;
use commands::*;
use plugin_config::*;
use plugin_manager::*;
use plugin_backend_manager::*;
use sbv2_manager::Sbv2Manager;

// 只在 macOS 平台上引入 tauri_nspanel
#[cfg(target_os = "macos")]
use tauri_nspanel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .manage(Sbv2Manager::new())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin({
            use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};
            WindowStateBuilder::new()
                // 中文注释：不追踪可见性，避免插件在恢复时强制显示窗口
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::DECORATIONS
                        | StateFlags::FULLSCREEN,
                )
                // 中文注释：完全排除通知窗口，防止被插件管理
                .with_denylist(&["notification"])
                .build()
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pinia::init())
        .plugin(tauri_plugin_screenshots::init())
        .plugin(tauri_plugin_shell::init());

    // 只在 macOS 平台上添加 tauri_nspanel 插件
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            quit_app,
            open_data_folder,
            sbv2_start,
            sbv2_stop,
            sbv2_status,
            notification::show_notification,
            notification::hide_notification,
            get_plugin_config,
            set_plugin_config,
            set_plugin_enabled,
            remove_plugin_config,
            open_plugin_folder,
            plugin_check_path,
            plugin_get_platform,
            plugin_load_rust_library,
            plugin_unload_rust_library,
            plugin_install,
            plugin_load_backend,
            plugin_unload_backend,
            plugin_remove_config,
            plugin_open_directory,
            plugin_call_backend,
            plugin_get_commands,
            plugin_backend_status,
            // 新的后端管理命令
            // 新的后端管理命令
            load_plugin_backend,
            unload_plugin_backend,
            call_plugin_backend,
            get_backend_metrics,
            get_all_backend_metrics,
            check_backend_health,
            restart_plugin_backend,
            subscribe_plugin_logs,
            commands::http_request,
            commands::read_binary_file,
            commands::remove_dir_all
        ])
        .setup(|app| {
            // 初始化插件后端日志系统
            plugin_backend_manager::init_logging_system();
            
            let main_window = app.get_webview_window("main").unwrap();
            // 设置平台特定配置
            if os::macos::is_macos() {
                os::macos::setup_app(&app.handle());
                os::macos::setup_window(&main_window).expect("设置macOS窗口配置时出错");
            }

            if os::windows::is_windows() {
                os::windows::setup_app();
                os::windows::setup_window(&main_window).expect("设置Windows窗口配置时出错");
            }

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            system_tray::setup(&app.handle())
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;

            // 中文注释：初始化通知窗口（隐藏且已定位），避免首次通知时再构建
            notification::init(app.handle()).ok();

            // 初始化增强的插件后端系统
            plugin_backend_manager::initialize_logging_system(app.handle().clone());
            plugin_backend_manager::start_metrics_monitoring();

            // 显式隐藏 settings 窗口（保险做法）
            // if let Some(settings_window) = app.get_webview_window("settings") {
            //     settings_window.hide().ok();
            // }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
