# 插件后端开发完整指南

## 概述

本指南详细介绍如何为 Ling-Pet 插件系统开发 Rust 后端，实现高性能的插件功能。

## 🏗️ 项目结构

```
my-plugin/
├── index.ts              # 前端入口
├── manifest.json         # 插件清单
├── package.json          # 前端依赖
└── backend/              # Rust 后端
    ├── Cargo.toml        # Rust 项目配置
    ├── src/
    │   └── lib.rs        # 后端实现
    └── target/
        └── release/
            └── plugin.dll # 编译产物
```

## 📋 前置要求

1. **Rust 工具链**：
   ```bash
   # 安装 Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # 或在 Windows 上下载安装器
   # https://rustup.rs/
   ```

2. **必要依赖**：
   ```toml
   [dependencies]
   serde = { version = "1.0", features = ["derive"] }
   serde_json = "1.0"
   # 其他业务依赖...
   ```

## 🚀 快速开始

### 1. 创建后端项目

```bash
# 在插件目录下创建后端
cd my-plugin
cargo init backend --lib
cd backend
```

### 2. 配置 Cargo.toml

```toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
name = "plugin"                    # 重要：必须命名为 plugin
crate-type = ["cdylib"]           # 生成动态库

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[profile.release]
opt-level = "z"                   # 最小化体积
lto = true                        # 链接时优化
codegen-units = 1                 # 单个代码生成单元
strip = true                      # 移除调试符号
```

### 3. 实现基础接口

```rust
// src/lib.rs
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};

// ========== 数据结构定义 ==========

#[derive(Debug, Serialize, Deserialize)]
pub struct MyResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

// ========== 业务逻辑实现 ==========

pub fn my_business_function(input: &str) -> MyResult {
    // 实现你的业务逻辑
    MyResult {
        success: true,
        data: Some(format!("处理结果: {}", input)),
        error: None,
    }
}

// ========== C 接口导出 ==========

/// 插件初始化
#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[my-plugin-backend] Plugin initialized");
}

/// 插件清理
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[my-plugin-backend] Plugin cleaned up");
}

/// 健康检查
#[no_mangle]
pub extern "C" fn plugin_health_check() -> bool {
    true // 插件健康
}

/// 业务函数导出
#[no_mangle]
pub extern "C" fn plugin_my_function(args_ptr: *const i8) -> *mut i8 {
    if args_ptr.is_null() {
        return std::ptr::null_mut();
    }
    
    unsafe {
        // 解析输入参数
        let args_cstr = CStr::from_ptr(args_ptr);
        let args_str = match args_cstr.to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        
        let args: serde_json::Value = match serde_json::from_str(args_str) {
            Ok(v) => v,
            Err(_) => return std::ptr::null_mut(),
        };
        
        // 提取参数
        let input = match args["input"].as_str() {
            Some(s) => s,
            None => return std::ptr::null_mut(),
        };
        
        // 调用业务逻辑
        let result = my_business_function(input);
        
        // 序列化结果
        let result_json = match serde_json::to_string(&result) {
            Ok(json) => json,
            Err(_) => return std::ptr::null_mut(),
        };
        
        // 返回结果
        match CString::new(result_json) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    }
}

/// 释放字符串内存
#[no_mangle]
pub extern "C" fn plugin_free_string(ptr: *mut i8) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}
```

### 4. 更新插件清单

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "带有 Rust 后端的示例插件",
  "author": "Your Name",
  "backend": {
    "enabled": true,
    "type": "rust",
    "entry": "backend/target/release/plugin.dll"
  }
}
```

### 5. 前端集成

```typescript
// index.ts
import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: '带有 Rust 后端的示例插件',
  
  async onLoad(context: PluginContext) {
    context.debug('插件加载中...')
    
    // 检查后端状态
    const isBackendReady = await context.getBackendStatus()
    if (!isBackendReady) {
      context.debug('❌ 后端未就绪')
      return
    }
    
    context.debug('✅ 后端已就绪')
    
    // 调用后端函数
    try {
      const result = await context.callBackend('my_function', {
        input: 'Hello from frontend!'
      })
      
      context.debug('后端调用结果:', result)
    } catch (error) {
      context.debug('后端调用失败:', error)
    }
  },
  
  async onUnload(context: PluginContext) {
    context.debug('插件卸载中...')
  }
})
```

## 🔧 编译和测试

### 1. 编译后端

```bash
cd backend
cargo build --release
```

### 2. 验证生成的文件

```bash
# Windows
ls target/release/plugin.dll

# macOS
ls target/release/libplugin.dylib

# Linux
ls target/release/libplugin.so
```

### 3. 测试插件

1. 将插件目录放入 `pluginLoader/plugins/`
2. 启动应用
3. 在插件管理中启用插件
4. 查看控制台输出验证功能

## 📚 高级功能

### 1. 异步函数支持

```rust
use tokio::runtime::Runtime;

#[no_mangle]
pub extern "C" fn plugin_async_function(args_ptr: *const i8) -> *mut i8 {
    // 创建异步运行时
    let rt = match Runtime::new() {
        Ok(rt) => rt,
        Err(_) => return std::ptr::null_mut(),
    };
    
    // 在运行时中执行异步函数
    let result = rt.block_on(async {
        // 你的异步逻辑
        my_async_business_function().await
    });
    
    // 序列化并返回结果...
}
```

### 2. 错误处理最佳实践

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct StandardResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub error_code: Option<i32>,
}

impl<T> StandardResult<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            error_code: None,
        }
    }
    
    pub fn error(message: &str, code: i32) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
            error_code: Some(code),
        }
    }
}
```

### 3. 配置管理

```rust
// 从前端获取配置
pub fn get_plugin_config(args: &serde_json::Value) -> StandardResult<String> {
    let config_key = match args["key"].as_str() {
        Some(key) => key,
        None => return StandardResult::error("Missing config key", 400),
    };
    
    // 实现配置读取逻辑
    // 注意：后端无法直接访问前端配置，需要前端传递
    StandardResult::success("config_value".to_string())
}
```

### 4. 日志记录

```rust
// 添加依赖
// log = "0.4"
// env_logger = "0.10"

use log::{info, warn, error, debug};

#[no_mangle]
pub extern "C" fn plugin_init() {
    env_logger::init();
    info!("[my-plugin-backend] Plugin initialized");
}

pub fn my_function_with_logging(input: &str) -> MyResult {
    debug!("Processing input: {}", input);
    
    if input.is_empty() {
        warn!("Empty input received");
        return MyResult {
            success: false,
            data: None,
            error: Some("Input cannot be empty".to_string()),
        };
    }
    
    info!("Successfully processed input");
    MyResult {
        success: true,
        data: Some(format!("Processed: {}", input)),
        error: None,
    }
}
```

## 🛡️ 安全考虑

### 1. 输入验证

```rust
pub fn validate_input(args: &serde_json::Value) -> Result<String, String> {
    let input = args["input"].as_str()
        .ok_or("Missing input parameter")?;
    
    if input.len() > 1000 {
        return Err("Input too long".to_string());
    }
    
    if input.contains("../") {
        return Err("Invalid input: path traversal detected".to_string());
    }
    
    Ok(input.to_string())
}
```

### 2. 内存安全

```rust
// 确保正确释放内存
#[no_mangle]
pub extern "C" fn plugin_free_string(ptr: *mut i8) {
    if !ptr.is_null() {
        unsafe {
            // 重新获取所有权并自动释放
            let _ = CString::from_raw(ptr);
        }
    }
}

// 避免内存泄漏
pub fn safe_string_return(result: String) -> *mut i8 {
    match CString::new(result) {
        Ok(cstring) => cstring.into_raw(),
        Err(_) => {
            // 返回错误信息而不是空指针
            let error = CString::new("String conversion error").unwrap();
            error.into_raw()
        }
    }
}
```

## 🐛 调试技巧

### 1. 启用调试输出

```rust
#[cfg(debug_assertions)]
macro_rules! debug_print {
    ($($arg:tt)*) => {
        eprintln!("[DEBUG] {}", format!($($arg)*));
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_print {
    ($($arg:tt)*) => {};
}
```

### 2. 错误追踪

```rust
use std::backtrace::Backtrace;

pub fn handle_error(error: &dyn std::error::Error) -> String {
    let backtrace = Backtrace::capture();
    format!("Error: {}\nBacktrace:\n{}", error, backtrace)
}
```

## 📦 部署和分发

### 1. 构建脚本

```bash
#!/bin/bash
# build.sh

echo "Building plugin backend..."
cd backend
cargo build --release

echo "Copying binary..."
cp target/release/plugin.dll ../

echo "Build complete!"
```

### 2. 跨平台编译

```bash
# 为不同平台编译
rustup target add x86_64-pc-windows-gnu
rustup target add x86_64-apple-darwin
rustup target add x86_64-unknown-linux-gnu

# 编译
cargo build --release --target x86_64-pc-windows-gnu
cargo build --release --target x86_64-apple-darwin
cargo build --release --target x86_64-unknown-linux-gnu
```

## 🎯 最佳实践

1. **保持接口简单**：使用 JSON 进行数据交换
2. **错误处理完整**：总是返回结构化的错误信息
3. **内存管理严格**：确保所有分配的内存都被正确释放
4. **性能优化**：使用 release 模式编译，启用 LTO
5. **文档完整**：为每个导出函数编写清晰的文档
6. **测试充分**：编写单元测试和集成测试
7. **版本兼容**：保持 API 向后兼容

## 🔗 参考资源

- [Rust 官方文档](https://doc.rust-lang.org/)
- [serde 序列化指南](https://serde.rs/)
- [FFI 安全指南](https://doc.rust-lang.org/nomicon/ffi.html)
- [插件系统架构文档](./docs/plugin-architecture-complete.md)

通过遵循本指南，你可以创建高性能、安全可靠的插件后端，为用户提供强大的功能扩展。