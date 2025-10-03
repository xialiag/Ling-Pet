// 插件管理器 - Rust后端
// 处理插件的安装、编译、动态加载

use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResult {
    pub success: bool,
    pub plugin_id: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginCompileResult {
    pub success: bool,
    pub error: Option<String>,
}

// 动态库管理
#[allow(dead_code)]
struct DynamicLibrary {
    lib: libloading::Library,
    commands: Vec<String>,
}

lazy_static::lazy_static! {
    static ref LOADED_LIBRARIES: Mutex<HashMap<String, DynamicLibrary>> = Mutex::new(HashMap::new());
}

/// 安装插件（解压zip）
#[command]
pub async fn plugin_install(
    zip_path: String,
    target_dir: String,
) -> Result<PluginInstallResult, String> {
    use std::fs::File;
    use zip::ZipArchive;
    
    println!("[Rust] Installing plugin from: {}", zip_path);
    
    // 打开zip文件
    let file = File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip: {}", e))?;
    
    // 读取manifest获取插件ID
    let manifest_content = {
        let mut manifest_file = archive.by_name("manifest.json")
            .map_err(|_| "manifest.json not found in zip".to_string())?;
        
        let mut content = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        content
    };
    
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest.json: {}", e))?;
    
    let plugin_id = manifest["id"].as_str()
        .ok_or("Plugin ID not found in manifest")?
        .to_string();
    
    // 创建插件目录（将 / 替换为 - 以避免路径问题）
    let safe_plugin_id = plugin_id.replace("/", "-").replace("@", "");
    let plugin_dir = PathBuf::from(&target_dir).join(&safe_plugin_id);
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to create plugin directory: {}", e))?;
    
    // 解压所有文件
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file from zip: {}", e))?;
        
        let outpath = plugin_dir.join(file.name());
        
        if file.is_dir() {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }
    
    println!("[Rust] Plugin {} installed to {:?}", plugin_id, plugin_dir);
    
    Ok(PluginInstallResult {
        success: true,
        plugin_id,
        error: None,
    })
}

/// 加载插件的动态库（预编译的）
#[command]
pub async fn plugin_load_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<PluginCompileResult, String> {
    println!("[Rust] Loading backend for plugin: {}", plugin_id);
    println!("[Rust] Backend path: {}", backend_path);
    
    let lib_path = PathBuf::from(&backend_path);
    
    if !lib_path.exists() {
        return Ok(PluginCompileResult {
            success: false,
            error: Some(format!("Dynamic library not found: {}", backend_path)),
        });
    }
    
    // 加载动态库
    match unsafe { libloading::Library::new(&lib_path) } {
        Ok(lib) => {
            // 调用插件初始化函数（如果有）
            if let Ok(init_fn) = unsafe { lib.get::<unsafe extern "C" fn()>(b"plugin_init") } {
                unsafe { init_fn() };
            }
            
            // 存储动态库引用
            let mut libs = LOADED_LIBRARIES.lock().unwrap();
            libs.insert(plugin_id.clone(), DynamicLibrary {
                lib,
                commands: vec![],
            });
            
            println!("[Rust] Backend loaded for plugin: {}", plugin_id);
            
            Ok(PluginCompileResult {
                success: true,
                error: None,
            })
        }
        Err(e) => {
            Ok(PluginCompileResult {
                success: false,
                error: Some(format!("Failed to load library: {}", e)),
            })
        }
    }
}

/// 卸载插件的动态库
#[command]
pub async fn plugin_unload_backend(
    plugin_id: String,
) -> Result<(), String> {
    println!("[Rust] Unloading backend for plugin: {}", plugin_id);
    
    let mut libs = LOADED_LIBRARIES.lock().unwrap();
    libs.remove(&plugin_id);
    
    Ok(())
}

/// 删除插件配置
#[command]
pub async fn plugin_remove_config(
    _plugin_id: String,
) -> Result<(), String> {
    // TODO: 删除插件的配置文件
    Ok(())
}

/// 打开插件目录
#[command]
pub async fn plugin_open_directory(
    plugin_path: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&plugin_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&plugin_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&plugin_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    Ok(())
}


