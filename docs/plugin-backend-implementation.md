# 插件后端实现指南

## 一、Tauri主应用后端实现

### 1.1 插件管理器结构

在 `src-tauri/src/` 目录下创建插件相关模块：

```
src-tauri/src/
├── main.rs
├── plugin_manager.rs      # 插件管理器
├── plugin_loader.rs       # 动态库加载器
└── commands/
    └── plugin_commands.rs # 插件相关命令
```

### 1.2 插件管理器实现

```rust
// src-tauri/src/plugin_manager.rs
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use libloading::{Library, Symbol};
use tauri::{AppHandle, Manager};

/// 插件后端信息
pub struct PluginBackend {
    pub id: String,
    pub library: Library,
    pub commands: Vec<String>,
}

/// 插件管理器
pub struct PluginManager {
    backends: Arc<Mutex<HashMap<String, PluginBackend>>>,
}

impl PluginManager {
    pub fn new() -> Self {
        Self {
            backends: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 加载插件后端
    pub fn load_backend(
        &self,
        plugin_id: String,
        lib_path: &str,
        app: AppHandle,
    ) -> Result<(), String> {
        unsafe {
            // 加载动态库
            let lib = Library::new(lib_path)
                .map_err(|e| format!("无法加载动态库: {}", e))?;

            // 查找初始化函数
            let init_fn: Symbol<extern "C" fn(AppHandle) -> Vec<String>> = lib
                .get(b"plugin_init\0")
                .map_err(|e| format!("找不到初始化函数: {}", e))?;

            // 调用初始化函数，获取命令列表
            let commands = init_fn(app.clone());

            // 存储插件信息
            let backend = PluginBackend {
                id: plugin_id.clone(),
                library: lib,
                commands,
            };

            self.backends
                .lock()
                .unwrap()
                .insert(plugin_id.clone(), backend);

            println!("[PluginManager] 插件后端已加载: {}", plugin_id);
            Ok(())
        }
    }

    /// 卸载插件后端
    pub fn unload_backend(&self, plugin_id: &str) -> Result<(), String> {
        let mut backends = self.backends.lock().unwrap();
        
        if let Some(backend) = backends.remove(plugin_id) {
            // 调用清理函数（如果有）
            unsafe {
                if let Ok(cleanup_fn) = backend.library.get::<Symbol<extern "C" fn()>>(b"plugin_cleanup\0") {
                    cleanup_fn();
                }
            }
            
            println!("[PluginManager] 插件后端已卸载: {}", plugin_id);
            Ok(())
        } else {
            Err(format!("插件后端不存在: {}", plugin_id))
        }
    }

    /// 获取已加载的插件列表
    pub fn get_loaded_plugins(&self) -> Vec<String> {
        self.backends
            .lock()
            .unwrap()
            .keys()
            .cloned()
            .collect()
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new()
    }
}
```

### 1.3 Tauri命令实现

```rust
// src-tauri/src/commands/plugin_commands.rs
use tauri::{command, AppHandle, State};
use std::path::Path;
use crate::plugin_manager::PluginManager;

#[derive(serde::Serialize)]
pub struct PluginLoadResult {
    pub success: bool,
    pub error: Option<String>,
}

/// 加载插件后端
#[command]
pub async fn plugin_load_backend(
    plugin_id: String,
    backend_path: String,
    app: AppHandle,
    plugin_manager: State<'_, PluginManager>,
) -> Result<PluginLoadResult, String> {
    // 验证路径
    if !Path::new(&backend_path).exists() {
        return Ok(PluginLoadResult {
            success: false,
            error: Some(format!("后端文件不存在: {}", backend_path)),
        });
    }

    // 加载后端
    match plugin_manager.load_backend(plugin_id.clone(), &backend_path, app) {
        Ok(_) => Ok(PluginLoadResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(PluginLoadResult {
            success: false,
            error: Some(e),
        }),
    }
}

/// 卸载插件后端
#[command]
pub async fn plugin_unload_backend(
    plugin_id: String,
    plugin_manager: State<'_, PluginManager>,
) -> Result<(), String> {
    plugin_manager.unload_backend(&plugin_id)
}

/// 安装插件（从zip文件）
#[command]
pub async fn plugin_install(
    zip_path: String,
    target_dir: String,
) -> Result<PluginInstallResult, String> {
    use std::fs;
    use zip::ZipArchive;

    // 打开zip文件
    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("无法打开zip文件: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("无法读取zip文件: {}", e))?;

    // 读取manifest.json
    let mut manifest_file = archive.by_name("manifest.json")
        .map_err(|_| "zip文件中缺少manifest.json".to_string())?;
    
    let mut manifest_content = String::new();
    std::io::Read::read_to_string(&mut manifest_file, &mut manifest_content)
        .map_err(|e| format!("无法读取manifest.json: {}", e))?;
    
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("manifest.json格式错误: {}", e))?;
    
    let plugin_id = manifest["id"]
        .as_str()
        .ok_or("manifest.json缺少id字段")?
        .to_string();

    // 创建插件目录
    let plugin_dir = Path::new(&target_dir).join(&plugin_id);
    fs::create_dir_all(&plugin_dir)
        .map_err(|e| format!("无法创建插件目录: {}", e))?;

    // 解压所有文件
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("无法读取文件: {}", e))?;
        
        let outpath = plugin_dir.join(file.name());

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("无法创建目录: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("无法创建父目录: {}", e))?;
            }
            
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("无法创建文件: {}", e))?;
            
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("无法写入文件: {}", e))?;
        }
    }

    Ok(PluginInstallResult {
        success: true,
        plugin_id,
        error: None,
    })
}

#[derive(serde::Serialize)]
pub struct PluginInstallResult {
    pub success: bool,
    pub plugin_id: String,
    pub error: Option<String>,
}

/// 检查路径是否存在
#[command]
pub async fn plugin_check_path(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

/// 获取平台信息
#[command]
pub async fn plugin_get_platform() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

/// 删除插件配置
#[command]
pub async fn plugin_remove_config(plugin_id: String) -> Result<(), String> {
    // TODO: 实现配置删除逻辑
    println!("[PluginCommands] 删除插件配置: {}", plugin_id);
    Ok(())
}
```

### 1.4 主程序集成

```rust
// src-tauri/src/main.rs
mod plugin_manager;
mod commands;

use plugin_manager::PluginManager;
use commands::plugin_commands::*;

fn main() {
    tauri::Builder::default()
        // 初始化插件管理器
        .manage(PluginManager::new())
        // 注册命令
        .invoke_handler(tauri::generate_handler![
            plugin_load_backend,
            plugin_unload_backend,
            plugin_install,
            plugin_check_path,
            plugin_get_platform,
            plugin_remove_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 1.5 Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2.0", features = ["..." ] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
libloading = "0.8"
zip = "0.6"
```

## 二、插件后端开发

### 2.1 插件后端项目结构

```
my-plugin/
├── frontend/
│   ├── index.ts          # 前端代码
│   └── components/
└── backend/
    ├── Cargo.toml
    └── src/
        └── lib.rs        # 后端代码
```

### 2.2 Cargo.toml 配置

```toml
[package]
name = "my_plugin"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]  # 编译为动态库

[dependencies]
tauri = { version = "2.0", features = ["..." ] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 2.3 插件后端代码示例

```rust
// backend/src/lib.rs
use tauri::{command, AppHandle, Runtime, Manager};
use std::ffi::CString;
use std::os::raw::c_char;

/// 插件命令：处理数据
#[command]
fn my_plugin_process_data<R: Runtime>(
    app: AppHandle<R>,
    input: String,
) -> Result<String, String> {
    println!("[MyPlugin] 处理数据: {}", input);
    
    // 执行业务逻辑
    let result = format!("处理结果: {}", input.to_uppercase());
    
    Ok(result)
}

/// 插件命令：获取配置
#[command]
fn my_plugin_get_config<R: Runtime>(
    app: AppHandle<R>,
) -> Result<serde_json::Value, String> {
    // 返回配置信息
    Ok(serde_json::json!({
        "version": "1.0.0",
        "enabled": true
    }))
}

/// 插件初始化函数
/// 返回插件提供的命令列表
#[no_mangle]
pub extern "C" fn plugin_init(app: AppHandle) -> Vec<String> {
    println!("[MyPlugin] 初始化插件后端");
    
    // 注册命令到Tauri
    // 注意：这里需要使用插件特定的命名空间
    app.plugin(
        tauri::plugin::Builder::new("my-plugin")
            .invoke_handler(tauri::generate_handler![
                my_plugin_process_data,
                my_plugin_get_config,
            ])
            .build()
    ).expect("无法注册插件");
    
    // 返回命令列表
    vec![
        "my_plugin_process_data".to_string(),
        "my_plugin_get_config".to_string(),
    ]
}

/// 插件清理函数（可选）
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[MyPlugin] 清理插件后端");
}
```

### 2.4 编译插件后端

```bash
# 进入后端目录
cd backend

# 编译为release版本
cargo build --release

# 编译结果：
# Windows: target/release/my_plugin.dll
# macOS:   target/release/libmy_plugin.dylib
# Linux:   target/release/libmy_plugin.so
```

### 2.5 前端调用后端

```typescript
// frontend/index.ts
import { definePlugin } from '@/pluginLoader/core/pluginApi'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  async onLoad(context) {
    context.debug('插件加载')
    
    // 调用后端命令
    try {
      const result = await context.invokeTauri('plugin:my-plugin|my_plugin_process_data', {
        input: 'hello world'
      })
      
      context.debug('后端返回:', result)
      
      // 获取配置
      const config = await context.invokeTauri('plugin:my-plugin|my_plugin_get_config')
      context.debug('配置:', config)
    } catch (error) {
      context.debug('调用后端失败:', error)
    }
  }
})
```

## 三、完整开发流程

### 3.1 创建插件项目

```bash
# 使用CLI创建插件
cd pluginLoader
node tools/plugin-cli.js create my-plugin

# 创建后端目录
cd plugins/my-plugin
mkdir backend
cd backend
cargo init --lib
```

### 3.2 配置manifest.json

```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "示例插件",
  "author": "Your Name",
  "entry": "index.js",
  "permissions": [
    "hook:component",
    "network"
  ],
  "backend": {
    "enabled": true,
    "entry": "backend/my_plugin.dll",
    "commands": [
      "my_plugin_process_data",
      "my_plugin_get_config"
    ]
  }
}
```

### 3.3 开发和测试

```bash
# 1. 开发前端
cd frontend
npm install
npm run dev

# 2. 开发后端
cd backend
cargo build

# 3. 测试
cd ../..
node tools/plugin-cli.js test my-plugin
```

### 3.4 构建和打包

```bash
# 1. 构建前端
cd frontend
npm run build

# 2. 构建后端（多平台）
cd backend

# Windows
cargo build --release --target x86_64-pc-windows-msvc

# macOS
cargo build --release --target x86_64-apple-darwin
cargo build --release --target aarch64-apple-darwin

# Linux
cargo build --release --target x86_64-unknown-linux-gnu

# 3. 打包插件
cd ../..
node tools/plugin-cli.js package my-plugin
```

### 3.5 插件包结构

```
my-plugin-1.0.0.zip
├── manifest.json
├── index.js                    # 编译后的前端代码
├── icon.png
├── README.md
└── backend/
    ├── my_plugin.dll           # Windows x64
    ├── libmy_plugin.dylib      # macOS (universal)
    └── libmy_plugin.so         # Linux x64
```

## 四、高级特性

### 4.1 插件间通信

```rust
// 插件A后端
#[command]
fn plugin_a_emit_event<R: Runtime>(
    app: AppHandle<R>,
    event: String,
    data: serde_json::Value,
) -> Result<(), String> {
    app.emit_all(&event, data)
        .map_err(|e| e.to_string())
}
```

```typescript
// 插件B前端
context.app.listen('plugin-a-event', (event) => {
  context.debug('收到插件A的事件:', event.payload)
})
```

### 4.2 数据库访问

```rust
use rusqlite::{Connection, Result};

#[command]
fn plugin_db_query<R: Runtime>(
    app: AppHandle<R>,
    sql: String,
) -> Result<Vec<serde_json::Value>, String> {
    let db_path = app.path_resolver()
        .app_data_dir()
        .unwrap()
        .join("plugin.db");
    
    let conn = Connection::open(db_path)
        .map_err(|e| e.to_string())?;
    
    // 执行查询...
    Ok(vec![])
}
```

### 4.3 异步任务

```rust
use tokio::task;

#[command]
async fn plugin_async_task<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    let result = task::spawn(async {
        // 长时间运行的任务
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        "任务完成".to_string()
    }).await.map_err(|e| e.to_string())?;
    
    Ok(result)
}
```

## 五、调试技巧

### 5.1 日志输出

```rust
// 后端
println!("[MyPlugin] 调试信息: {:?}", data);

// 前端
context.debug('调试信息:', data)
```

### 5.2 错误处理

```rust
#[command]
fn my_command<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    // 详细的错误信息
    some_operation()
        .map_err(|e| format!("操作失败: {}", e))?;
    
    Ok("成功".to_string())
}
```

### 5.3 性能监控

```rust
use std::time::Instant;

#[command]
fn my_command<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, String> {
    let start = Instant::now();
    
    // 执行操作
    let result = do_something();
    
    let duration = start.elapsed();
    println!("[MyPlugin] 执行时间: {:?}", duration);
    
    Ok(result)
}
```

## 六、最佳实践

1. **错误处理** - 始终返回详细的错误信息
2. **资源清理** - 实现plugin_cleanup函数
3. **版本兼容** - 检查主应用版本
4. **性能优化** - 避免阻塞操作
5. **安全性** - 验证输入参数
6. **文档** - 提供详细的API文档

## 七、故障排查

### 7.1 动态库加载失败

- 检查文件路径是否正确
- 检查文件权限
- 检查依赖库是否存在

### 7.2 命令调用失败

- 检查命令名称是否正确
- 检查参数类型是否匹配
- 查看Tauri控制台日志

### 7.3 性能问题

- 使用异步命令
- 避免频繁的IPC调用
- 实现缓存机制
