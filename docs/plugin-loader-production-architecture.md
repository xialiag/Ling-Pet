# 插件加载器生产环境架构设计

## 1. 编译后路径问题解决方案

### 1.1 目录结构设计

```
生产环境目录结构：
app/
├── main-app.exe                    # 主程序
├── resources/
│   └── app.asar                    # 主程序打包资源
├── plugins/                        # 插件目录
│   ├── bilibili-emoji/
│   │   ├── index.js               # 插件入口（编译后）
│   │   ├── package.json           # 插件元数据
│   │   ├── assets/                # 插件资源
│   │   │   └── emojis/
│   │   └── backend/               # Rust后端
│   │       └── plugin.dll/.so/.dylib
│   └── llm-service/
│       ├── index.js
│       ├── package.json
│       └── backend/
│           └── plugin.dll
├── plugin-data/                    # 插件数据目录
│   ├── bilibili-emoji/
│   │   ├── config.json
│   │   └── cache/
│   └── llm-service/
│       └── models/
└── logs/
    └── plugins/
```

### 1.2 路径解析器实现

```typescript
// pluginLoader/core/pathResolver.ts
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export class PathResolver {
  private static instance: PathResolver;
  private isDev: boolean;
  private appRoot: string;
  private pluginsRoot: string;
  private dataRoot: string;

  private constructor() {
    this.isDev = !app.isPackaged;
    this.appRoot = this.isDev 
      ? process.cwd() 
      : path.dirname(app.getPath('exe'));
    
    // 插件目录
    this.pluginsRoot = this.isDev
      ? path.join(process.cwd(), 'pluginLoader', 'plugins')
      : path.join(this.appRoot, 'plugins');
    
    // 数据目录（用户可写）
    this.dataRoot = path.join(app.getPath('userData'), 'plugin-data');
    
    this.ensureDirectories();
  }

  static getInstance(): PathResolver {
    if (!PathResolver.instance) {
      PathResolver.instance = new PathResolver();
    }
    return PathResolver.instance;
  }

  private ensureDirectories() {
    [this.pluginsRoot, this.dataRoot].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 获取插件根目录
  getPluginsRoot(): string {
    return this.pluginsRoot;
  }

  // 获取插件安装目录
  getPluginDir(pluginId: string): string {
    return path.join(this.pluginsRoot, pluginId);
  }

  // 获取插件入口文件
  getPluginEntry(pluginId: string): string {
    return path.join(this.getPluginDir(pluginId), 'index.js');
  }

  // 获取插件资源目录（只读）
  getPluginAssetsDir(pluginId: string): string {
    return path.join(this.getPluginDir(pluginId), 'assets');
  }

  // 获取插件后端库路径
  getPluginBackend(pluginId: string): string {
    const backendDir = path.join(this.getPluginDir(pluginId), 'backend');
    const platform = process.platform;
    const ext = platform === 'win32' ? '.dll' : platform === 'darwin' ? '.dylib' : '.so';
    return path.join(backendDir, `plugin${ext}`);
  }

  // 获取插件数据目录（可写）
  getPluginDataDir(pluginId: string): string {
    const dataDir = path.join(this.dataRoot, pluginId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
  }

  // 获取插件配置文件路径
  getPluginConfig(pluginId: string): string {
    return path.join(this.getPluginDataDir(pluginId), 'config.json');
  }

  // 获取插件缓存目录
  getPluginCacheDir(pluginId: string): string {
    const cacheDir = path.join(this.getPluginDataDir(pluginId), 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  // 获取插件日志目录
  getPluginLogDir(pluginId: string): string {
    const logDir = path.join(app.getPath('logs'), 'plugins', pluginId);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  }

  isDevelopment(): boolean {
    return this.isDev;
  }
}
```

## 2. 插件热加载机制

### 2.1 热加载管理器

```typescript
// pluginLoader/core/hotReload.ts
import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { PathResolver } from './pathResolver';
import { PluginLoader } from './pluginLoader';

export class HotReloadManager extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private pathResolver: PathResolver;
  private pluginLoader: PluginLoader;
  private reloadDebounce: Map<string, NodeJS.Timeout> = new Map();

  constructor(pluginLoader: PluginLoader) {
    super();
    this.pathResolver = PathResolver.getInstance();
    this.pluginLoader = pluginLoader;
  }

  // 启用插件热加载
  enableHotReload(pluginId: string) {
    if (!this.pathResolver.isDevelopment()) {
      console.warn('Hot reload is only available in development mode');
      return;
    }

    if (this.watchers.has(pluginId)) {
      return; // 已经在监听
    }

    const pluginDir = this.pathResolver.getPluginDir(pluginId);
    
    const watcher = watch(pluginDir, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    watcher.on('change', (filePath) => {
      this.handleFileChange(pluginId, filePath);
    });

    watcher.on('add', (filePath) => {
      this.handleFileChange(pluginId, filePath);
    });

    this.watchers.set(pluginId, watcher);
    console.log(`[HotReload] Watching plugin: ${pluginId}`);
  }

  // 禁用插件热加载
  disableHotReload(pluginId: string) {
    const watcher = this.watchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(pluginId);
      console.log(`[HotReload] Stopped watching plugin: ${pluginId}`);
    }
  }

  // 处理文件变化
  private handleFileChange(pluginId: string, filePath: string) {
    console.log(`[HotReload] File changed: ${filePath}`);

    // 防抖处理
    const existingTimeout = this.reloadDebounce.get(pluginId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      await this.reloadPlugin(pluginId);
      this.reloadDebounce.delete(pluginId);
    }, 500);

    this.reloadDebounce.set(pluginId, timeout);
  }

  // 重新加载插件
  private async reloadPlugin(pluginId: string) {
    try {
      console.log(`[HotReload] Reloading plugin: ${pluginId}`);
      
      // 1. 清除模块缓存
      this.clearModuleCache(pluginId);
      
      // 2. 卸载插件
      await this.pluginLoader.unloadPlugin(pluginId);
      
      // 3. 重新加载插件
      await this.pluginLoader.loadPlugin(pluginId);
      
      this.emit('plugin-reloaded', pluginId);
      console.log(`[HotReload] Plugin reloaded successfully: ${pluginId}`);
    } catch (error) {
      console.error(`[HotReload] Failed to reload plugin ${pluginId}:`, error);
      this.emit('reload-error', pluginId, error);
    }
  }

  // 清除Node.js模块缓存
  private clearModuleCache(pluginId: string) {
    const pluginDir = this.pathResolver.getPluginDir(pluginId);
    
    Object.keys(require.cache).forEach(key => {
      if (key.startsWith(pluginDir)) {
        delete require.cache[key];
        console.log(`[HotReload] Cleared cache: ${key}`);
      }
    });
  }

  // 清理所有监听器
  cleanup() {
    this.watchers.forEach((watcher, pluginId) => {
      this.disableHotReload(pluginId);
    });
  }
}
```

## 3. 编译后注入机制

### 3.1 构建时注入配置

```typescript
// vite.config.ts 扩展
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // 插件相关模块不打包进主程序
        /^pluginLoader\/.*/
      ]
    }
  },
  
  // 插件构建配置
  plugins: [
    {
      name: 'plugin-builder',
      closeBundle() {
        // 构建完成后，复制插件到输出目录
        copyPluginsToOutput();
      }
    }
  ]
});

function copyPluginsToOutput() {
  const fs = require('fs-extra');
  const path = require('path');
  
  const pluginsSource = path.join(__dirname, 'pluginLoader', 'plugins');
  const pluginsTarget = path.join(__dirname, 'dist', 'plugins');
  
  fs.copySync(pluginsSource, pluginsTarget, {
    filter: (src) => {
      // 只复制编译后的文件
      return !src.includes('.ts') || src.includes('.d.ts');
    }
  });
}
```

### 3.2 运行时动态注入

```typescript
// pluginLoader/core/runtimeInjection.ts
import { BrowserWindow } from 'electron';
import { PathResolver } from './pathResolver';
import fs from 'fs';

export class RuntimeInjection {
  private pathResolver: PathResolver;

  constructor() {
    this.pathResolver = PathResolver.getInstance();
  }

  // 注入插件到渲染进程
  async injectPluginToRenderer(
    window: BrowserWindow,
    pluginId: string
  ): Promise<void> {
    const pluginEntry = this.pathResolver.getPluginEntry(pluginId);
    
    if (!fs.existsSync(pluginEntry)) {
      throw new Error(`Plugin entry not found: ${pluginEntry}`);
    }

    // 读取插件代码
    const pluginCode = fs.readFileSync(pluginEntry, 'utf-8');
    
    // 包装插件代码，提供隔离环境
    const wrappedCode = this.wrapPluginCode(pluginId, pluginCode);
    
    // 注入到渲染进程
    await window.webContents.executeJavaScript(wrappedCode);
  }

  // 包装插件代码
  private wrapPluginCode(pluginId: string, code: string): string {
    return `
      (function() {
        const pluginId = '${pluginId}';
        const pluginModule = { exports: {} };
        const exports = pluginModule.exports;
        
        // 提供插件API
        const pluginAPI = window.__PLUGIN_API__;
        
        // 执行插件代码
        ${code}
        
        // 注册插件
        if (typeof pluginModule.exports.default === 'function') {
          pluginModule.exports.default(pluginAPI);
        }
      })();
    `;
  }

  // 预加载脚本注入
  getPreloadScript(): string {
    return `
      const { contextBridge, ipcRenderer } = require('electron');
      
      // 暴露插件API到渲染进程
      contextBridge.exposeInMainWorld('__PLUGIN_API__', {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, callback) => {
          const subscription = (event, ...args) => callback(...args);
          ipcRenderer.on(channel, subscription);
          return () => ipcRenderer.removeListener(channel, subscription);
        },
        send: (channel, ...args) => ipcRenderer.send(channel, ...args)
      });
    `;
  }
}
```

## 4. 插件架构设计

### 4.1 插件标准结构

```
plugin-name/
├── package.json              # 插件元数据
├── index.js                  # 插件入口（编译后）
├── register.js               # 注册钩子和组件
├── assets/                   # 插件内置资源（只读）
│   ├── icons/
│   ├── images/
│   └── data/
├── backend/                  # Rust后端
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs
│   └── plugin.dll/.so/.dylib # 编译后的动态库
└── README.md
```

### 4.2 插件package.json规范

```json
{
  "name": "bilibili-emoji",
  "version": "1.0.0",
  "pluginId": "bilibili-emoji",
  "displayName": "Bilibili表情包插件",
  "description": "提供Bilibili表情包功能",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  
  "plugin": {
    "apiVersion": "1.0.0",
    "minAppVersion": "1.0.0",
    "
": {
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
import { PluginContext, PluginAPI } from '../../types/api';

export default function(api: PluginAPI) {
  const plugin: PluginContext = {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    
    // 插件激活
    async activate() {
      console.log('Plugin activated');
      
      // 注册钩子
      this.registerHooks();
      
      // 注册组件
      this.registerComponents();
      
      // 注册工具
      this.registerTools();
      
      // 初始化后端
      await this.initBackend();
    },
    
    // 插件停用
    async deactivate() {
      console.log('Plugin deactivated');
      
      // 清理资源
      await this.cleanup();
    },
    
    // 注册钩子
    registerHooks() {
      api.hooks.register('message.send', async (context) => {
        // Hook逻辑
        return context;
      });
    },
    
    // 注册组件
    registerComponents() {
      api.components.register('EmojiPicker', {
        component: () => import('./components/EmojiPicker'),
        props: {}
      });
    },
    
    // 注册工具
    registerTools() {
      api.tools.register({
        name: 'searchEmoji',
        description: '搜索表情包',
        parameters: {
          keyword: { type: 'string', required: true }
        },
        handler: async (params) => {
          return await this.searchEmoji(params.keyword);
        }
      });
    },
    
    // 初始化后端
    async initBackend() {
      const backendPath = api.paths.getPluginBackend(this.id);
      this.backend = await api.backend.load(backendPath);
    },
    
    // 搜索表情包
    async searchEmoji(keyword: string) {
      // 调用Rust后端
      return await this.backend.call('search_emoji', { keyword });
    },
    
    // 清理资源
    async cleanup() {
      if (this.backend) {
        await api.backend.unload(this.backend);
      }
    }
  };
  
  return plugin;
}
```

### 4.4 Rust后端接口

```rust
// pluginLoader/plugins/example/backend/src/lib.rs
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[derive(Deserialize)]
struct SearchRequest {
    keyword: String,
}

#[derive(Serialize)]
struct SearchResponse {
    results: Vec<String>,
}

// 插件初始化
#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    let response = serde_json::json!({
        "status": "ok",
        "message": "Plugin initialized"
    });
    
    CString::new(response.to_string())
        .unwrap()
        .into_raw()
}

// 调用插件方法
#[no_mangle]
pub extern "C" fn plugin_call(
    method: *const c_char,
    params: *const c_char
) -> *mut c_char {
    let method = unsafe { CStr::from_ptr(method).to_str().unwrap() };
    let params = unsafe { CStr::from_ptr(params).to_str().unwrap() };
    
    let result = match method {
        "search_emoji" => search_emoji(params),
        _ => Err("Unknown method".to_string())
    };
    
    let response = match result {
        Ok(data) => serde_json::json!({
            "status": "ok",
            "data": data
        }),
        Err(err) => serde_json::json!({
            "status": "error",
            "error": err
        })
    };
    
    CString::new(response.to_string())
        .unwrap()
        .into_raw()
}

fn search_emoji(params: &str) -> Result<SearchResponse, String> {
    let req: SearchRequest = serde_json::from_str(params)
        .map_err(|e| e.to_string())?;
    
    // 实现搜索逻辑
    let results = vec![
        format!("emoji1_{}", req.keyword),
        format!("emoji2_{}", req.keyword),
    ];
    
    Ok(SearchResponse { results })
}

// 释放字符串内存
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
```

### 4.5 后端加载器

```typescript
// pluginLoader/core/backendLoader.ts
import ffi from 'ffi-napi';
import ref from 'ref-napi';
import { PathResolver } from './pathResolver';

export class BackendLoader {
  private pathResolver: PathResolver;
  private loadedBackends: Map<string, any> = new Map();

  constructor() {
    this.pathResolver = PathResolver.getInstance();
  }

  // 加载Rust后端
  async load(pluginId: string): Promise<PluginBackend> {
    const backendPath = this.pathResolver.getPluginBackend(pluginId);
    
    // 使用FFI加载动态库
    const lib = ffi.Library(backendPath, {
      'plugin_init': ['string', []],
      'plugin_call': ['string', ['string', 'string']],
      'plugin_free_string': ['void', ['string']],
      'plugin_cleanup': ['void', []]
    });

    // 初始化后端
    const initResult = lib.plugin_init();
    console.log(`Backend initialized: ${initResult}`);

    const backend = new PluginBackend(pluginId, lib);
    this.loadedBackends.set(pluginId, backend);
    
    return backend;
  }

  // 卸载后端
  async unload(pluginId: string): Promise<void> {
    const backend = this.loadedBackends.get(pluginId);
    if (backend) {
      backend.cleanup();
      this.loadedBackends.delete(pluginId);
    }
  }
}

export class PluginBackend {
  constructor(
    private pluginId: string,
    private lib: any
  ) {}

  // 调用后端方法
  async call(method: string, params: any): Promise<any> {
    const paramsJson = JSON.stringify(params);
    const resultJson = this.lib.plugin_call(method, paramsJson);
    const result = JSON.parse(resultJson);
    
    if (result.status === 'error') {
      throw new Error(result.error);
    }
    
    return result.data;
  }

  // 清理后端
  cleanup() {
    this.lib.plugin_cleanup();
  }
}
```

## 5. 完整的插件API

```typescript
// pluginLoader/types/api.ts
export interface PluginAPI {
  // 路径管理
  paths: {
    getPluginDir(pluginId: string): string;
    getAssetsDir(pluginId: string): string;
    getDataDir(pluginId: string): string;
    getCacheDir(pluginId: string): string;
    getConfigPath(pluginId: string): string;
    getPluginBackend(pluginId: string): string;
  };
  
  // 钩子系统
  hooks: {
    register(hookName: string, handler: Function): void;
    unregister(hookName: string, handler: Function): void;
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
    load(backendPath: string): Promise<PluginBackend>;
    unload(backend: PluginBackend): Promise<void>;
  };
  
  // 存储API
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
  
  // UI API
  ui: {
    showNotification(message: string): void;
    showDialog(options: DialogOptions): Promise<any>;
  };
}
```

## 6. 构建和部署流程

### 6.1 插件构建脚本

```javascript
// pluginLoader/tools/build-plugin.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function buildPlugin(pluginName) {
  const pluginDir = path.join(__dirname, '..', 'plugins', pluginName);
  const outputDir = path.join(__dirname, '..', '..', 'dist', 'plugins', pluginName);
  
  console.log(`Building plugin: ${pluginName}`);
  
  // 1. 编译TypeScript
  console.log('Compiling TypeScript...');
  execSync('tsc', { cwd: pluginDir });
  
  // 2. 编译Rust后端（如果存在）
  const backendDir = path.join(pluginDir, 'backend');
  if (fs.existsSync(backendDir)) {
    console.log('Building Rust backend...');
    execSync('cargo build --release', { cwd: backendDir });
    
    // 复制编译后的库
    const targetDir = path.join(backendDir, 'target', 'release');
    const libName = process.platform === 'win32' ? 'plugin.dll' : 
                    process.platform === 'darwin' ? 'libplugin.dylib' : 
                    'libplugin.so';
    
    fs.copySync(
      path.join(targetDir, libName),
      path.join(outputDir, 'backend', 'plugin' + path.extname(libName))
    );
  }
  
  // 3. 复制必要文件
  console.log('Copying files...');
  fs.copySync(pluginDir, outputDir, {
    filter: (src) => {
      const relativePath = path.relative(pluginDir, src);
      return !relativePath.includes('node_modules') &&
             !relativePath.includes('.ts') &&
             !relativePath.includes('backend/src') &&
             !relativePath.includes('backend/target');
    }
  });
  
  console.log(`Plugin ${pluginName} built successfully!`);
}

// 构建所有插件
async function buildAllPlugins() {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const plugins = fs.readdirSync(pluginsDir);
  
  for (const plugin of plugins) {
    await buildPlugin(plugin);
  }
}

buildAllPlugins().catch(console.error);
```

## 总结

这个架构解决了你提出的所有问题：

1. **路径问题**：通过PathResolver统一管理开发和生产环境的路径
2. **热加载**：通过HotReloadManager实现开发时的自动重载
3. **编译注入**：通过构建脚本和运行时注入实现插件的动态加载
4. **插件架构**：
   - 标准化的目录结构
   - 清晰的前后端分离
   - 统一的API接口
   - 完善的生命周期管理
   - 资源和数据目录分离

关键特性：
- ✅ 开发/生产环境路径自动适配
- ✅ 开发时热加载支持
- ✅ Rust后端FFI集成
- ✅ 资源目录（只读）和数据目录（可写）分离
- ✅ 完整的插件生命周期管理
- ✅ 跨平台支持（Windows/macOS/Linux）
