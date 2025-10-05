// 增强的插件后端管理器
// 支持实时日志、热重载、安全卸载、性能监控
// 合并了 plugin_backend_enhanced 的所有功能

use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Emitter};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
}

// 增强的插件后端信息
#[derive(Debug)]
struct PluginBackend {
    lib: libloading::Library,
    plugin_id: String,
    lib_path: PathBuf,
    load_time: Instant,
    #[allow(dead_code)]
    loaded_at: SystemTime,
    function_calls: Arc<RwLock<HashMap<String, u64>>>,
    last_error: Arc<RwLock<Option<String>>>,
    state: Arc<RwLock<Option<String>>>,
    metrics: Arc<Mutex<PluginBackendMetrics>>,
    #[allow(dead_code)]
    log_sender: broadcast::Sender<PluginLogEntry>,
    #[allow(dead_code)]
    version: String,
    #[allow(dead_code)]
    commands: Vec<PluginCommand>,
}

impl PluginBackend {
    fn new(lib: libloading::Library, plugin_id: String, lib_path: PathBuf) -> Self {
        let (log_sender, _) = broadcast::channel(100);
        let version = get_plugin_version_from_lib(&lib).unwrap_or_else(|| "unknown".to_string());
        let commands = get_plugin_commands_from_lib(&lib);

        let metrics = PluginBackendMetrics {
            plugin_id: plugin_id.clone(),
            memory_usage: 0,
            cpu_time_ms: 0,
            function_calls: HashMap::new(),
            last_error: None,
            uptime_ms: 0,
            status: "running".to_string(),
        };

        Self {
            lib,
            plugin_id,
            lib_path,
            load_time: Instant::now(),
            loaded_at: SystemTime::now(),
            function_calls: Arc::new(RwLock::new(HashMap::new())),
            last_error: Arc::new(RwLock::new(None)),
            state: Arc::new(RwLock::new(None)),
            metrics: Arc::new(Mutex::new(metrics)),
            log_sender,
            version,
            commands,
        }
    }

    #[allow(dead_code)]
    fn get_uptime(&self) -> u64 {
        self.loaded_at
            .elapsed()
            .unwrap_or(Duration::from_secs(0))
            .as_secs()
    }

    fn get_uptime_ms(&self) -> u64 {
        self.load_time.elapsed().as_millis() as u64
    }

    fn increment_function_call(&self, function_name: &str) {
        let mut calls = self.function_calls.write().unwrap();
        *calls.entry(function_name.to_string()).or_insert(0) += 1;

        // 同时更新metrics中的统计
        if let Ok(mut metrics) = self.metrics.lock() {
            *metrics
                .function_calls
                .entry(function_name.to_string())
                .or_insert(0) += 1;
        }
    }

    fn set_error(&self, error: String) {
        let mut last_error = self.last_error.write().unwrap();
        *last_error = Some(error.clone());

        // 同时更新metrics中的错误信息
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.last_error = Some(error);
        }
    }

    fn get_metrics(&self) -> PluginBackendMetrics {
        if let Ok(mut metrics) = self.metrics.lock() {
            metrics.uptime_ms = self.get_uptime_ms();
            metrics.clone()
        } else {
            PluginBackendMetrics {
                plugin_id: self.plugin_id.clone(),
                memory_usage: 0,
                cpu_time_ms: 0,
                function_calls: HashMap::new(),
                last_error: None,
                uptime_ms: self.get_uptime_ms(),
                status: "running".to_string(),
            }
        }
    }

    #[allow(dead_code)]
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

// ========== 辅助函数 ==========

/// 从动态库获取版本信息
fn get_plugin_version_from_lib(lib: &libloading::Library) -> Option<String> {
    match unsafe { lib.get::<unsafe extern "C" fn() -> *const i8>(b"plugin_get_version") } {
        Ok(get_version_fn) => unsafe {
            let version_ptr = get_version_fn();
            if !version_ptr.is_null() {
                let version_cstr = CStr::from_ptr(version_ptr);
                Some(version_cstr.to_string_lossy().to_string())
            } else {
                None
            }
        },
        Err(_) => None,
    }
}

/// 从动态库获取命令列表
fn get_plugin_commands_from_lib(_lib: &libloading::Library) -> Vec<PluginCommand> {
    // 这里可以实现从插件获取命令列表的逻辑
    // 暂时返回空列表
    Vec::new()
}

// ========== 日志系统 ==========

/// 初始化日志系统
pub fn initialize_logging_system(app_handle: AppHandle) {
    let (sender, _receiver) = broadcast::channel(1000);

    // 保存全局日志发送器
    {
        let mut log_sender = LOG_SENDER.lock().unwrap();
        *log_sender = Some(sender.clone());
    }

    info!("[PluginBackend] Logging system initialized");
    
    // 延迟启动日志转发任务，使用 app_handle 的异步上下文
    tauri::async_runtime::spawn(async move {
        let mut receiver = sender.subscribe();

        while let Ok(log_entry) = receiver.recv().await {
            // 转发日志到前端
            if let Err(e) = app_handle.emit("plugin:log", &log_entry) {
                eprintln!("[LogSystem] Failed to emit log: {}", e);
            }
        }
    });
}

/// 初始化日志系统（兼容旧接口）
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
        function_name: None,
        thread_id: Some(format!("{:?}", std::thread::current().id())),
    };

    if let Some(sender) = LOG_SENDER.lock().unwrap().as_ref() {
        if let Err(e) = sender.send(log_entry) {
            error!("[PluginBackend] Failed to send log: {}", e);
        }
    }
}

/// 记录插件日志（增强版）
#[allow(dead_code)]
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
    if let Some(sender) = LOG_SENDER.lock().unwrap().as_ref() {
        if let Err(e) = sender.send(log_entry.clone()) {
            eprintln!("[LogSystem] Failed to send log: {}", e);
        }
    }

    // 同时输出到控制台
    println!("[{}] [{}] {}", plugin_id, level.to_uppercase(), message);
}

/// 订阅插件日志
#[command]
pub async fn subscribe_plugin_logs(app: AppHandle) -> Result<(), String> {
    let log_sender = LOG_SENDER.lock().unwrap();
    if let Some(sender) = log_sender.as_ref() {
        let mut receiver = sender.subscribe();

        tauri::async_runtime::spawn(async move {
            while let Ok(log_entry) = receiver.recv().await {
                // 转发日志到前端
                if let Err(e) = app.emit("plugin-log", &log_entry) {
                    error!("[PluginBackend] Failed to emit log event: {}", e);
                }
            }
        });
    }

    Ok(())
}

// ========== 性能监控系统 ==========

/// 启动性能监控
pub fn start_metrics_monitoring() {
    tauri::async_runtime::spawn(async {
        let mut interval = interval(Duration::from_secs(5)); // 每5秒更新一次

        loop {
            interval.tick().await;
            update_all_metrics().await;
        }
    });

    info!("[PluginBackend] Metrics monitoring started");
}

/// 更新所有插件的性能指标
async fn update_all_metrics() {
    let backends = PLUGIN_BACKENDS.read().unwrap();

    for (plugin_id, backend) in backends.iter() {
        // 更新指标
        if let Ok(mut metrics) = backend.metrics.lock() {
            metrics.uptime_ms = backend.get_uptime_ms();

            // 尝试从插件获取指标
            if let Ok(plugin_metrics) = get_plugin_metrics_from_backend(plugin_id, &backend.lib) {
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
                if let Ok(free_fn) = lib.get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string")
                {
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

// ========== 后端加载和管理 ==========

/// 加载插件后端（支持热重载）
#[command]
pub async fn load_plugin_backend(plugin_id: String, backend_path: String) -> Result<bool, String> {
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
        if let Some(_state) = save_backend_state(&plugin_id).await {
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
    info!(
        "[PluginBackend] Unloading backend for plugin: {}",
        plugin_id
    );
    send_log(plugin_id, "info", "Unloading backend...", "system");

    let backend = {
        let mut backends = PLUGIN_BACKENDS.write().unwrap();
        backends.remove(plugin_id)
    };

    if let Some(backend) = backend {
        // 调用清理函数
        if let Ok(cleanup_fn) =
            unsafe { backend.lib.get::<unsafe extern "C" fn()>(b"plugin_cleanup") }
        {
            unsafe { cleanup_fn() };
            send_log(plugin_id, "info", "Backend cleanup completed", "backend");
        }

        // 等待一段时间确保所有操作完成
        tokio::time::sleep(Duration::from_millis(100)).await;

        info!("[PluginBackend] Backend unloaded: {}", plugin_id);
        send_log(plugin_id, "info", "Backend unloaded", "system");
    } else {
        warn!(
            "[PluginBackend] Backend not found for plugin: {}",
            plugin_id
        );
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
    send_log(
        &plugin_id,
        "debug",
        &format!("Calling function: {}", function_name),
        "system",
    );

    let backend = {
        let backends = PLUGIN_BACKENDS.read().unwrap();
        backends.get(&plugin_id).map(|b| {
            // 记录函数调用
            b.increment_function_call(&function_name);
            // 这里我们需要返回一些可以安全传递的信息
            (b.plugin_id.clone(), b.lib_path.clone())
        })
    };

    let (backend_plugin_id, _lib_path) =
        backend.ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    // 重新获取backend引用来调用函数
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends
        .get(&backend_plugin_id)
        .ok_or_else(|| format!("Plugin backend not found: {}", plugin_id))?;

    let full_function_name = format!("plugin_{}", function_name);

    match unsafe {
        backend
            .lib
            .get::<unsafe extern "C" fn(*const i8) -> *mut i8>(full_function_name.as_bytes())
    } {
        Ok(func) => {
            let args_cstring =
                CString::new(args).map_err(|e| format!("Invalid args string: {}", e))?;

            let result = unsafe {
                let result_ptr = func(args_cstring.as_ptr());
                if result_ptr.is_null() {
                    Err("Function returned null".to_string())
                } else {
                    let result_cstr = CStr::from_ptr(result_ptr);
                    let result_string = result_cstr.to_string_lossy().to_string();

                    // 释放插件分配的内存
                    if let Ok(free_fn) = backend
                        .lib
                        .get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string")
                    {
                        free_fn(result_ptr);
                    }

                    Ok(result_string)
                }
            };

            match &result {
                Ok(_res) => {
                    send_log(
                        &plugin_id,
                        "debug",
                        &format!("Function {} completed successfully", function_name),
                        "backend",
                    );
                    debug!(
                        "[PluginBackend] Function call successful: {}::{}",
                        plugin_id, function_name
                    );
                }
                Err(e) => {
                    backend.set_error(e.clone());
                    send_log(
                        &plugin_id,
                        "error",
                        &format!("Function {} failed: {}", function_name, e),
                        "backend",
                    );
                    error!(
                        "[PluginBackend] Function call failed: {}::{} - {}",
                        plugin_id, function_name, e
                    );
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
pub async fn get_backend_metrics(plugin_id: String) -> Result<PluginBackendMetrics, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends
        .get(&plugin_id)
        .ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    Ok(backend.get_metrics())
}

/// 获取所有后端指标
#[command]
pub async fn get_all_backend_metrics() -> Result<Vec<PluginBackendMetrics>, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let metrics: Vec<PluginBackendMetrics> = backends
        .values()
        .map(|backend| backend.get_metrics())
        .collect();

    Ok(metrics)
}

/// 获取插件后端指标（增强版）
#[command]
#[allow(dead_code)]
pub async fn plugin_get_backend_metrics(plugin_id: String) -> Result<PluginBackendMetrics, String> {
    get_backend_metrics(plugin_id).await
}

/// 获取所有插件的后端指标（增强版）
#[command]
#[allow(dead_code)]
pub async fn plugin_get_all_backend_metrics() -> Result<Vec<PluginBackendMetrics>, String> {
    get_all_backend_metrics().await
}

/// 设置插件日志级别
#[command]
#[allow(dead_code)]
pub async fn plugin_set_log_level(plugin_id: String, level: String) -> Result<(), String> {
    log_plugin_message(
        &plugin_id,
        "info",
        &format!("Log level set to: {}", level),
        Some("set_log_level"),
    );

    let backends = PLUGIN_BACKENDS.read().unwrap();

    if let Some(backend) = backends.get(&plugin_id) {
        // 尝试调用插件的日志级别设置函数
        if let Ok(set_log_level_fn) = unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn(*const i8)>(b"plugin_set_log_level")
        } {
            let level_cstring =
                CString::new(level).map_err(|e| format!("Invalid log level: {}", e))?;

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
#[allow(dead_code)]
pub async fn plugin_can_hot_reload(plugin_id: String) -> Result<bool, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();

    if let Some(backend) = backends.get(&plugin_id) {
        // 检查插件是否支持热重载
        match unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn() -> bool>(b"plugin_can_reload")
        } {
            Ok(can_reload_fn) => unsafe { Ok(can_reload_fn()) },
            Err(_) => Ok(false), // 插件不支持热重载
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

// ========== 状态管理（热重载支持） ==========

/// 保存后端状态
async fn save_backend_state(plugin_id: &str) -> Option<PluginBackendState> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(plugin_id)?;

    // 尝试调用插件的状态保存函数
    if let Ok(save_state_fn) = unsafe {
        backend
            .lib
            .get::<unsafe extern "C" fn() -> *mut i8>(b"plugin_save_state")
    } {
        unsafe {
            let state_ptr = save_state_fn();
            if !state_ptr.is_null() {
                let state_cstr = CStr::from_ptr(state_ptr);
                let state_string = state_cstr.to_string_lossy().to_string();

                // 释放插件分配的内存
                if let Ok(free_fn) = backend
                    .lib
                    .get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string")
                {
                    free_fn(state_ptr);
                }

                let backend_state = PluginBackendState {
                    plugin_id: plugin_id.to_string(),
                    state_data: state_string,
                    version: "unknown".to_string(),
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
async fn restore_backend_state(plugin_id: &str, state: &PluginBackendState) {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    if let Some(backend) = backends.get(plugin_id) {
        // 尝试调用插件的状态恢复函数
        if let Ok(restore_state_fn) = unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn(*const i8) -> bool>(b"plugin_restore_state")
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
fn get_saved_state(plugin_id: &str) -> Option<PluginBackendState> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    let backend = backends.get(plugin_id)?;
    let state = backend.state.read().unwrap();

    state.as_ref().map(|state_data| PluginBackendState {
        plugin_id: plugin_id.to_string(),
        state_data: state_data.clone(),
        version: "unknown".to_string(),
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
    let backend = backends
        .get(&plugin_id)
        .ok_or_else(|| format!("Plugin backend not loaded: {}", plugin_id))?;

    // 尝试调用健康检查函数
    if let Ok(health_fn) = unsafe {
        backend
            .lib
            .get::<unsafe extern "C" fn() -> bool>(b"plugin_health_check")
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
    info!(
        "[PluginBackend] Restarting backend for plugin: {}",
        plugin_id
    );
    send_log(&plugin_id, "info", "Restarting backend...", "system");

    // 获取当前的库路径
    let lib_path = {
        let backends = PLUGIN_BACKENDS.read().unwrap();
        backends.get(&plugin_id).map(|b| b.lib_path.clone())
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

// ========== 热重载支持 ==========

/// 热重载插件后端
#[command]
#[allow(dead_code)]
pub async fn plugin_hot_reload_backend(
    plugin_id: String,
    new_backend_path: String,
) -> Result<HotReloadResult, String> {
    let start_time = Instant::now();

    log_plugin_message(
        &plugin_id,
        "info",
        "Starting hot reload",
        Some("hot_reload"),
    );

    // 1. 检查新的动态库是否存在
    let new_lib_path = PathBuf::from(&new_backend_path);
    if !new_lib_path.exists() {
        return Ok(HotReloadResult {
            success: false,
            plugin_id,
            old_version: None,
            new_version: None,
            reload_time_ms: start_time.elapsed().as_millis() as u64,
            error: Some(format!(
                "New backend library not found: {}",
                new_backend_path
            )),
        });
    }

    // 2. 保存当前状态
    let saved_state = save_plugin_state(&plugin_id).await?;
    let old_version = get_plugin_version(&plugin_id);

    // 3. 安全卸载当前后端
    let unload_result = safe_unload_plugin_backend(&plugin_id).await;
    if let Err(e) = unload_result {
        log_plugin_message(
            &plugin_id,
            "error",
            &format!("Failed to unload: {}", e),
            Some("hot_reload"),
        );
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
                    log_plugin_message(
                        &plugin_id,
                        "warn",
                        &format!("Failed to restore state: {}", e),
                        Some("hot_reload"),
                    );
                }
            }

            let new_version = get_plugin_version(&plugin_id);
            let reload_time = start_time.elapsed().as_millis() as u64;

            log_plugin_message(
                &plugin_id,
                "info",
                &format!("Hot reload completed in {}ms", reload_time),
                Some("hot_reload"),
            );

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
            log_plugin_message(
                &plugin_id,
                "error",
                &format!("Failed to load new backend: {}", e),
                Some("hot_reload"),
            );

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
#[allow(dead_code)]
async fn save_plugin_state(plugin_id: &str) -> Result<Option<PluginBackendState>, String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();

    if let Some(backend) = backends.get(plugin_id) {
        // 尝试调用插件的状态保存函数
        match unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn() -> *mut i8>(b"plugin_save_state")
        } {
            Ok(save_state_fn) => {
                unsafe {
                    let state_ptr = save_state_fn();
                    if state_ptr.is_null() {
                        return Ok(None);
                    }

                    let state_cstr = CStr::from_ptr(state_ptr);
                    let state_json = state_cstr.to_string_lossy().to_string();

                    // 释放内存
                    if let Ok(free_fn) = backend
                        .lib
                        .get::<unsafe extern "C" fn(*mut i8)>(b"plugin_free_string")
                    {
                        free_fn(state_ptr);
                    }

                    let state = PluginBackendState {
                        plugin_id: plugin_id.to_string(),
                        state_data: state_json,
                        version: backend.version.clone(),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    };

                    // 保存到内存中
                    {
                        let mut state_guard = backend.state.write().unwrap();
                        *state_guard = Some(state.state_data.clone());
                    }

                    log_plugin_message(
                        plugin_id,
                        "debug",
                        "State saved successfully",
                        Some("save_state"),
                    );
                    Ok(Some(state))
                }
            }
            Err(_) => {
                log_plugin_message(
                    plugin_id,
                    "debug",
                    "Plugin does not support state saving",
                    Some("save_state"),
                );
                Ok(None)
            }
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 恢复插件状态
#[allow(dead_code)]
async fn restore_plugin_state(plugin_id: &str, state: &PluginBackendState) -> Result<(), String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();

    if let Some(backend) = backends.get(plugin_id) {
        // 尝试调用插件的状态恢复函数
        match unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn(*const i8) -> bool>(b"plugin_restore_state")
        } {
            Ok(restore_state_fn) => {
                let state_cstring = CString::new(state.state_data.clone())
                    .map_err(|e| format!("Invalid state data: {}", e))?;

                unsafe {
                    let success = restore_state_fn(state_cstring.as_ptr());
                    if success {
                        log_plugin_message(
                            plugin_id,
                            "debug",
                            "State restored successfully",
                            Some("restore_state"),
                        );
                        Ok(())
                    } else {
                        Err("Plugin failed to restore state".to_string())
                    }
                }
            }
            Err(_) => {
                log_plugin_message(
                    plugin_id,
                    "debug",
                    "Plugin does not support state restoration",
                    Some("restore_state"),
                );
                Ok(())
            }
        }
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}

/// 获取插件版本
#[allow(dead_code)]
fn get_plugin_version(plugin_id: &str) -> Option<String> {
    let backends = PLUGIN_BACKENDS.read().unwrap();
    backends
        .get(plugin_id)
        .map(|backend| backend.version.clone())
}

/// 加载增强的插件后端
#[allow(dead_code)]
pub async fn load_enhanced_plugin_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<(), String> {
    log_plugin_message(
        &plugin_id,
        "info",
        &format!("Loading backend from: {}", backend_path),
        Some("load_backend"),
    );

    let lib_path = PathBuf::from(&backend_path);

    if !lib_path.exists() {
        return Err(format!("Dynamic library not found: {}", backend_path));
    }

    // 加载动态库
    match unsafe { libloading::Library::new(&lib_path) } {
        Ok(lib) => {
            // 初始化插件
            if let Ok(init_fn) = unsafe { lib.get::<unsafe extern "C" fn()>(b"plugin_init") } {
                unsafe { init_fn() };
                log_plugin_message(
                    &plugin_id,
                    "debug",
                    "Plugin initialized",
                    Some("load_backend"),
                );
            }

            // 创建后端实例
            let backend = PluginBackend::new(lib, plugin_id.clone(), lib_path);

            // 存储到全局映射
            {
                let mut backends = PLUGIN_BACKENDS.write().unwrap();
                backends.insert(plugin_id.clone(), backend);
            }

            log_plugin_message(
                &plugin_id,
                "info",
                "Backend loaded successfully",
                Some("load_backend"),
            );
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to load library: {}", e);
            log_plugin_message(&plugin_id, "error", &error_msg, Some("load_backend"));
            Err(error_msg)
        }
    }
}

// ========== 安全卸载支持 ==========

/// 安全卸载插件后端
#[command]
#[allow(dead_code)]
pub async fn plugin_safe_unload_backend(plugin_id: String) -> Result<(), String> {
    safe_unload_plugin_backend(&plugin_id).await
}

/// 内部安全卸载函数
#[allow(dead_code)]
async fn safe_unload_plugin_backend(plugin_id: &str) -> Result<(), String> {
    log_plugin_message(
        plugin_id,
        "info",
        "Starting safe unload",
        Some("safe_unload"),
    );

    let mut backends = PLUGIN_BACKENDS.write().unwrap();

    if let Some(backend) = backends.get(plugin_id) {
        // 1. 调用插件清理函数
        if let Ok(cleanup_fn) =
            unsafe { backend.lib.get::<unsafe extern "C" fn()>(b"plugin_cleanup") }
        {
            unsafe {
                cleanup_fn();
            }
            log_plugin_message(
                plugin_id,
                "debug",
                "Plugin cleanup function called",
                Some("safe_unload"),
            );
        }

        // 2. 等待一段时间确保所有操作完成
        tokio::time::sleep(Duration::from_millis(100)).await;

        // 3. 检查插件是否可以安全卸载
        if let Ok(can_unload_fn) = unsafe {
            backend
                .lib
                .get::<unsafe extern "C" fn() -> bool>(b"plugin_can_unload")
        } {
            unsafe {
                if !can_unload_fn() {
                    return Err("Plugin is not ready to be unloaded".to_string());
                }
            }
        }

        // 4. 移除插件
        backends.remove(plugin_id);
        log_plugin_message(
            plugin_id,
            "info",
            "Plugin unloaded successfully",
            Some("safe_unload"),
        );

        Ok(())
    } else {
        Err(format!("Plugin {} not found", plugin_id))
    }
}
