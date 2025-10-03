# 插件后端集成指南

## 概述

插件可以包含独立的 Rust 后端，作为动态库被主应用热加载。这样可以：
- 提供高性能的原生功能
- 访问系统 API
- 独立于主应用编译和更新
- 支持热加载和卸载

## 架构

```
主应用 (Tauri)
    ↓
插件加载器 (TypeScript)
    ↓
插件后端加载器 (Rust)
    ↓
插件动态库 (plugin.dll/.dylib/.so)
    ↓
插件功能实现
```

## 创建插件后端

### 1. 目录结构

```
pluginLoader/plugins/my-plugin/
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs
│   └── README.md
├── index.ts
└── package.json
```

### 2. Cargo.toml 配置

```toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
name = "plugin"  # 重要：必须命名为 plugin
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

### 3. 实现插件函数

```rust
// lib.rs

/// 插件初始化
#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[My Plugin] Initialized!");
}

/// 插件清理
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[My Plugin] Cleanup!");
}

/// 示例功能函数
#[no_mangle]
pub extern "C" fn my_function(input_json: *const i8) -> *mut i8 {
    use std::ffi::{CStr, CString};
    
    // 读取输入
    let input = unsafe {
        CStr::from_ptr(input_json).to_str().unwrap()
    };
    
    // 处理逻辑
    let result = format!("Processed: {}", input);
    
    // 返回结果
    CString::new(result).unwrap().into_raw()
}

/// 释放字符串
#[no_mangle]
pub extern "C" fn free_string(ptr: *mut i8) {
    use std::ffi::CString;
    if !ptr.is_null() {
        unsafe { let _ = CString::from_raw(ptr); }
    }
}
```

### 4. 声明后端

在 `package.json` 中：

```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll"
  }
}
```

## 主应用集成

### 1. 加载插件后端

主应用的 `packageManager.loadBackend()` 会：

```typescript
async loadBackend(pluginId: string): Promise<boolean> {
    const plugin = this.installedPlugins.get(pluginId)
    if (!plugin?.manifest.backend?.enabled) {
        return false
    }

    // 获取动态库路径
    const backendPath = await join(plugin.path, plugin.manifest.backend.entry)

    // 调用 Rust 后端加载
    const result = await invoke('plugin_load_backend', {
        pluginId,
        backendPath
    })

    return result.success
}
```

### 2. Rust 后端实现

在 `src-tauri/src/plugin_manager.rs` 中：

```rust
use libloading::{Library, Symbol};
use std::collections::HashMap;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref LOADED_LIBRARIES: Mutex<HashMap<String, Library>> = 
        Mutex::new(HashMap::new());
}

#[tauri::command]
pub async fn plugin_load_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<PluginCompileResult, String> {
    println!("[Rust] Loading backend for plugin: {}", plugin_id);
    
    // 加载动态库
    let lib = unsafe {
        Library::new(&backend_path)
            .map_err(|e| format!("Failed to load library: {}", e))?
    };
    
    // 调用初始化函数
    if let Ok(init_fn) = unsafe { 
        lib.get::<unsafe extern "C" fn()>(b"plugin_init") 
    } {
        unsafe { init_fn() };
    }
    
    // 存储库引用
    let mut libs = LOADED_LIBRARIES.lock().unwrap();
    libs.insert(plugin_id.clone(), lib);
    
    Ok(PluginCompileResult {
        success: true,
        error: None,
    })
}
```

### 3. 注册 Tauri 命令

为插件功能创建 Tauri 命令桥接：

```rust
#[tauri::command]
pub async fn plugin_bilibili_emoji_scan(
    emoji_dir: String
) -> Result<Vec<EmojiInfo>, String> {
    use std::ffi::{CString, CStr};
    
    // 获取动态库
    let libs = LOADED_LIBRARIES.lock().unwrap();
    let lib = libs.get("@ling-pet/plugin-bilibili-emoji")
        .ok_or("Plugin not loaded")?;
    
    // 获取函数
    let scan_fn: Symbol<unsafe extern "C" fn(*const i8) -> *mut i8> = unsafe {
        lib.get(b"scan_emojis")
            .map_err(|e| format!("Function not found: {}", e))?
    };
    
    let free_fn: Symbol<unsafe extern "C" fn(*mut i8)> = unsafe {
        lib.get(b"free_string")
            .map_err(|e| format!("Function not found: {}", e))?
    };
    
    // 准备参数
    let dir_json = serde_json::to_string(&emoji_dir)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    let c_dir = CString::new(dir_json)
        .map_err(|e| format!("Failed to create CString: {}", e))?;
    
    // 调用函数
    let result_ptr = unsafe { scan_fn(c_dir.as_ptr()) };
    
    // 读取结果
    let result_str = unsafe {
        CStr::from_ptr(result_ptr).to_str()
            .map_err(|e| format!("Invalid UTF-8: {}", e))?
    };
    
    let result: Vec<EmojiInfo> = serde_json::from_str(result_str)
        .map_err(|e| format!("Failed to parse result: {}", e))?;
    
    // 释放内存
    unsafe { free_fn(result_ptr) };
    
    Ok(result)
}
```

### 4. 注册到 Tauri

在 `main.rs` 中：

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            plugin_load_backend,
            plugin_unload_backend,
            plugin_bilibili_emoji_scan,
            plugin_bilibili_emoji_search,
            plugin_bilibili_emoji_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 前端调用

在插件的 TypeScript 代码中：

```typescript
// 扫描表情包
const emojis = await context.invokeTauri<EmojiInfo[]>(
    'plugin_bilibili_emoji_scan',
    { emojiDir: '/path/to/emojis' }
);

// 搜索装扮
const result = await context.invokeTauri(
    'plugin_bilibili_emoji_search',
    { keyword: '鸽宝' }
);

// 下载装扮
const download = await context.invokeTauri(
    'plugin_bilibili_emoji_download',
    {
        suitId: 114156001,
        suitType: 'normal',
        targetDir: '/path/to/emojis'
    }
);
```

## 构建流程

### 1. 构建插件后端

```bash
cd pluginLoader/plugins/my-plugin/backend
cargo build --release
```

### 2. 构建插件

```bash
npm run plugin:release my-plugin
```

构建工具会自动：
1. 编译 TypeScript
2. 编译 Rust 后端
3. 复制动态库到 `dist/plugins/my-plugin/backend/`
4. 打包成 zip

### 3. 输出

```
releases/plugins/
└── my-plugin-1.0.0-win32.zip
    ├── manifest.json
    ├── package.json
    ├── index.js
    └── backend/
        └── plugin.dll
```

## 热加载

### 加载流程

1. 用户安装插件
2. `packageManager.scanInstalledPlugins()` 发现插件
3. `pluginLoader.loadPlugin()` 加载插件
4. 检测到 `backend.enabled = true`
5. `packageManager.loadBackend()` 加载动态库
6. 调用 `plugin_init()`
7. 插件就绪

### 卸载流程

1. 用户卸载插件
2. `pluginLoader.unloadPlugin()` 卸载插件
3. `packageManager.unloadBackend()` 卸载动态库
4. 调用 `plugin_cleanup()`
5. 释放动态库

## 最佳实践

### 1. 内存管理

- 所有返回的字符串必须用 `free_string` 释放
- 使用 `CString::into_raw()` 转移所有权
- 使用 `CString::from_raw()` 回收内存

### 2. 错误处理

```rust
fn create_error_response(error: &str) -> *mut i8 {
    #[derive(Serialize)]
    struct ErrorResponse {
        error: String,
    }
    
    let response = ErrorResponse {
        error: error.to_string(),
    };
    
    let json = serde_json::to_string(&response).unwrap();
    CString::new(json).unwrap().into_raw()
}
```

### 3. 线程安全

如果需要并发调用，使用 `Mutex` 或 `RwLock`：

```rust
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref STATE: Mutex<PluginState> = Mutex::new(PluginState::new());
}
```

### 4. 日志

使用 `println!` 或日志库：

```rust
println!("[My Plugin] Processing request...");
```

### 5. 性能优化

- 使用 `opt-level = "z"` 优化大小
- 使用 `lto = true` 链接时优化
- 使用 `strip = true` 移除调试信息

## 示例：Bilibili Emoji 插件

完整示例见：
- 后端实现: `pluginLoader/plugins/bilibili-emoji/backend/src/lib.rs`
- 前端调用: `pluginLoader/plugins/bilibili-emoji/index.ts`
- 构建配置: `pluginLoader/plugins/bilibili-emoji/backend/Cargo.toml`

## 故障排查

### 问题：动态库加载失败

**原因**: 
- 路径错误
- 依赖缺失
- 架构不匹配

**解决**:
```bash
# Windows: 检查依赖
dumpbin /DEPENDENTS plugin.dll

# Linux: 检查依赖
ldd libplugin.so

# macOS: 检查依赖
otool -L libplugin.dylib
```

### 问题：函数找不到

**原因**: 
- 函数名错误
- 未使用 `#[no_mangle]`
- 未使用 `extern "C"`

**解决**:
```bash
# 查看导出的符号
nm -D libplugin.so | grep plugin_init
```

### 问题：内存泄漏

**原因**: 
- 忘记调用 `free_string`
- 字符串未正确释放

**解决**:
- 确保每次调用后都释放内存
- 使用内存分析工具检查

## 总结

插件后端系统提供了：
- ✅ 独立编译和部署
- ✅ 热加载和卸载
- ✅ 高性能原生功能
- ✅ 与主应用隔离
- ✅ 跨平台支持

通过这个系统，插件可以提供强大的原生功能，同时保持与主应用的独立性。
