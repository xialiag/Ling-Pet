// 增强的插件后端管理器
// 支持实时日志、热重载、安全卸载

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Manager};
use tokio::sync::broadcast;
use tokio::time::interval;

// ========== 数据结构定义 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLogEntry {
    pub timestamp: u64,
    pub plugin_id: String,
    pub level: String,
    pub message: String,
    pub source: String, // "backend" | "frontend"
    pub function_name: Option<String>,
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginBackendMetrics {
    pub plugin_id: String,
    pub memory_usage: u64,
    pub cpu_time_ms: u64,
    pub function_calls: HashMap<String, u64>,
    pub last_error: Option<String>,
    pub uptime_ms: u64,
    pub status: String, // "running" | "stopped" | "error" | "reloading"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginBackendState {
    pub plugin_id: String,
    pub state_data: String, // JSON序列化的状态数据
    pub version: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotReloadResult {
    pub success: bool,
    pub plugin_id: String,
    pub old_version: Option<String>,
    pub new_version: Option<String>,
    pub reload_time_ms: u64,
    pub error: Option<String>,
}

// ========== 增强的动态库管理 ==========

#[allow(dead_code)]
struct EnhancedDynamicLibrary {
    lib: libloading::Library,
    plugin_id: String,
    commands: Vec<PluginCommand>,
    load_time: Instant,
    metrics: Arc<Mutex<PluginBackendMetrics>>,
    state: Arc<RwLock<Option<String>>>, // 保存的状态
    log_sender: broadcast::Sender<PluginLogEntry>,
    version: String,
    lib_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
}

// 全局状态管理
lazy_static::lazy_static! {
    static ref ENHANCED_LIBRARIES: Arc<Mutex<HashMap<String, EnhancedDynamicLibrary>>> = 
        Arc::new(Mutex::new(HashMap::new()));
    
    static ref GLOBAL_LOG_SENDER: Arc<Mutex<Option<broadcast::Sender<PluginLogEntry>>>> = 
        Arc::new(Mutex::new(None));
    
    static ref PLUGIN_METRICS: Arc<Mutex<HashMap<String, PluginBackendMetrics>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

// ========== 实时日志系统 ==========

/// 初始化日志系统
pub fn initialize_logging_system(app_handle: AppHandle) {
    let (sender, _receiver) = broadcast::channel(1000);
    
    // 保存全局日志发送器
    {
        let mut global_sender = GLOBAL_LOG_SENDER.lock().unwrap();
        *global_sender = Some(sender.clone());
    }
    
    // 启动日志转发任务
    tokio::spawn(async move {
        let mut receiver = sender.subscribe();
        
        while let Ok(log_entry) = receiver.recv().await {
            // 转发日志到前端
            if let Err(e) = app_handle.emit_all("plugin:log", &log_entry) {
                eprintln!("[LogSystem] Failed to emit log: {}", e);
            }
        }
    });
    
    println!("[PluginBackend] Logging system initialized");
}

/// 记录插件日志
pub fn log_plugin_message(
    plugin_id: &str,
    level: &str,
    message: &str,
    function_name: Option<&str>,
) {
    let log_entry = PluginLogEntry {
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        plugin_id: plugin_id.to_string(),
        level: level.to_string(),
        message: message.to_string(),
        source: "backend".to_string(),
        function_name: function_name.map(|s| s.to_string()),
        thread_id: Some(format!("{:?}", std::thread::current().id())),
    };
    
    // 发送到日志系统
    if let Some(sender) = GLOBAL_LOG_SENDER.lock().unwrap().as_ref() {
        if let Err(e) = sender.send(log_entry.clone()) {
            eprintln!("[LogSystem] Failed to send log: {}", e);
        }
    }
    
    // 同时输出到控制台
    println!("[{}] [{}] {}", plugin_id, level.to_uppercase(), message);
}

// ========== 性能监控系统 ==========

/// 启动性能监控
pub fn start_metrics_monitoring() {
    tokio::spawn(async {
        let mut interval = interval(Duration::from_secs(5)); // 每5秒更新一次
        
        loop {
            interval.tick().await;
            update_all_metrics().await;
        }
    });
    
    println!("[PluginBackend] Metrics monitoring started");
}

/// 更新所有插件的性能指标
async fn update_all_metrics() {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    for (plugin_id, lib) in libs.iter() {
        // 更新指标
        if let Ok(mut metrics) = lib.metrics.lock() {
            metrics.uptime_ms = lib.load_time.elapsed().as_millis() as u64;
            
            // 尝试从插件获取指标
            if let Ok(plugin_metrics) = get_plugin_metrics_from_backend(plugin_id, &lib.lib) {
                metrics.memory_usage = plugin_metrics.memory_usage;
                metrics.cpu_time_ms = plugin_metrics.cpu_time_ms;
                // 合并函数调用统计
                for (func, count) in plugin_metrics.function_calls {
                    *metrics.function_calls.entry(func).or_insert(0) += count;
                }
            }
        }
    }
}

/// 从插件后端获取指标
fn get_plugin_metrics_from_backend(
    plugin_id: &str,
    lib: &libloading::Library,
) -> Result<PluginBackendMetrics, String> {
    // 尝试调用插件的指标函数
    match unsafe { lib.get::<unsafe extern "C" fn() -> *mut i8>(b"plugin_get_metrics") } {
        Ok(get_metrics_fn) => {
            unsafe {
                let metrics_ptr = get_metrics_fn();
                if metrics_ptr.is_null() {
                    return Err("Plugin returned null metrics".to_string());
                }
                
                let metrics_cstr = CStr::from_ptr(metrics_ptr);
                let metrics_json = metrics_cstr.to_string_lossy();
                
                // 释放插件分配的内存
                if let Ok(free_fn) = lib.get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string") {
                    free_fn(metrics_ptr);
                }
                
                // 解析JSON
                match serde_json::from_str::<PluginBackendMetrics>(&metrics_json) {
                    Ok(metrics) => Ok(metrics),
                    Err(e) => Err(format!("Failed to parse metrics JSON: {}", e)),
                }
            }
        }
        Err(_) => {
            // 插件没有提供指标函数，返回默认指标
            Ok(PluginBackendMetrics {
                plugin_id: plugin_id.to_string(),
                memory_usage: 0,
                cpu_time_ms: 0,
                function_calls: HashMap::new(),
                last_error: None,
                uptime_ms: 0,
                status: "running".to_string(),
            })
        }
    }
}

// ========== 热重载支持 ==========

/// 热重载插件后端
#[command]
pub async fn plugin_hot_reload_backend(
    plugin_id: String,
    new_backend_path: String,
) -> Result<HotReloadResult, String> {
    let start_time = Instant::now();
    
    log_plugin_message(&plugin_id, "info", "Starting hot reload", Some("hot_reload"));
    
    // 1. 检查新的动态库是否存在
    let new_lib_path = PathBuf::from(&new_backend_path);
    if !new_lib_path.exists() {
        return Ok(HotReloadResult {
            success: false,
            plugin_id,
            old_version: None,
            new_version: None,
            reload_time_ms: start_time.elapsed().as_millis() as u64,
            error: Some(format!("New backend library not found: {}", new_backend_path)),
        });
    }
    
    // 2. 保存当前状态
    let saved_state = save_plugin_state(&plugin_id).await?;
    let old_version = get_plugin_version(&plugin_id);
    
    // 3. 安全卸载当前后端
    let unload_result = safe_unload_plugin_backend(&plugin_id).await;
    if let Err(e) = unload_result {
        log_plugin_message(&plugin_id, "error", &format!("Failed to unload: {}", e), Some("hot_reload"));
        return Ok(HotReloadResult {
            success: false,
            plugin_id,
            old_version,
            new_version: None,
            reload_time_ms: start_time.elapsed().as_millis() as u64,
            error: Some(e),
        });
    }
    
    // 4. 加载新的后端
    let load_result = load_enhanced_plugin_backend(plugin_id.clone(), new_backend_path).await;
    match load_result {
        Ok(_) => {
            // 5. 恢复状态
            if let Some(state) = saved_state {
                if let Err(e) = restore_plugin_state(&plugin_id, &state).await {
                    log_plugin_message(&plugin_id, "warn", &format!("Failed to restore state: {}", e), Some("hot_reload"));
                }
            }
            
            let new_version = get_plugin_version(&plugin_id);
            let reload_time = start_time.elapsed().as_millis() as u64;
            
            log_plugin_message(&plugin_id, "info", &format!("Hot reload completed in {}ms", reload_time), Some("hot_reload"));
            
            Ok(HotReloadResult {
                success: true,
                plugin_id,
                old_version,
                new_version,
                reload_time_ms: reload_time,
                error: None,
            })
        }
        Err(e) => {
            log_plugin_message(&plugin_id, "error", &format!("Failed to load new backend: {}", e), Some("hot_reload"));
            
            Ok(HotReloadResult {
                success: false,
                plugin_id,
                old_version,
                new_version: None,
                reload_time_ms: start_time.elapsed().as_millis() as u64,
                error: Some(e),
            })
        }
    }
}

/// 保存插件状态
async fn save_plugin_state(plugin_id: &str) -> Result<Option<PluginBackendState>, String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(plugin_id) {
        // 尝试调用插件的状态保存函数
        match unsafe { lib.lib.get::<unsafe extern "C" fn() -> *mut i8>(b"plugin_save_state") } {
            Ok(save_state_fn) => {
                unsafe {
                    let state_ptr = save_state_fn();
                    if state_ptr.is_null() {
                        return Ok(None);
                    }
                    
                    let state_cstr = CStr::from_ptr(state_ptr);
                    let state_json = state_cstr.to_string_lossy().to_string();
                    
                    // 释放内存
                    if let Ok(free_fn) = lib.lib.get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string") {
                        free_fn(state_ptr);
                    }
                    
                    let state = PluginBackendState {
                        plugin_id: plugin_id.to_string(),
                        state_data: state_json,
                        version: lib.version.clone(),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    };
                    
                    // 保存到内存中
                    {
                        let mut state_guard = lib.state.write().unwrap();
                        *state_guard = Some(state.state_data.clone());
                    }
                    
                    log_plugin_message(plugin_id, "debug", "State saved successfully", Some("save_state"));
                    Ok(Some(state))
                }
            }
            Err(_) => {
                log_plugin_message(plugin_id, "debug", "Plugin does not support state saving", Some("save_state"));
                Ok(None)
            }
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 恢复插件状态
async fn restore_plugin_state(plugin_id: &str, state: &PluginBackendState) -> Result<(), String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(plugin_id) {
        // 尝试调用插件的状态恢复函数
        match unsafe { lib.lib.get::<unsafe extern "C" fn(*const i8) -> bool>(b"plugin_restore_state") } {
            Ok(restore_state_fn) => {
                let state_cstring = CString::new(state.state_data.clone())
                    .map_err(|e| format!("Invalid state data: {}", e))?;
                
                unsafe {
                    let success = restore_state_fn(state_cstring.as_ptr());
                    if success {
                        log_plugin_message(plugin_id, "debug", "State restored successfully", Some("restore_state"));
                        Ok(())
                    } else {
                        Err("Plugin failed to restore state".to_string())
                    }
                }
            }
            Err(_) => {
                log_plugin_message(plugin_id, "debug", "Plugin does not support state restoration", Some("restore_state"));
                Ok(())
            }
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 获取插件版本
fn get_plugin_version(plugin_id: &str) -> Option<String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    libs.get(plugin_id).map(|lib| lib.version.clone())
}

// ========== 安全卸载支持 ==========

/// 安全卸载插件后端
#[command]
pub async fn plugin_safe_unload_backend(plugin_id: String) -> Result<(), String> {
    safe_unload_plugin_backend(&plugin_id).await
}

/// 内部安全卸载函数
async fn safe_unload_plugin_backend(plugin_id: &str) -> Result<(), String> {
    log_plugin_message(plugin_id, "info", "Starting safe unload", Some("safe_unload"));
    
    let mut libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(plugin_id) {
        // 1. 调用插件清理函数
        if let Ok(cleanup_fn) = unsafe { lib.lib.get::<unsafe extern "C" fn()>(b"plugin_cleanup") } {
            unsafe {
                cleanup_fn();
            }
            log_plugin_message(plugin_id, "debug", "Plugin cleanup function called", Some("safe_unload"));
        }
        
        // 2. 等待一段时间确保所有操作完成
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // 3. 检查插件是否可以安全卸载
        if let Ok(can_unload_fn) = unsafe { lib.lib.get::<unsafe extern "C" fn() -> bool>(b"plugin_can_unload") } {
            unsafe {
                if !can_unload_fn() {
                    return Err("Plugin is not ready to be unloaded".to_string());
                }
            }
        }
        
        // 4. 移除插件
        libs.remove(plugin_id);
        log_plugin_message(plugin_id, "info", "Plugin unloaded successfully", Some("safe_unload"));
        
        Ok(())
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

// ========== 增强的加载函数 ==========

/// 加载增强的插件后端
pub async fn load_enhanced_plugin_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<(), String> {
    log_plugin_message(&plugin_id, "info", &format!("Loading backend from: {}", backend_path), Some("load_backend"));
    
    let lib_path = PathBuf::from(&backend_path);
    
    if !lib_path.exists() {
        return Err(format!("Dynamic library not found: {}", backend_path));
    }
    
    // 加载动态库
    match unsafe { libloading::Library::new(&lib_path) } {
        Ok(lib) => {
            // 创建日志发送器
            let (log_sender, _) = broadcast::channel(100);
            
            // 初始化插件
            if let Ok(init_fn) = unsafe { lib.get::<unsafe extern "C" fn()>(b"plugin_init") } {
                unsafe { init_fn() };
                log_plugin_message(&plugin_id, "debug", "Plugin initialized", Some("load_backend"));
            }
            
            // 获取插件版本
            let version = get_plugin_version_from_lib(&lib).unwrap_or_else(|| "unknown".to_string());
            
            // 获取命令列表
            let commands = get_plugin_commands_from_lib(&lib);
            
            // 创建指标
            let metrics = PluginBackendMetrics {
                plugin_id: plugin_id.clone(),
                memory_usage: 0,
                cpu_time_ms: 0,
                function_calls: HashMap::new(),
                last_error: None,
                uptime_ms: 0,
                status: "running".to_string(),
            };
            
            // 创建增强的动态库结构
            let enhanced_lib = EnhancedDynamicLibrary {
                lib,
                plugin_id: plugin_id.clone(),
                commands,
                load_time: Instant::now(),
                metrics: Arc::new(Mutex::new(metrics)),
                state: Arc::new(RwLock::new(None)),
                log_sender,
                version,
                lib_path,
            };
            
            // 存储到全局映射
            {
                let mut libs = ENHANCED_LIBRARIES.lock().unwrap();
                libs.insert(plugin_id.clone(), enhanced_lib);
            }
            
            log_plugin_message(&plugin_id, "info", "Backend loaded successfully", Some("load_backend"));
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to load library: {}", e);
            log_plugin_message(&plugin_id, "error", &error_msg, Some("load_backend"));
            Err(error_msg)
        }
    }
}

/// 从动态库获取版本信息
fn get_plugin_version_from_lib(lib: &libloading::Library) -> Option<String> {
    match unsafe { lib.get::<unsafe extern "C" fn() -> *const i8>(b"plugin_get_version") } {
        Ok(get_version_fn) => {
            unsafe {
                let version_ptr = get_version_fn();
                if !version_ptr.is_null() {
                    let version_cstr = CStr::from_ptr(version_ptr);
                    Some(version_cstr.to_string_lossy().to_string())
                } else {
                    None
                }
            }
        }
        Err(_) => None,
    }
}

/// 从动态库获取命令列表
fn get_plugin_commands_from_lib(lib: &libloading::Library) -> Vec<PluginCommand> {
    // 这里可以实现从插件获取命令列表的逻辑
    // 暂时返回空列表
    Vec::new()
}

// ========== Tauri命令接口 ==========

/// 获取插件后端指标
#[command]
pub async fn plugin_get_backend_metrics(plugin_id: String) -> Result<PluginBackendMetrics, String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(&plugin_id) {
        let metrics = lib.metrics.lock().unwrap();
        Ok(metrics.clone())
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 获取所有插件的后端指标
#[command]
pub async fn plugin_get_all_backend_metrics() -> Result<Vec<PluginBackendMetrics>, String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    let mut all_metrics = Vec::new();
    
    for lib in libs.values() {
        if let Ok(metrics) = lib.metrics.lock() {
            all_metrics.push(metrics.clone());
        }
    }
    
    Ok(all_metrics)
}

/// 设置插件日志级别
#[command]
pub async fn plugin_set_log_level(plugin_id: String, level: String) -> Result<(), String> {
    log_plugin_message(&plugin_id, "info", &format!("Log level set to: {}", level), Some("set_log_level"));
    
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(&plugin_id) {
        // 尝试调用插件的日志级别设置函数
        if let Ok(set_log_level_fn) = unsafe { 
            lib.lib.get::<unsafe extern "C" fn(*const i8)>(b"plugin_set_log_level") 
        } {
            let level_cstring = CString::new(level)
                .map_err(|e| format!("Invalid log level: {}", e))?;
            
            unsafe {
                set_log_level_fn(level_cstring.as_ptr());
            }
        }
        
        Ok(())
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 检查插件是否可以热重载
#[command]
pub async fn plugin_can_hot_reload(plugin_id: String) -> Result<bool, String> {
    let libs = ENHANCED_LIBRARIES.lock().unwrap();
    
    if let Some(lib) = libs.get(&plugin_id) {
        // 检查插件是否支持热重载
        match unsafe { lib.lib.get::<unsafe extern "C" fn() -> bool>(b"plugin_can_reload") } {
            Ok(can_reload_fn) => {
                unsafe {
                    Ok(can_reload_fn())
                }
            }
            Err(_) => Ok(false), // 插件不支持热重载
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}
