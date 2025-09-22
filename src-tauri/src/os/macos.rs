// 抑制 objc 包的已知警告，并兼容 cocoa 重导出的弃用 API
#![allow(unexpected_cfgs, deprecated)]

#[cfg(target_os = "macos")]
use tauri::{ActivationPolicy, AppHandle, Runtime, WebviewWindow};
#[cfg(target_os = "macos")]
use tauri_nspanel::WebviewWindowExt;
#[cfg(target_os = "macos")]
use tauri_nspanel::cocoa::appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior};

#[cfg(target_os = "macos")]
const NS_WINDOW_STYLE_MASK_NON_ACTIVATING_PANEL: i32 = 1 << 7;
#[cfg(target_os = "macos")]
const NS_WINDOW_STYLE_MASK_RESIZABLE: i32 = 1 << 3;

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

/// 设置 macOS 窗口的特定行为
#[cfg(target_os = "macos")]
pub fn setup_window(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // 确保窗口可以拖拽
    window.set_ignore_cursor_events(false)?;

    let panel = window
        .to_panel()
        .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;

    // 提升窗口层级，保证悬浮层不被其他窗口遮挡
    panel.set_level((NSMainMenuWindowLevel + 1) as i32);

    // 保持 panel 非激活，同时允许用户拖拽调整尺寸
    panel.set_style_mask(
        NS_WINDOW_STYLE_MASK_NON_ACTIVATING_PANEL | NS_WINDOW_STYLE_MASK_RESIZABLE,
    );

    // 允许桌宠在所有空间、全屏模式下显示，并规避 Cmd+Tab 循环
    panel.set_collection_behaviour(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle,
    );

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
