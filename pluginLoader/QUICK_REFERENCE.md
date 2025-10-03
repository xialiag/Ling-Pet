# 插件系统快速参考

## 常用命令

```bash
# 创建插件
node tools/plugin-cli.js create <name>

# 构建插件
node tools/plugin-cli.js build <name>

# 构建所有插件
node tools/plugin-cli.js build

# 验证插件
node tools/plugin-cli.js validate <name>

# 列出所有插件
node tools/plugin-cli.js list

# 开发模式（热加载）
npm run dev
```

## 插件结构

```
my-plugin/
├── package.json          # 必需：元数据
├── index.ts             # 必需：入口
├── components/          # 可选：Vue组件
├── assets/              # 可选：内置资源
└── backend/             # 可选：Rust后端
    ├── Cargo.toml
    └── src/lib.rs
```

## 插件入口模板

```typescript
import { PluginAPI } from '../../types/api';

export default function(api: PluginAPI) {
  return {
    async activate() {
      // 初始化
    },
    async deactivate() {
      // 清理
    }
  };
}
```

## API 速查

### 路径

```typescript
api.paths.getPluginDir()      // 插件目录
api.paths.getAssetsDir()      // 资源目录（只读）
api.paths.getDataDir()        // 数据目录（可写）
api.paths.getCacheDir()       // 缓存目录
api.paths.getConfigPath()     // 配置文件
api.paths.getLogDir()         // 日志目录
api.paths.getPluginBackend()  // 后端库路径
```

### Hook

```typescript
// 注册
api.hooks.register('hook.name', async (context) => {
  return context;
});

// 取消注册
api.hooks.unregister('hook.name', handler);
```

### 组件

```typescript
// 注册
api.components.register('MyComponent', {
  component: () => import('./components/MyComponent.vue')
});

// 取消注册
api.components.unregister('MyComponent');
```

### 后端

```typescript
// 加载
const backend = await api.backend.load();

// 调用
const result = await backend.call('method', params);

// 卸载
await api.backend.unload();
```

### 存储

```typescript
// 保存
await api.storage.set('key', value);

// 读取
const value = await api.storage.get('key');

// 删除
await api.storage.delete('key');

// 获取所有
const all = await api.storage.getAll();
```

### 工具

```typescript
api.tools.register({
  name: 'toolName',
  description: '工具描述',
  parameters: {
    param1: { type: 'string', required: true }
  },
  handler: async (params) => {
    return { result: 'success' };
  }
});
```

### UI

```typescript
// 通知
api.ui.showNotification('消息');

// 对话框
const result = await api.ui.showDialog({
  title: '标题',
  message: '内容'
});
```

### 日志

```typescript
api.logger.info('信息');
api.logger.warn('警告');
api.logger.error('错误');
api.logger.debug('调试');
```

## Rust 后端模板

```rust
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    to_c_string(r#"{"status":"ok"}"#.to_string())
}

#[no_mangle]
pub extern "C" fn plugin_call(
    method: *const c_char,
    params: *const c_char
) -> *mut c_char {
    let method = from_c_string(method);
    let params = from_c_string(params);
    
    let result = match method.as_str() {
        "your_method" => your_method(&params),
        _ => Err("Unknown method".to_string())
    };
    
    to_c_string(serialize_result(result))
}

#[no_mangle]
pub extern "C" fn plugin_free_string(s: *mut c_char) {
    unsafe {
        if !s.is_null() {
            CString::from_raw(s);
        }
    }
}

#[no_mangle]
pub extern "C" fn plugin_cleanup() {}

fn your_method(params: &str) -> Result<String, String> {
    // 实现逻辑
    Ok(r#"{"result":"success"}"#.to_string())
}

fn from_c_string(ptr: *const c_char) -> String {
    unsafe {
        CStr::from_ptr(ptr).to_string_lossy().into_owned()
    }
}

fn to_c_string(s: String) -> *mut c_char {
    CString::new(s).unwrap().into_raw()
}

fn serialize_result<T: Serialize>(result: Result<T, String>) -> String {
    match result {
        Ok(data) => serde_json::json!({
            "status": "ok",
            "data": data
        }).to_string(),
        Err(error) => serde_json::json!({
            "status": "error",
            "error": error
        }).to_string()
    }
}
```

## package.json 模板

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "pluginId": "my-plugin",
  "displayName": "我的插件",
  "description": "插件描述",
  "main": "index.js",
  "author": "Your Name",
  
  "plugin": {
    "apiVersion": "1.0.0",
    "minAppVersion": "1.0.0",
    "capabilities": {
      "hooks": true,
      "components": true,
      "backend": true,
      "tools": true
    },
    "permissions": [
      "network",
      "storage",
      "ui"
    ],
    "backend": {
      "type": "rust",
      "entry": "backend/plugin.dll"
    }
  }
}
```

## 常见 Hook

```typescript
// 消息相关
'message.send'           // 消息发送前
'message.received'       // 消息接收后
'message.render'         // 消息渲染时

// 组件相关
'component.mounted'      // 组件挂载
'component.updated'      // 组件更新
'component.unmounted'    // 组件卸载

// 应用相关
'app.ready'             // 应用就绪
'app.beforeQuit'        // 应用退出前
```

## 目录位置

### 开发环境

```
插件: project/pluginLoader/plugins/
数据: project/plugin-data/
```

### 生产环境

```
插件: app/plugins/

数据:
- Windows: %APPDATA%/YourApp/plugin-data/
- macOS: ~/Library/Application Support/YourApp/plugin-data/
- Linux: ~/.config/yourapp/plugin-data/
```

## 构建命令

```bash
# 前端
tsc

# 后端
cd backend
cargo build --release

# Windows
target/release/plugin.dll

# macOS
target/release/libplugin.dylib

# Linux
target/release/libplugin.so
```

## 故障排查

```bash
# TypeScript 编译错误
npm install
tsc --noEmit

# Rust 编译错误
cargo clean
cargo build --release

# 后端加载失败
# 检查文件是否存在
ls backend/target/release/

# 热加载不工作
# 确认开发环境
echo $NODE_ENV  # 应该是 development

# 安装 chokidar
npm install chokidar
```

## 调试技巧

```typescript
// 使用日志
api.logger.info('调试信息', data);

// 检查路径
console.log('插件目录:', api.paths.getPluginDir());
console.log('数据目录:', api.paths.getDataDir());

// 检查后端
const backend = api.backend.getBackend();
console.log('后端可用:', backend !== undefined);

// 检查配置
const config = await api.storage.get('config');
console.log('配置:', config);
```

## 性能优化

```rust
// Cargo.toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

```typescript
// 延迟加载组件
component: () => import('./components/Heavy.vue')

// 缓存数据
const cacheDir = api.paths.getCacheDir();
await saveCache(path.join(cacheDir, 'data.json'), data);
```

## 相关文档

- 完整架构：`docs/plugin-loader-final-architecture.md`
- 开发指南：`docs/plugin-development-guide.md`
- 构建部署：`pluginLoader/BUILD_AND_DEPLOY.md`
- 完整示例：`pluginLoader/plugins/demo-complete/`

