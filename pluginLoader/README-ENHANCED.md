# 增强的插件加载器

完整的生产环境插件加载器实现，支持热加载、Rust后端、路径管理等功能。

## 核心特性

### 1. 路径管理 (PathResolver)
- ✅ 自动识别开发/生产环境
- ✅ 统一管理插件目录、数据目录、资源目录
- ✅ 分离只读资源（assets）和可写数据（plugin-data）
- ✅ 跨平台路径支持

### 2. 热加载 (HotReloadManager)
- ✅ 开发时自动监听文件变化
- ✅ 自动清除模块缓存并重新加载
- ✅ 防抖处理避免频繁重载
- ✅ 仅在开发环境启用

### 3. 后端加载 (BackendLoader)
- ✅ 加载Rust编译的动态库（.dll/.so/.dylib）
- ✅ FFI接口调用
- ✅ 跨平台支持
- ✅ 自动内存管理

### 4. 存储管理 (StorageManager)
- ✅ 插件数据持久化
- ✅ 配置文件管理
- ✅ 内存缓存优化
- ✅ JSON格式存储

### 5. 运行时注入 (RuntimeInjection)
- ✅ 动态注入插件到渲染进程
- ✅ 隔离的执行环境
- ✅ Electron preload支持

## 目录结构

```
开发环境：
project/
├── pluginLoader/
│   ├── core/                    # 核心模块
│   │   ├── enhancedPluginLoader.ts
│   │   ├── pathResolver.ts
│   │   ├── backendLoader.ts
│   │   ├── storageManager.ts
│   │   ├── hotReload.ts
│   │   └── runtimeInjection.ts
│   ├── plugins/                 # 插件源码
│   │   └── example-plugin/
│   │       ├── index.ts
│   │       ├── package.json
│   │       └── backend/
│   ├── types/
│   │   └── api.ts
│   └── tools/
│       └── build-plugin.js
└── plugin-data/                 # 插件数据（开发）

生产环境：
app/
├── main-app.exe
├── plugins/                     # 插件（编译后）
│   └── example-plugin/
│       ├── index.js
│       ├── package.json
│       ├── assets/
│       └── backend/
│           └── plugin.dll
└── [AppData]/plugin-data/       # 插件数据（生产）
```

## 快速开始

### 1. 安装依赖

```bash
npm install
npm install chokidar ffi-napi ref-napi  # 可选，用于热加载和后端支持
```

### 2. 创建插件

```bash
# 使用示例插件作为模板
cp -r pluginLoader/plugins/example-plugin pluginLoader/plugins/my-plugin
cd pluginLoader/plugins/my-plugin
```

### 3. 编辑插件

```typescript
// index.ts
import { PluginAPI, PluginContextV2 } from '../../types/api';

export default function(api: PluginAPI): PluginContextV2 {
  return {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',

    async activate() {
      api.logger.info('Plugin activated');
      
      // 注册钩子
      api.hooks.register('message.send', async (context) => {
        // 处理逻辑
        return context;
      });
      
      // 注册工具
      api.tools.register({
        name: 'myTool',
        description: 'My custom tool',
        parameters: {
          input: { type: 'string', required: true }
        },
        handler: async (params) => {
          return { result: params.input };
        }
      });
    },

    async deactivate() {
      api.logger.info('Plugin deactivated');
    }
  };
}
```

### 4. 编译插件

```bash
# 编译TypeScript
tsc

# 编译Rust后端（如果有）
cd backend
cargo build --release
cd ..

# 或使用构建工具
node ../../tools/build-plugin.js my-plugin
```

### 5. 在主程序中使用

```typescript
import { EnhancedPluginLoader } from './pluginLoader/core/enhancedPluginLoader';

async function main() {
  const pluginLoader = new EnhancedPluginLoader();
  
  // 监听事件
  pluginLoader.on('plugin-loaded', (pluginId) => {
    console.log(`Plugin loaded: ${pluginId}`);
  });
  
  // 初始化（自动加载所有插件）
  await pluginLoader.initialize();
  
  // 触发钩子
  const hookEngine = pluginLoader.getHookEngine();
  await hookEngine.executeHook('message.send', { message: 'Hello' });
  
  // 调用工具
  const toolManager = pluginLoader.getToolManager();
  const result = await toolManager.executeTool('myTool', { input: 'test' });
}
```

## Rust后端开发

### 1. 创建Cargo项目

```toml
# backend/Cargo.toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 2. 实现FFI接口

```rust
// backend/src/lib.rs
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    let response = serde_json::json!({
        "status": "ok",
        "message": "Plugin initialized"
    });
    CString::new(response.to_string()).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn plugin_call(
    method: *const c_char,
    params: *const c_char
) -> *mut c_char {
    // 实现方法调用
    // ...
}

#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    // 清理资源
}
```

### 3. 在插件中调用后端

```typescript
async activate() {
  const backend = await api.backend.load();
  const result = await backend.call('myMethod', { param: 'value' });
  api.logger.info('Backend result:', result);
}
```

## API参考

### PathResolver

```typescript
const pathResolver = PathResolver.getInstance();

// 获取插件目录
pathResolver.getPluginDir('my-plugin');

// 获取资源目录（只读）
pathResolver.getPluginAssetsDir('my-plugin');

// 获取数据目录（可写）
pathResolver.getPluginDataDir('my-plugin');

// 获取后端库路径
pathResolver.getPluginBackend('my-plugin');
```

### StorageManager

```typescript
// 保存数据
await api.storage.set('key', { value: 123 });

// 读取数据
const data = await api.storage.get('key');

// 删除数据
await api.storage.delete('key');

// 获取所有数据
const all = await api.storage.getAll();
```

### BackendLoader

```typescript
// 加载后端
const backend = await api.backend.load();

// 调用方法
const result = await backend.call('methodName', { param: 'value' });

// 卸载后端
await api.backend.unload();
```

## 构建和部署

### 开发模式

```bash
# 启动开发服务器（自动热加载）
npm run dev
```

### 生产构建

```bash
# 构建所有插件
node pluginLoader/tools/build-plugin.js

# 构建主程序
npm run build

# 输出结构：
# dist/
# ├── main-app.exe
# └── plugins/
#     └── my-plugin/
#         ├── index.js
#         ├── package.json
#         └── backend/
#             └── plugin.dll
```

## 调试

### 启用详细日志

```typescript
const pluginLoader = new EnhancedPluginLoader();
pluginLoader.on('plugin-loaded', console.log);
pluginLoader.on('plugin-unloaded', console.log);
pluginLoader.on('reload-error', console.error);
```

### 查看插件状态

```typescript
// 获取所有插件
const plugins = pluginLoader.getAllPlugins();

// 获取插件元数据
const metadata = pluginLoader.getPluginMetadata('my-plugin');

// 获取插件实例
const plugin = pluginLoader.getPlugin('my-plugin');
```

## 常见问题

### Q: 热加载不工作？
A: 确保安装了chokidar：`npm install chokidar`，并且在开发环境运行。

### Q: 后端加载失败？
A: 确保安装了ffi-napi和ref-napi：`npm install ffi-napi ref-napi`

### Q: 路径找不到？
A: 检查PathResolver的配置，确保插件目录存在。

### Q: 如何调试Rust后端？
A: 使用`cargo build`编译，查看编译错误。在代码中添加日志输出。

## 许可证

MIT
