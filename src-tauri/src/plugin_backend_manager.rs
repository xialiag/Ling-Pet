// 增强的插件后端管理器
// 支持实时日志、热重载、安全卸载

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Manager};
use tokio::sync::broadcast;
use log::{debug, error, info, warn};

// ========== 数据结构定义 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginLogEntry {
    pub plugin_id: String,
    pub level: String,
    pub message: String,
    pub timestamp: u64,
    pub source: String, // "frontend" | "backend"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendMetrics {
    pub plugin_id: String,
    pub memory_usage: u64,
    pub cpu_time: u64,
    pub function_calls: HashMap<String, u64>,
    pub last_error: Option<String>,
    pub uptime: u64,
    pub status: String, // "running" | "stopped" | "error"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendState {
    pub plugin_id: String,
    pub state_data: String, // JSON序列化的状态数据
    pub timestamp: u64,
}

// 插件后端信息
#[derive(Debug)]
struct PluginBackend {
    lib: libloading::Library,
    plugin_id: String,
    lib_path: PathBuf,
    loaded_at: SystemTime,
    function_calls: Arc<RwLock<HashMap<String, u64>>>,
    last_error: Arc<RwLock<Option<String>>>,
    state: Arc<RwLock<Option<String>>>,
}

impl PluginBackend {
    fn new(lib: libloading::Library, plugin_id: String, lib_path: PathBuf) -> Self {
        Self {
            lib,
            plugin_id,
            lib_path,
            loaded_at: SystemTime::now(),
            function_calls: Arc::new(RwLock::new(HashMap::new())),
            last_error: Arc::new(RwLock::new(None)),
            state: Arc::new(RwLock::new(None)),
        }
    }

    fn get_uptime(&self) -> u64 {
        self.loaded_at
            .elapsed()
            .unwrap_or(Duration::from_secs(0))
            .as_secs()
    }

    fn increment_function_call(&self, function_name: &str) {
        let mut calls = self.function_calls.write().unwrap();
        *calls.entry(function_name.to_string()).or_insert(0) += 1;
    }

    fn set_error(&self, error: String) {
        let mut last_error = self.last_error.write().unwrap();
        *last_error = Some(error);
    }

    fn get_metrics(&self) -> BackendMetrics {
        let calls = self.function_calls.read().unwrap().clone();
        let last_error = self.last_error.read().unwrap().clone();

        BackendMetrics {
            plugin_id: self.plugin_id.clone(),
            memory_usage: self.get_memory_usage(),
            cpu_time: 0, // TODO: 实现CPU时间统计
            function_calls: calls,
            last_error,
            uptime: self.get_uptime(),
            status: "running".to_string(),
        }
    }

    fn get_memory_usage(&self) -> u64 {
        // TODO: 实现内存使用统计
        0
    }
}

// ========== 全局状态管理 ==========

lazy_static::lazy_static! {
    static ref PLUGIN_BACKENDS: Arc<RwLock<HashMap<String, PluginBackend>>> = 
        Arc::new(RwLock::new(HashMap::new()));
    
    static ref LOG_SENDER: Arc<Mutex<Option<broadcast::Sender<PluginLogEntry>>>> = 
        Arc::new(Mutex::new(None));
}

// ========== 日志系统 ==========

/// 初始化日志系统
pub fn init_logging_system() {
    let (sender, _) = broadcast::channel(1000);
    let mut log_sender = LOG_SENDER.lock().unwrap();
    *log_sender = Some(sender);
    
    info!("[PluginBackend] Logging system initialized");
}

/// 发送日志到前端
pub fn send_log(plugin_id: &str, level: &str, message: &str, source: &str) {
    let log_entry = PluginLogEntry {
        plugin_id: plugin_id.to_string(),
        level: level.to_string(),
        message: message.to_string(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        source: source.to_string(),
    };

    if let Some(sender) = LOG_SENDER.lock().unwrap().as_ref() {
        if let Err(e) = sender.send(log_entry) {
            error!("[PluginBackend] Failed to send log: {}", e);
        }
    }
}

/// 订阅插件日志
#[command]
pub async fn subscribe_plugin_logs(app: AppHandle) -> Result<(), String> {
    let log_sender = LOG_SENDER.lock().unwrap();
    if let Some(sender) = log_sender.as_ref() {
        let mut receiver = sender.subscribe();
        
        tokio::spawn(async move {
            while let Ok(log_entry) = receiver.recv().await {
                if let Err(e) = app.emit_all("plugin-log", &log_entry) {
                    error!("[PluginBackend] Failed to emit log event: {}", e);
                }
            }
        });
    }
    
    Ok(())
}

// ========== 后端加载和管理 ==========

/// 加载插件后端（支持热重载）
#[command]
pub async fn load_plugin_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<bool, String> {
    info!("[PluginBackend] Loading backend for plugin: {}", plugin_id);
    send_log(&plugin_id, "info", "Loading backend...", "system");

    let lib_path = PathBuf::from(&backend_path);

    if !lib_path.exists() {
        let error_msg = format!("Backend library not found: {}", backend_path);
        error!("[PluginBackend] {}", error_msg);
        send_log(&plugin_id, "error", &error_msg, "system");
        return Ok(false);
    }

    // 检查是否已经加载，如果是则先卸载
    if is_backend_loaded(&plugin_id) {
        info!("[PluginBackend] Backend already loaded, performing hot reload");
        send_log(&plugin_id, "info", "Performing hot reload...", "system");
        
        // 保存状态
        if let Some(state) = save_backend_state(&plugin_id).await {
            info!("[PluginBackend] Backend state saved for hot reload");
        }
        
        // 卸载旧版本
        unload_plugin_backend_internal(&plugin_id).await?;
    }

    // 加载新的动态库
    match unsafe { libloading::Library::new(&lib_path) } {
        Ok(lib) => {
            // 调用初始化函数
            if let Ok(init_fn) = unsafe { lib.get::<unsafe extern "C" fn()>(b"plugin_init") } {
                unsafe { init_fn() };
                send_log(&plugin_id, "info", "Backend initialized", "backend");
            }

            // 创建后端实例
            let backend = PluginBackend::new(lib, plugin_id.clone(), lib_path);
            
            // 存储到全局状态
            {
                let mut backends = PLUGIN_BACKENDS.write().unwrap();
                backends.insert(plugin_id.clone(), backend);
            }

            // 恢复状态（如果有）
            if let Some(state) = get_saved_state(&plugin_id) {
                restore_backend_state(&plugin_id, &state).await;
                send_log(&plugin_id, "info", "Backend state restored", "system");
            }

            info!("[PluginBackend] Backend loaded successfully: {}", plugin_id);
            send_log(&plugin_id, "info", "Backend loaded successfully", "system");
            Ok(true)
        }
        Err(e) => {
            let error_msg = format!("Failed to load backend library: {}", e);
            error!("[PluginBackend] {}", error_msg);
            send_log(&plugin_id, "error", &error_msg, "system");
            Ok(false)
        }
    }
}

/// 卸载插件后端（安全卸载）
#[command]
pub async fn unload_plugin_backend(plugin_id: String) -> Result<(), String> {
    unload_plugin_backend_internal(&plugin_id).await
}

async fn unload_plugin_backend_internal(plugin_id: &str) -> Result<(), String> {
    info!("[PluginBackend] Unloading backend for plugin: {}", plugin_id);
    send_log(plugin_id, "info", "Unloading backend...", "system");

    let backend = {
        let mut backends = PLUGIN_BACKENDS.write().unwrap();
        backends.remove(plugin_id)
    };

    if let Some(backend) = backend {
        // 调用清理函数
        if let Ok(cleanup_fn) = unsafe { 
            backend.lib.get::<unsafe extern "C" fn()>(b"plugin_cleanup") 
        } {
            unsafe { cleanup_fn() };
            send_log(plugin_id, "info", "Backend cleanup completed", "backend");
        }

        // 等待一段时间确保所有操作完成
        tokio::time::sleep(Duration::from_millis(100)).await;

        info!("[PluginBackend] Backend unloaded: {}", plugin_id);
        send_log(plugin_id, "info", "Backend unloaded", "system");
    } else {
        warn!("[PluginBackend] Backend not found for plugin: {}", plugin_id);
    }

    Ok(())
}

/// 检查后端是否已加载
fn is_backend_loaded(plugin_id: &str) -> bool {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    backends.contains_key(plugin_id)
}

/// 调用插件后端函数（增强版）
#[command]
pub async fn call_plugin_backend(
    plugin_id: String,
    function_name: String,
    args: String,
) -> Result<String, String> {
    debug!("[PluginBackend] Calling {}::{}", plugin_id, function_name);
    send_log(&plugin_id, "debug", &format!("Calling function: {}", function_name), "system");

    let backend = {
        let backends = PLUGIN_BACKENDS.read().unwrap();
        backends.get(&plugin_id).map(|b| {
            // 记录函数调用
            b.increment_function_call(&function_name);
            // 这里我们需要返回一些可以安全传递的信息
            (b.plugin_id.clone(), b.lib_path.clone())
        })
    };

    let (backend_plugin_id, _lib_path) = backend
        .ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    // 重新获取backend引用来调用函数
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(&backend_plugin_id)
        .ok_or_else(|| format!("Plugin backend not found: {}", plugin_id))?;

    let full_function_name = format!("plugin_{}", function_name);

    match unsafe {
        backend.lib.get::<unsafe extern "C" fn(*const i8) -> *mut i8>(full_function_name.as_bytes())
    } {
        Ok(func) => {
            let args_cstring = CString::new(args)
                .map_err(|e| format!("Invalid args string: {}", e))?;

            let result = unsafe {
                let result_ptr = func(args_cstring.as_ptr());
                if result_ptr.is_null() {
                    Err("Function returned null".to_string())
                } else {
                    let result_cstr = CStr::from_ptr(result_ptr);
                    let result_string = result_cstr.to_string_lossy().to_string();

                    // 释放插件分配的内存
                    if let Ok(free_fn) = backend.lib.get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string") {
                        free_fn(result_ptr);
                    }

                    Ok(result_string)
                }
            };

            match &result {
                Ok(res) => {
                    send_log(&plugin_id, "debug", &format!("Function {} completed successfully", function_name), "backend");
                    debug!("[PluginBackend] Function call successful: {}::{}", plugin_id, function_name);
                }
                Err(e) => {
                    backend.set_error(e.clone());
                    send_log(&plugin_id, "error", &format!("Function {} failed: {}", function_name, e), "backend");
                    error!("[PluginBackend] Function call failed: {}::{} - {}", plugin_id, function_name, e);
                }
            }

            result
        }
        Err(e) => {
            let error_msg = format!("Function {} not found: {}", full_function_name, e);
            backend.set_error(error_msg.clone());
            send_log(&plugin_id, "error", &error_msg, "system");
            Err(error_msg)
        }
    }
}

/// 获取后端指标
#[command]
pub async fn get_backend_metrics(plugin_id: String) -> Result<BackendMetrics, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(&plugin_id)
        .ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    Ok(backend.get_metrics())
}

/// 获取所有后端指标
#[command]
pub async fn get_all_backend_metrics() -> Result<Vec<BackendMetrics>, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let metrics: Vec<BackendMetrics> = backends.values()
        .map(|backend| backend.get_metrics())
        .collect();

    Ok(metrics)
}

// ========== 状态管理（热重载支持） ==========

/// 保存后端状态
async fn save_backend_state(plugin_id: &str) -> Option<BackendState> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(plugin_id)?;

    // 尝试调用插件的状态保存函数
    if let Ok(save_state_fn) = unsafe {
        backend.lib.get::<unsafe extern "C" fn() -> *mut i8>(b"plugin_save_state")
    } {
        unsafe {
            let state_ptr = save_state_fn();
            if !state_ptr.is_null() {
                let state_cstr = CStr::from_ptr(state_ptr);
                let state_string = state_cstr.to_string_lossy().to_string();

                // 释放插件分配的内存
                if let Ok(free_fn) = backend.lib.get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string") {
                    free_fn(state_ptr);
                }

                let backend_state = BackendState {
                    plugin_id: plugin_id.to_string(),
                    state_data: state_string,
                    timestamp: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                };

                // 保存到内存中（实际应用中可能需要持久化）
                {
                    let mut state = backend.state.write().unwrap();
                    *state = Some(backend_state.state_data.clone());
                }

                return Some(backend_state);
            }
        }
    }

    None
}

/// 恢复后端状态
async fn restore_backend_state(plugin_id: &str, state: &BackendState) {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    if let Some(backend) = backends.get(plugin_id) {
        // 尝试调用插件的状态恢复函数
        if let Ok(restore_state_fn) = unsafe {
            backend.lib.get::<unsafe extern "C" fn(*const i8) -> bool>(b"plugin_restore_state")
        } {
            let state_cstring = CString::new(state.state_data.clone()).unwrap();
            unsafe {
                let success = restore_state_fn(state_cstring.as_ptr());
                if success {
                    send_log(plugin_id, "info", "State restored successfully", "backend");
                } else {
                    send_log(plugin_id, "warn", "Failed to restore state", "backend");
                }
            }
        }
    }
}

/// 获取保存的状态
fn get_saved_state(plugin_id: &str) -> Option<BackendState> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(plugin_id)?;
    let state = backend.state.read().unwrap();
    
    state.as_ref().map(|state_data| BackendState {
        plugin_id: plugin_id.to_string(),
        state_data: state_data.clone(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    })
}

/// 检查后端健康状态
#[command]
pub async fn check_backend_health(plugin_id: String) -> Result<bool, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(&plugin_id)
        .ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    // 尝试调用健康检查函数
    if let Ok(health_fn) = unsafe {
        backend.lib.get::<unsafe extern "C" fn() -> bool>(b"plugin_health_check")
    } {
        let is_healthy = unsafe { health_fn() };
        if is_healthy {
            send_log(&plugin_id, "debug", "Health check passed", "backend");
        } else {
            send_log(&plugin_id, "warn", "Health check failed", "backend");
        }
        Ok(is_healthy)
    } else {
        // 如果没有健康检查函数，认为插件是健康的
        Ok(true)
    }
}

/// 重启后端（热重载的便捷方法）
#[command]
pub async fn restart_plugin_backend(plugin_id: String) -> Result<bool, String> {
    info!("[PluginBackend] Restarting backend for plugin: {}", plugin_id);
    send_log(&plugin_id, "info", "Restarting backend...", "system");

    // 获取当前的库路径
    let lib_path = {
        let backends = PLUGIN_BACKENDS.read().unwrap();
        backends.get(&plugin_id)
            .map(|b| b.lib_path.clone())
    };

    if let Some(path) = lib_path {
        // 卸载并重新加载
        unload_plugin_backend_internal(&plugin_id).await?;
        tokio::time::sleep(Duration::from_millis(200)).await; // 等待卸载完成
        
        let path_str = path.to_string_lossy().to_string();
        load_plugin_backend(plugin_id.clone(), path_str).await
    } else {
        Err(format!("Plugin backend not found: {}", plugin_id))
    }
}