/**
 * 插件配置管理
 */

use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone)]
pub struct PluginConfigManager {
    config_dir: PathBuf,
}

impl PluginConfigManager {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let config_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("plugins");

        // 确保目录存在
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

        Ok(Self { config_dir })
    }

    fn get_plugin_config_path(&self, plugin_name: &str) -> PathBuf {
        self.config_dir.join(format!("{}.json", plugin_name))
    }

    pub fn get_config(&self, plugin_name: &str, key: &str) -> Result<Option<Value>, String> {
        let config_path = self.get_plugin_config_path(plugin_name);

        if !config_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;

        let config: HashMap<String, Value> =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;

        Ok(config.get(key).cloned())
    }

    pub fn set_config(&self, plugin_name: &str, key: &str, value: Value) -> Result<(), String> {
        let config_path = self.get_plugin_config_path(plugin_name);

        // 读取现有配置
        let mut config: HashMap<String, Value> = if config_path.exists() {
            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        // 更新配置
        config.insert(key.to_string(), value);

        // 保存配置
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(&config_path, content).map_err(|e| e.to_string())?;

        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_plugin_enabled(&self, plugin_name: &str) -> Result<bool, String> {
        match self.get_config(plugin_name, "enabled")? {
            Some(Value::Bool(enabled)) => Ok(enabled),
            _ => Ok(true), // 默认启用
        }
    }

    pub fn set_plugin_enabled(&self, plugin_name: &str, enabled: bool) -> Result<(), String> {
        self.set_config(plugin_name, "enabled", Value::Bool(enabled))
    }
}

#[tauri::command]
pub fn get_plugin_config(
    app: AppHandle,
    plugin_name: String,
    key: String,
) -> Result<Option<Value>, String> {
    let manager = PluginConfigManager::new(&app)?;
    manager.get_config(&plugin_name, &key)
}

#[tauri::command]
pub fn set_plugin_config(
    app: AppHandle,
    plugin_name: String,
    key: String,
    value: String,
) -> Result<(), String> {
    let manager = PluginConfigManager::new(&app)?;
    let parsed_value: Value = serde_json::from_str(&value).map_err(|e| e.to_string())?;
    manager.set_config(&plugin_name, &key, parsed_value)
}

#[tauri::command]
pub fn set_plugin_enabled(
    app: AppHandle,
    plugin_name: String,
    enabled: bool,
) -> Result<(), String> {
    let manager = PluginConfigManager::new(&app)?;
    manager.set_plugin_enabled(&plugin_name, enabled)
}

#[tauri::command]
pub fn open_plugin_folder(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    
    let plugin_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");

    // 确保目录存在
    fs::create_dir_all(&plugin_dir).map_err(|e| e.to_string())?;

    // 打开目录
    let path_str = plugin_dir.to_string_lossy().to_string();
    app.opener()
        .open_path(path_str, None::<&str>)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 检查路径是否存在（通用插件API）
#[tauri::command]
pub fn plugin_check_path(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

/// 获取平台信息
#[tauri::command]
pub fn plugin_get_platform() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

/// 加载Rust插件动态库
#[tauri::command]
pub fn plugin_load_rust_library(
    plugin_name: String,
    lib_path: String,
) -> Result<(), String> {
    use std::path::Path;
    
    let path = Path::new(&lib_path);
    if !path.exists() {
        return Err(format!("插件库文件不存在: {}", lib_path));
    }
    
    // 这里可以使用libloading或dlopen来加载动态库
    // 简化实现：只检查文件是否存在
    println!("加载插件: {} from {}", plugin_name, lib_path);
    
    Ok(())
}

/// 卸载Rust插件动态库
#[tauri::command]
pub fn plugin_unload_rust_library(plugin_name: String) -> Result<(), String> {
    println!("卸载插件: {}", plugin_name);
    Ok(())
}
