// 插件管理器 - Rust后端
// 处理插件的安装、编译、动态加载

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::path::PathBuf;
use std::sync::Mutex;
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

// 插件命令定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
}

// C接口的命令信息结构
#[repr(C)]
pub struct PluginCommandInfo {
    pub name: *const i8,
    pub description: *const i8,
}

// 插件函数调用结果
#[derive(Debug, Serialize, Deserialize)]
pub struct PluginCallResult {
    pub success: bool,
    pub result: Option<String>,
    pub error: Option<String>,
}

// 动态库管理
#[allow(dead_code)]
struct DynamicLibrary {
    lib: libloading::Library,
    commands: Vec<PluginCommand>,
    plugin_id: String,
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
    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;

    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    // 读取manifest获取插件ID
    let manifest_content = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| "manifest.json not found in zip".to_string())?;

        let mut content = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        content
    };

    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest.json: {}", e))?;

    let plugin_id = manifest["id"]
        .as_str()
        .ok_or("Plugin ID not found in manifest")?
        .to_string();

    // 创建插件目录（将 / 替换为 - 以避免路径问题）
    let safe_plugin_id = plugin_id.replace("/", "-").replace("@", "");
    let plugin_dir = PathBuf::from(&target_dir).join(&safe_plugin_id);
    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to create plugin directory: {}", e))?;

    // 解压所有文件
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
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

            let mut outfile =
                File::create(&outpath).map_err(|e| format!("Failed to create file: {}", e))?;

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
            let mut commands = Vec::new();

            // 调用插件初始化函数（如果有）
            if let Ok(init_fn) = unsafe { lib.get::<unsafe extern "C" fn()>(b"plugin_init") } {
                unsafe { init_fn() };
            }

            // 尝试获取插件提供的命令列表
            if let Ok(get_commands_fn) = unsafe {
                lib.get::<unsafe extern "C" fn() -> *const PluginCommandInfo>(
                    b"plugin_get_commands",
                )
            } {
                unsafe {
                    let commands_ptr = get_commands_fn();
                    if !commands_ptr.is_null() {
                        // 读取命令列表（假设以null结尾）
                        let mut i = 0;
                        loop {
                            let cmd_ptr = commands_ptr.add(i);
                            if (*cmd_ptr).name.is_null() {
                                break;
                            }

                            let name = std::ffi::CStr::from_ptr((*cmd_ptr).name)
                                .to_string_lossy()
                                .to_string();
                            let description = std::ffi::CStr::from_ptr((*cmd_ptr).description)
                                .to_string_lossy()
                                .to_string();

                            commands.push(PluginCommand { name, description });
                            i += 1;
                        }
                    }
                }
            }

            // 存储动态库引用
            let mut libs = LOADED_LIBRARIES.lock().unwrap();
            libs.insert(
                plugin_id.clone(),
                DynamicLibrary {
                    lib,
                    commands,
                    plugin_id: plugin_id.clone(),
                },
            );

            println!(
                "[Rust] Backend loaded for plugin: {} with {} commands",
                plugin_id,
                libs.get(&plugin_id).unwrap().commands.len()
            );

            Ok(PluginCompileResult {
                success: true,
                error: None,
            })
        }
        Err(e) => Ok(PluginCompileResult {
            success: false,
            error: Some(format!("Failed to load library: {}", e)),
        }),
    }
}

/// 卸载插件的动态库
#[command]
pub async fn plugin_unload_backend(plugin_id: String) -> Result<(), String> {
    println!("[Rust] Unloading backend for plugin: {}", plugin_id);

    let mut libs = LOADED_LIBRARIES.lock().unwrap();
    libs.remove(&plugin_id);

    Ok(())
}

/// 删除插件配置
#[command]
pub async fn plugin_remove_config(_plugin_id: String) -> Result<(), String> {
    // TODO: 删除插件的配置文件
    Ok(())
}

/// 打开插件目录
#[command]
pub async fn plugin_open_directory(plugin_path: String) -> Result<(), String> {
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

/// 调用插件后端函数
#[command]
pub async fn plugin_call_backend(
    plugin_id: String,
    function_name: String,
    args: String,
) -> Result<PluginCallResult, String> {
    println!(
        "[Rust] Calling plugin backend: {}::{}",
        plugin_id, function_name
    );

    let libs = LOADED_LIBRARIES.lock().unwrap();
    let lib = libs
        .get(&plugin_id)
        .ok_or_else(|| format!("Plugin {} not loaded", plugin_id))?;

    // 构造函数名（插件函数通常有特定的命名约定）
    let full_function_name = format!("plugin_{}", function_name);

    // 尝试调用插件函数
    match unsafe {
        lib.lib
            .get::<unsafe extern "C" fn(*const i8) -> *mut i8>(full_function_name.as_bytes())
    } {
        Ok(func) => {
            let args_cstring =
                CString::new(args).map_err(|e| format!("Invalid args string: {}", e))?;

            unsafe {
                let result_ptr = func(args_cstring.as_ptr());
                if result_ptr.is_null() {
                    Ok(PluginCallResult {
                        success: false,
                        result: None,
                        error: Some("Function returned null".to_string()),
                    })
                } else {
                    let result_cstr = CStr::from_ptr(result_ptr);
                    let result_string = result_cstr.to_string_lossy().to_string();

                    // 释放插件分配的内存（如果插件提供了释放函数）
                    if let Ok(free_fn) = lib
                        .lib
                        .get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string")
                    {
                        free_fn(result_ptr);
                    }

                    Ok(PluginCallResult {
                        success: true,
                        result: Some(result_string),
                        error: None,
                    })
                }
            }
        }
        Err(e) => Ok(PluginCallResult {
            success: false,
            result: None,
            error: Some(format!("Function {} not found: {}", full_function_name, e)),
        }),
    }
}

/// 获取插件提供的命令列表
#[command]
pub async fn plugin_get_commands(plugin_id: String) -> Result<Vec<PluginCommand>, String> {
    let libs = LOADED_LIBRARIES.lock().unwrap();
    let lib = libs
        .get(&plugin_id)
        .ok_or_else(|| format!("Plugin {} not loaded", plugin_id))?;

    Ok(lib.commands.clone())
}

/// 获取插件后端状态
#[command]
pub async fn plugin_backend_status(plugin_id: String) -> Result<bool, String> {
    let libs = LOADED_LIBRARIES.lock().unwrap();
    let lib = libs.get(&plugin_id);

    if let Some(_lib) = lib {
        // 尝试调用健康检查函数
        match unsafe {
            _lib.lib
                .get::<unsafe extern "C" fn() -> bool>(b"plugin_health_check")
        } {
            Ok(health_fn) => {
                let is_healthy = unsafe { health_fn() };
                Ok(is_healthy)
            }
            Err(_) => {
                // 如果没有健康检查函数，认为插件是健康的
                Ok(true)
            }
        }
    } else {
        Ok(false)
    }
}
