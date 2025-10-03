# 插件加载器完整架构设计

## 概述

本文档详细说明插件加载器的完整架构设计，解决以下核心问题：
1. **插件和主程序分别编译后的路径问题**
2. **插件热加载机制**
3. **编译后如何注入**
4. **插件架构设计**（加载、Hook、后端交互、路径管理）

---

## 1. 路径管理架构（问题1解决方案）

### 1.1 核心设计原则

- **分离原则**：插件代码（只读）与插件数据（可写）完全分离
- **跨平台**：自动适配 Windows/macOS/Linux 路径规范
- **环境感知**：开发环境和生产环境使用不同路径策略

### 1.2 目录结构

```
开发环境：
project/
├── pluginLoader/plugins/         # 插件源码
│   └── bilibili-emoji/
│       ├── index.ts
│       ├── assets/              # 内置资源
│       └── backend/src/         # Rust源码
└── plugin-data/                 # 开发数据

生产环境：
app/
├── main-app.exe
├── plugins/                     # 插件安装目录（只读）
│   └── bilibili-emoji/
│       ├── index.js            # 编译后
│       ├── assets/             # 内置资源（只读）
│       └── backend/plugin.dll  # 编译后
└── [用户数据目录]/plugin-data/  # 用户数据（可写）
    └── bilibili-emoji/
        ├── config.json
        ├── cache/
        └── user-data/

用户数据目录位置：
- Windows: %APPDATA%/YourApp/plugin-data
- macOS: ~/Library/Application Support/YourApp/plugin-data
- Linux: ~/.config/yourapp/plugin-data
```

### 1.3 PathResolver 实现

已实现在 `pluginLoader/core/pathResolver.ts`，提供：

```typescript
// 插件安装目录（只读）
getPluginDir(pluginId): string
getPluginEntry(pluginId): string
getPluginAssetsDir(pluginId): string
getPluginBackend(pluginId): string

// 插件数据目录（可写）
getPluginDataDir(pluginId): string
getPluginConfig(pluginId): string
getPluginCacheDir(pluginId): string
getPluginLogDir(pluginId): string

// 环境判断
isDevelopment(): boolean
```

### 1.4 路径使用示例

```typescript
// 插件代码中
export default function(api: PluginAPI) {
  return {
    async activate() {
      // 读取内置资源（只读）
      const assetsDir = api.paths.getAssetsDir();
      const emojiData = await readFile(path.join(assetsDir, 'emojis.json'));
      
      // 读写用户数据（可写）
      const dataDir = api.paths.getDataDir();
      const userEmojis = await readFile(path.join(dataDir, 'user-emojis.json'));
      
      // 缓存数据
      const cacheDir = api.paths.getCacheDir();
      await writeFile(path.join(cacheDir, 'temp.dat'), data);
    }
  };
}
```

---

## 2. 热加载机制（问题2解决方案）

### 2.1 设计原则

- **仅开发环境**：生产环境禁用热加载
- **文件监听**：使用 chokidar 监听插件目录变化
- **防抖处理**：避免频繁重载
- **模块缓存清理**：确保加载最新代码

### 2.2 热加载流程

```
文件变化 → 防抖(500ms) → 清除缓存 → 卸载插件 → 重新加载 → 通知UI
```

### 2.3 实现细节

已实现在 `pluginLoader/core/hotReload.ts`：

```typescript
export class HotReloadManager {
  // 启用热加载（仅开发环境）
  enableHotReload(pluginId: string): void {
    if (!isDevelopment()) return;
    
    const watcher = chokidar.watch(pluginDir, {
      ignored: /(^|[\/\\])\../,
      awaitWriteFinish: { stabilityThreshold: 300 }
    });
    
    watcher.on('change', (file) => {
      this.debounceReload(pluginId);
    });
  }
  
  // 重新加载插件
  private async reloadPlugin(pluginId: string) {
    // 1. 清除 Node.js 模块缓存
    this.clearModuleCache(pluginId);
    
    // 2. 卸载插件
    await pluginLoader.unloadPlugin(pluginId);
    
    // 3. 重新加载
    await pluginLoader.loadPlugin(pluginId);
  }
}
```

### 2.4 使用方式

```typescript
// 开发环境自动启用
const loader = new EnhancedPluginLoader();
await loader.initialize(); // 自动为所有插件启用热加载

// 监听重载事件
loader.on('plugin-reloaded', (pluginId) => {
  console.log(`插件 ${pluginId} 已重载`);
  // 通知UI更新
});
```

---

## 3. 编译后注入机制（问题3解决方案）

### 3.1 注入策略

采用**多层注入**策略：

1. **构建时注入**：编译时将插件打包到输出目录
2. **启动时注入**：主程序启动时加载插件加载器
3. **运行时注入**：动态加载和卸载插件

### 3.2 构建时注入

#### 3.2.1 主程序构建配置

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // 插件加载器不打包进主程序
        /^pluginLoader\/.*/
      ]
    }
  },
  
  plugins: [
    {
      name: 'plugin-builder',
      closeBundle() {
        // 构建完成后处理插件
        buildAndCopyPlugins();
      }
    }
  ]
});
```

#### 3.2.2 插件构建脚本

```javascript
// pluginLoader/tools/build-plugin.js
async function buildPlugin(pluginName) {
  const pluginDir = path.join('pluginLoader', 'plugins', pluginName);
  const outputDir = path.join('dist', 'plugins', pluginName);
  
  // 1. 编译 TypeScript
  execSync('tsc', { cwd: pluginDir });
  
  // 2. 编译 Rust 后端
  const backendDir = path.join(pluginDir, 'backend');
  if (fs.existsSync(backendDir)) {
    execSync('cargo build --release', { cwd: backendDir });
    
    // 复制编译后的动态库
    const libExt = process.platform === 'win32' ? '.dll' : 
                   process.platform === 'darwin' ? '.dylib' : '.so';
    fs.copySync(
      path.join(backendDir, 'target', 'release', `libplugin${libExt}`),
      path.join(outputDir, 'backend', `plugin${libExt}`)
    );
  }
  
  // 3. 复制资源和元数据
  fs.copySync(pluginDir, outputDir, {
    filter: (src) => {
      // 只复制必要文件
      return !src.includes('node_modules') &&
             !src.includes('.ts') &&
             !src.includes('backend/src');
    }
  });
}
```

### 3.3 启动时注入

```typescript
// src/main.ts (主程序入口)
import { EnhancedPluginLoader } from '../pluginLoader/core/enhancedPluginLoader';

async function initializeApp() {
  // 初始化插件加载器
  const pluginLoader = new EnhancedPluginLoader();
  await pluginLoader.initialize();
  
  // 将加载器暴露给全局
  (window as any).__PLUGIN_LOADER__ = pluginLoader;
  
  // 初始化主应用
  const app = createApp(App);
  
  // 将 Vue 实例传递给插件系统
  pluginLoader.setVueApp(app);
  
  app.mount('#app');
}
```

### 3.4 运行时动态注入

```typescript
// pluginLoader/core/runtimeInjection.ts
export class RuntimeInjection {
  // 注入插件到渲染进程
  async injectPlugin(pluginId: string): Promise<void> {
    const pluginEntry = pathResolver.getPluginEntry(pluginId);
    const pluginCode = fs.readFileSync(pluginEntry, 'utf-8');
    
    // 包装插件代码，提供隔离环境
    const wrappedCode = `
      (function(pluginAPI) {
        ${pluginCode}
        
        // 执行插件
        if (typeof module.exports.default === 'function') {
          return module.exports.default(pluginAPI);
        }
      })(window.__PLUGIN_API__);
    `;
    
    // 在当前上下文执行
    eval(wrappedCode);
  }
}
```

---

## 4. 插件架构设计（问题4解决方案）

### 4.1 插件标准结构

```
plugin-name/
├── package.json              # 插件元数据
├── index.ts/js              # 插件入口
├── register.ts              # 注册钩子和组件（可选）
├── components/              # Vue组件
│   └── MyComponent.vue
├── assets/                  # 内置资源（只读）
│   ├── icons/
│   ├── images/
│   └── data/
└── backend/                 # Rust后端（可选）
    ├── Cargo.toml
    ├── src/
    │   └── lib.rs
    └── [编译后] plugin.dll/.so/.dylib
```

### 4.2 插件元数据（package.json）

```json
{
  "name": "bilibili-emoji",
  "version": "1.0.0",
  "pluginId": "bilibili-emoji",
  "displayName": "Bilibili表情包",
  "description": "提供Bilibili表情包功能",
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

### 4.3 插件入口实现

```typescript
// pluginLoader/plugins/example/index.ts
import { PluginAPI } from '../../types/api';

export default function(api: PluginAPI) {
  let backend: any = null;
  
  return {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    
    // 插件激活
    async activate() {
      // 1. 初始化后端
      backend = await api.backend.load();
      
      // 2. 注册钩子
      api.hooks.register('message.send', async (context) => {
        // 调用后端处理
        const result = await backend.call('process_message', {
          message: context.message
        });
        context.message = result.processed;
        return context;
      });
      
      // 3. 注册组件
      api.components.register('EmojiPicker', {
        component: () => import('./components/EmojiPicker.vue')
      });
      
      // 4. 注册工具
      api.tools.register({
        name: 'searchEmoji',
        description: '搜索表情包',
        parameters: {
          keyword: { type: 'string', required: true }
        },
        handler: async (params) => {
          return await backend.call('search_emoji', params);
        }
      });
      
      // 5. 加载配置
      const config = await api.storage.get('config') || {};
      
      api.logger.info('Plugin activated');
    },
    
    // 插件停用
    async deactivate() {
      if (backend) {
        await api.backend.unload();
      }
      api.logger.info('Plugin deactivated');
    }
  };
}
```

### 4.4 Hook系统

```typescript
// 插件中注册Hook
api.hooks.register('message.send', async (context) => {
  // 修改消息内容
  context.message = processMessage(context.message);
  return context;
});

api.hooks.register('component.mounted', async (context) => {
  // 组件挂载后执行
  if (context.componentName === 'ChatWindow') {
    // 注入自定义UI
  }
});

// 主程序中触发Hook
const result = await hookEngine.trigger('message.send', {
  message: 'Hello',
  sender: 'user'
});
```

### 4.5 Rust后端架构

#### 4.5.1 后端接口定义

```rust
// pluginLoader/plugins/example/backend/src/lib.rs
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

// 插件初始化
#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    let response = serde_json::json!({
        "status": "ok",
        "version": "1.0.0"
    });
    to_c_string(response.to_string())
}

// 调用插件方法
#[no_mangle]
pub extern "C" fn plugin_call(
    method: *const c_char,
    params: *const c_char
) -> *mut c_char {
    let method = from_c_string(method);
    let params = from_c_string(params);
    
    let result = match method.as_str() {
        "search_emoji" => search_emoji(&params),
        "process_message" => process_message(&params),
        _ => Err("Unknown method".to_string())
    };
    
    to_c_string(serialize_result(result))
}

// 释放字符串
#[no_mangle]
pub extern "C" fn plugin_free_string(s: *mut c_char) {
    unsafe {
        if !s.is_null() {
            CString::from_raw(s);
        }
    }
}

// 插件清理
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    // 清理资源
}

// 业务逻辑
fn search_emoji(params: &str) -> Result<String, String> {
    let req: SearchRequest = serde_json::from_str(params)
        .map_err(|e| e.to_string())?;
    
    // 实现搜索逻辑
    let results = vec!["emoji1", "emoji2"];
    
    Ok(serde_json::to_string(&results).unwrap())
}
```

#### 4.5.2 前端调用后端

```typescript
// 插件中
const backend = await api.backend.load();

// 调用后端方法
const result = await backend.call('search_emoji', {
  keyword: '笑'
});

// 清理
await api.backend.unload();
```

### 4.6 数据目录和工具目录管理

```typescript
// 插件中访问不同目录
export default function(api: PluginAPI) {
  return {
    async activate() {
      // 1. 内置资源（只读）
      const assetsDir = api.paths.getAssetsDir();
      const defaultEmojis = await loadJSON(
        path.join(assetsDir, 'default-emojis.json')
      );
      
      // 2. 用户数据（可写）
      const dataDir = api.paths.getDataDir();
      const userEmojis = await loadJSON(
        path.join(dataDir, 'user-emojis.json')
      );
      
      // 3. 缓存数据
      const cacheDir = api.paths.getCacheDir();
      await saveCache(
        path.join(cacheDir, 'emoji-cache.dat'),
        cacheData
      );
      
      // 4. 配置文件
      const configPath = api.paths.getConfigPath();
      const config = await loadJSON(configPath);
      
      // 5. 日志文件
      const logDir = api.paths.getLogDir();
      const logger = createLogger(path.join(logDir, 'plugin.log'));
      
      // 6. 后端工具
      const backendPath = api.paths.getPluginBackend();
      const backend = await loadBackend(backendPath);
    }
  };
}
```

---

## 5. 完整的插件API

```typescript
export interface PluginAPI {
  // 路径管理
  paths: {
    getPluginDir(): string;           // 插件安装目录
    getAssetsDir(): string;           // 内置资源目录（只读）
    getDataDir(): string;             // 用户数据目录（可写）
    getCacheDir(): string;            // 缓存目录
    getConfigPath(): string;          // 配置文件路径
    getLogDir(): string;              // 日志目录
    getPluginBackend(): string;       // 后端库路径
  };
  
  // Hook系统
  hooks: {
    register(name: string, handler: Function): void;
    unregister(name: string, handler: Function): void;
  };
  
  // 组件系统
  components: {
    register(name: string, component: any): void;
    unregister(name: string): void;
  };
  
  // 工具系统
  tools: {
    register(tool: ToolDefinition): void;
    unregister(toolName: string): void;
  };
  
  // 后端管理
  backend: {
    load(): Promise<PluginBackend>;
    unload(): Promise<void>;
    getBackend(): PluginBackend | undefined;
  };
  
  // 存储API
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    getAll(): Promise<Record<string, any>>;
    setAll(data: Record<string, any>): Promise<void>;
  };
  
  // UI API
  ui: {
    showNotification(message: string): void;
    showDialog(options: DialogOptions): Promise<any>;
  };
  
  // 日志API
  logger: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
  };
}
```

---

## 6. 构建和部署流程

### 6.1 开发流程

```bash
# 1. 创建插件
cd pluginLoader
node tools/plugin-cli.js create my-plugin

# 2. 开发插件
cd plugins/my-plugin
# 编辑 index.ts, components/, backend/

# 3. 开发时自动热加载
npm run dev  # 主程序启动，插件自动热加载

# 4. 构建插件
node tools/plugin-cli.js build my-plugin
```

### 6.2 生产构建

```bash
# 1. 构建主程序
npm run build

# 2. 构建所有插件
node pluginLoader/tools/build-plugin.js

# 3. 打包应用
npm run package  # 使用 electron-builder 等工具
```

### 6.3 部署结构

```
app/
├── main-app.exe
├── resources/
├── plugins/                    # 预装插件
│   ├── bilibili-emoji/
│   └── llm-service/
└── [安装器会创建用户数据目录]
```

---

## 7. macOS 兼容性

### 7.1 路径适配

```typescript
// PathResolver 已自动处理 macOS 路径
getUserDataPath(): string {
  const platform = process.platform;
  const home = process.env.HOME || '';
  
  switch (platform) {
    case 'darwin':  // macOS
      return path.join(home, 'Library', 'Application Support', 'YourApp');
    case 'win32':
      return path.join(process.env.APPDATA, 'YourApp');
    default:  // Linux
      return path.join(home, '.config', 'yourapp');
  }
}
```

### 7.2 后端库命名

```typescript
// 自动适配不同平台的库文件扩展名
getPluginBackend(pluginId: string): string {
  const ext = process.platform === 'win32' ? '.dll' : 
              process.platform === 'darwin' ? '.dylib' :  // macOS
              '.so';
  const prefix = process.platform === 'win32' ? '' : 'lib';
  return path.join(backendDir, `${prefix}plugin${ext}`);
}
```

### 7.3 Rust 后端编译

```bash
# macOS 编译命令
cd backend
cargo build --release --target x86_64-apple-darwin    # Intel Mac
cargo build --release --target aarch64-apple-darwin   # Apple Silicon

# 输出: target/release/libplugin.dylib
```

---

## 8. 总结

### 8.1 四个核心问题的解决方案

| 问题 | 解决方案 | 实现位置 |
|------|---------|---------|
| 1. 路径问题 | PathResolver 统一管理，分离只读/可写目录 | `core/pathResolver.ts` |
| 2. 热加载 | HotReloadManager 监听文件变化，自动重载 | `core/hotReload.ts` |
| 3. 编译注入 | 构建脚本 + 运行时加载器 | `tools/build-plugin.js` + `core/enhancedPluginLoader.ts` |
| 4. 插件架构 | 标准化结构 + 完整API + Rust后端集成 | `types/api.ts` + 各核心模块 |

### 8.2 关键特性

- ✅ 跨平台支持（Windows/macOS/Linux）
- ✅ 开发/生产环境自动适配
- ✅ 热加载（仅开发环境）
- ✅ 前后端分离架构
- ✅ 资源和数据目录分离
- ✅ 完整的生命周期管理
- ✅ Hook和组件注入
- ✅ Rust后端FFI集成

### 8.3 下一步

1. 完善插件权限系统
2. 添加插件市场支持
3. 实现插件依赖管理
4. 增强安全沙箱
5. 添加插件性能监控

