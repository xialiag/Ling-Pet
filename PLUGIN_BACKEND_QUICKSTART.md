# 插件后端快速开始

## 5 分钟创建带后端的插件

### 1. 创建插件结构

```bash
mkdir -p pluginLoader/plugins/my-plugin/backend/src
cd pluginLoader/plugins/my-plugin
```

### 2. 创建 Cargo.toml

```toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
name = "plugin"
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 3. 创建 lib.rs

```rust
use serde::{Serialize, Deserialize};
use std::ffi::{CStr, CString};

#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[My Plugin] Initialized!");
}

#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[My Plugin] Cleanup!");
}

#[no_mangle]
pub extern "C" fn my_function(input_json: *const i8) -> *mut i8 {
    let input = unsafe {
        CStr::from_ptr(input_json).to_str().unwrap()
    };
    
    let result = format!("Hello from Rust: {}", input);
    CString::new(result).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn free_string(ptr: *mut i8) {
    if !ptr.is_null() {
        unsafe { let _ = CString::from_raw(ptr); }
    }
}
```

### 4. 创建 package.json

```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.ts",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll"
  },
  "permissions": ["storage:read"]
}
```

### 5. 创建 index.ts

```typescript
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    
    async onLoad(context) {
        context.debug('Plugin loaded!')
        
        // 调用后端函数
        const result = await context.invokeTauri('my_plugin_function', {
            input: 'Hello'
        })
        
        context.debug('Result:', result)
    }
})
```

### 6. 构建

```bash
# 回到项目根目录
cd ../../..

# 构建插件（自动编译 Rust 后端）
npm run plugin:release my-plugin
```

### 7. 输出

```
releases/plugins/
└── my-plugin-1.0.0-win32.zip
    ├── manifest.json
    ├── index.js
    └── backend/
        └── plugin.dll
```

## 完成！

你的插件现在包含：
- ✅ TypeScript 前端
- ✅ Rust 后端
- ✅ 自动构建
- ✅ 热加载支持

## 下一步

1. 在主应用中实现 Tauri 命令桥接
2. 添加更多后端功能
3. 测试和调试

参考完整文档：
- [集成指南](PLUGIN_BACKEND_INTEGRATION.md)
- [Bilibili Emoji 示例](BILIBILI_EMOJI_BACKEND_COMPLETE.md)
