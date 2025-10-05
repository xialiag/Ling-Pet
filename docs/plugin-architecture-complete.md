# 插件系统完整架构设计

## 📋 概述

本文档是插件系统的完整架构设计，整合了系统设计、运行时机制、生产环境部署等所有核心内容。

### 🎯 核心特性

- **无侵入式扩展** - 零源码修改实现功能扩展
- **热插拔支持** - 运行时加载/卸载，无需重启应用
- **前后端分离** - 支持纯前端插件和带Rust后端的混合插件
- **跨平台支持** - Windows/macOS/Linux 统一架构
- **安全沙箱** - 权限控制和代码隔离

## 🏗️ 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      主应用 (Vue + Tauri)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              插件加载器 (PluginLoader)                │  │
│  │  - 插件生命周期管理                                   │  │
│  │  - 权限控制                                           │  │
│  │  - 依赖解析                                           │  │
│  └──┬───────────────────────────────────────────────────┘  │
│     │                                                        │
│  ┌──▼──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Hook引擎       │  │  包管理器     │  │  运行时管理   │  │
│  │  - 组件Hook     │  │  - 安装/卸载  │  │  - 后端进程   │  │
│  │  - Store Hook   │  │  - 版本管理   │  │  - 动态库加载 │  │
│  │  - 服务Hook     │  │  - 依赖检查   │  │  - IPC通信    │  │
│  └─────────────────┘  └──────────────┘  └──────────────┘  │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼─────┐      ┌──────▼──────┐     ┌─────▼──────┐
   │ 插件A     │      │  插件B       │     │  插件C      │
   │ (纯前端)  │      │ (前端+后端)  │     │ (纯前端)    │
   │          │      │              │     │            │
   │ index.js │      │ index.js     │     │ index.js   │
   │          │      │ backend.dll  │     │            │
   └──────────┘      └──────────────┘     └────────────┘
```

## 🔧 核心组件

### 1. 插件加载器 (PluginLoader)

**职责**：
- 插件的加载、卸载、热重载
- 插件生命周期管理（onLoad、onUnload）
- 权限验证和依赖解析
- 插件上下文（PluginContext）创建

**关键方法**：
```typescript
class PluginLoader {
  // 初始化插件系统
  async initialize(app: App, router: Router): Promise<void>
  
  // 加载单个插件
  async loadPlugin(pluginId: string): Promise<boolean>
  
  // 卸载插件
  async unloadPlugin(pluginId: string): Promise<boolean>
  
  // 完全移除插件（删除文件）
  async removePlugin(pluginId: string): Promise<boolean>
  
  // 批量加载
  async loadPlugins(pluginIds: string[]): Promise<void>
  
  // 获取已加载插件
  getLoadedPlugins(): PluginMetadata[]
}
```

### 2. Hook引擎 (HookEngine)

**职责**：
- 拦截和增强Vue组件、Pinia Store、服务函数
- 提供before/after/replace钩子
- 管理Hook的注册和注销

**Hook类型**：

1. **组件Hook (ComponentHooks)**
   ```typescript
   interface ComponentHooks {
     beforeMount?: (instance) => void
     mounted?: (instance) => void
     beforeUpdate?: (instance) => void
     updated?: (instance) => void
     beforeUnmount?: (instance) => void
     unmounted?: (instance) => void
   }
   ```

2. **Store Hook (StoreHooks)**
   ```typescript
   interface StoreHooks {
     beforeAction?: (name, args) => void | false
     afterAction?: (name, args, result) => void
     onStateChange?: (state, oldState) => void
   }
   ```

3. **服务Hook (ServiceHooks)**
   ```typescript
   interface ServiceHooks {
     before?: (...args) => any[] | void
     after?: (result, ...args) => any
     replace?: (...args) => any
     onError?: (error, ...args) => void
   }
   ```

### 3. 包管理器 (PackageManager)

**职责**：
- 插件的安装、卸载、更新
- 插件文件管理（读取、验证）
- 插件元数据管理（manifest.json）
- 后端动态库加载

**插件包结构**：
```
plugin-name.zip
├── manifest.json          # 插件元数据
├── index.js              # 前端入口（编译后）
├── icon.png              # 插件图标
├── README.md             # 说明文档
└── backend/              # 后端（可选）
    ├── plugin.dll        # Windows动态库
    ├── libplugin.dylib   # macOS动态库
    └── libplugin.so      # Linux动态库
```

### 4. 运行时管理器 (PluginRuntime)

**职责**：
- 管理插件后端进程/动态库
- 处理前后端通信（IPC）
- 监控后端状态

## 📁 路径管理架构

### 目录结构设计

```
开发环境：
project/
├── pluginLoader/plugins/         # 插件源码
│   └── bilibili-emoji/
│       ├── index.ts
│       ├── assets/              # 内置资源
│       └── backend/src/         # Rust源码

生产环境：
[用户数据目录]/plugins/          # 插件安装目录
├── bilibili-emoji/
│   ├── manifest.json           # 插件元数据
│   ├── index.js               # 编译后的前端代码
│   ├── assets/                # 内置资源
│   └── backend/               # 后端（可选）
│       ├── plugin.dll         # Windows
│       ├── libplugin.dylib    # macOS
│       └── libplugin.so       # Linux
└── other-plugin/
    └── ...

用户数据目录位置：
- Windows: %APPDATA%/YourApp/plugins
- macOS: ~/Library/Application Support/YourApp/plugins
- Linux: ~/.config/yourapp/plugins
```

### 路径管理实现

当前架构使用 **PackageManager** 进行路径管理：

```typescript
// 通过 PluginContext 访问路径
export interface PluginContext {
  // 获取应用数据目录
  getAppDataDir: () => Promise<string>
  
  // 文件系统操作
  fs: {
    readDir: (path: string) => Promise<Array<{name: string, isFile: boolean, isDirectory: boolean}>>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string | Uint8Array) => Promise<void>
    exists: (path: string) => Promise<boolean>
    mkdir: (path: string, options?: {recursive?: boolean}) => Promise<void>
    remove: (path: string) => Promise<void>
  }
}

// PackageManager 内部路径管理
export class PluginPackageManager {
  private pluginsDir: string = ''  // 插件安装目录
  
  async initialize(): Promise<void> {
    const appData = await appDataDir()
    this.pluginsDir = await join(appData, 'plugins')
    // 确保目录存在
    if (!await exists(this.pluginsDir)) {
      await mkdir(this.pluginsDir, { recursive: true })
    }
  }
}
```

### 插件中的路径使用

```typescript
// 插件代码示例
export default definePlugin({
  async onLoad(context) {
    // 获取应用数据目录
    const appDataDir = await context.getAppDataDir()
    
    // 创建插件专用目录
    const pluginDataDir = `${appDataDir}/my-plugin-data`
    await context.fs.mkdir(pluginDataDir, { recursive: true })
    
    // 读写文件
    const configPath = `${pluginDataDir}/config.json`
    if (await context.fs.exists(configPath)) {
      const config = await context.fs.readFile(configPath)
      // 处理配置
    }
  }
})
```

## 🔄 运行时机制

### 插件加载流程

```
应用启动
  ↓
初始化插件系统
  ↓
扫描插件目录
  ↓
读取每个插件的 manifest.json
  ↓
加载已启用的插件
  ↓
读取 index.js 文件内容
  ↓
使用 Function 构造器执行代码
  ↓
获取 PluginDefinition
  ↓
创建 PluginContext
  ↓
调用 onLoad(context)
  ↓
插件通过 context API 操作应用
```

### 组件注入实现

**运行时动态包装**：
- 插件通过 `context.injectComponent()` 注册注入信息
- ComponentInjectionManager 管理所有注入
- 当目标组件注册时，自动包装它
- 包装后的组件在渲染时动态插入注入的组件

```typescript
// 插件代码
context.injectComponent('ChatWindow', MyComponent, {
  position: 'after'
})

// 运行时处理
const wrapped = defineComponent({
  setup(props, { slots, attrs }) {
    return () => {
      const children = []
      
      // Before 注入
      getInjections('ChatWindow')
        .filter(i => i.position === 'before')
        .forEach(i => children.push(h(i.component, i.props)))
      
      // 原始组件
      children.push(h(original, { ...props, ...attrs }, slots))
      
      // After 注入
      getInjections('ChatWindow')
        .filter(i => i.position === 'after')
        .forEach(i => children.push(h(i.component, i.props)))
      
      return h('div', children)
    }
  }
})
```

### 热加载机制

```typescript
// 加载插件
await pluginLoader.loadPlugin('my-plugin')
// ✅ 组件注入立即生效

// 卸载插件
await pluginLoader.unloadPlugin('my-plugin')
// ✅ 组件注入自动移除
// ✅ 恢复原始组件（如果没有其他注入）

// 完全移除插件
await pluginLoader.removePlugin('my-plugin')
// ✅ 删除插件文件
// ✅ 发送跨窗口事件通知其他窗口
```

## 🔌 插件API

### PluginContext 接口

```typescript
interface PluginContext {
  // Vue核心
  app: App
  router: Router
  getStore: (name: string) => Store
  
  // Hook API
  hookComponent: (name, hooks) => UnhookFunction
  hookStore: (name, hooks) => UnhookFunction
  hookService: (path, func, hooks) => UnhookFunction
  
  // 组件注入
  injectComponent: (target, component, options) => UnhookFunction
  wrapComponent: (name, wrapper) => UnhookFunction
  
  // 路由
  addRoute: (route) => void
  
  // 配置
  getConfig: <T>(key, defaultValue?) => T
  setConfig: (key, value) => Promise<void>
  
  // Tauri命令
  invokeTauri: <T>(command, args?) => Promise<T>
  
  // 插件间通信
  on: (event, handler) => UnsubscribeFunction
  emit: (event, ...args) => void
  sendMessage: (to, type, data) => string
  registerRPC: (method, handler) => UnregisterFunction
  callRPC: (plugin, method, ...params) => Promise<any>
  
  // LLM工具
  registerTool: (tool) => UnregisterFunction
  callTool: (name, args) => Promise<any>
  getAvailableTools: () => ToolInfo[]
  
  // DOM注入
  injectHTML: (selector, html, options?) => UnhookFunction
  injectVueComponent: (selector, component, props?, options?) => Promise<UnhookFunction>
  injectCSS: (css, options?) => UnhookFunction
  
  // 调试
  debug: (...args) => void
}
```

### 插件定义示例

```typescript
import { definePlugin } from '@/pluginLoader/core/pluginApi'

export default definePlugin({
  name: 'example-plugin',
  version: '1.0.0',
  description: '示例插件',
  
  async onLoad(context) {
    // 1. Hook组件
    context.hookComponent('ChatWindow', {
      mounted(instance) {
        console.log('聊天窗口已挂载')
      }
    })
    
    // 2. Hook Store
    context.hookStore('chatStore', {
      afterAction(name, args, result) {
        if (name === 'sendMessage') {
          console.log('消息已发送:', args[0])
        }
      }
    })
    
    // 3. 注入组件
    context.injectComponent('ChatWindow', MyCustomButton, {
      position: 'after',
      props: { label: '自定义按钮' }
    })
    
    // 4. 添加路由
    context.addRoute({
      path: '/plugin/example',
      component: MyPluginPage
    })
    
    // 5. 注册LLM工具
    context.registerTool({
      name: 'my_tool',
      description: '我的工具',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: '输入参数',
          required: true
        }
      ],
      handler: async (args) => {
        return `处理结果: ${args.input}`
      },
      category: 'utility',
      examples: ['my_tool({"input": "hello world"})']
    })
    
    // 6. 后端交互示例
    if (context.getConfig('enableBackend')) {
      try {
        // HTTP请求（避免CORS限制）
        const apiResponse = await context.invokeTauri<string>('http_request', {
          url: 'https://api.example.com/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MyPlugin/1.0'
          },
          body: JSON.stringify({ query: 'test' })
        })
        
        const data = JSON.parse(apiResponse)
        context.debug('API响应:', data)
        
        // 文件操作示例
        const appDataDir = await context.getAppDataDir()
        const cacheDir = `${appDataDir}/my-plugin-cache`
        
        // 确保缓存目录存在
        await context.fs.mkdir(cacheDir, { recursive: true })
        
        // 保存数据到缓存
        const cacheFile = `${cacheDir}/api-cache.json`
        await context.fs.writeFile(cacheFile, JSON.stringify(data))
        
        // 读取二进制文件（如图片）
        if (data.imageUrl) {
          const imageResponse = await context.invokeTauri<string>('http_request', {
            url: data.imageUrl,
            method: 'GET'
          })
          
          // 保存图片
          const imagePath = `${cacheDir}/image.png`
          await context.fs.writeFile(imagePath, imageResponse)
        }
        
      } catch (error) {
        context.debug('后端调用失败:', error)
      }
    }
  },
  
  async onUnload(context) {
    context.debug('插件卸载')
    // Hook会自动清理
  }
})
```

### 实际插件后端交互案例

以下是 `bilibili-emoji` 插件的实际后端交互示例：

```typescript
// 搜索B站装扮
const searchSuits = async (keyword: string) => {
  try {
    const url = `https://api.bilibili.com/x/garb/v2/mall/home/search?key_word=${encodeURIComponent(keyword)}`
    
    // 通过主应用HTTP命令发送请求（避免CORS）
    const responseText = await context.invokeTauri<string>('http_request', {
      url,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    })
    
    const response = JSON.parse(responseText)
    return response.data?.list || []
  } catch (error) {
    context.debug('搜索失败:', error)
    return []
  }
}

// 下载表情包文件
const downloadEmoji = async (url: string, savePath: string) => {
  try {
    // 下载文件内容
    const content = await context.invokeTauri<number[]>('read_binary_file', {
      path: url // 这里实际上是通过HTTP下载
    })
    
    // 保存到本地
    const uint8Array = new Uint8Array(content)
    await context.fs.writeFile(savePath, uint8Array)
    
    return true
  } catch (error) {
    context.debug('下载失败:', error)
    return false
  }
}

// 清理临时文件
const cleanupTemp = async (tempDir: string) => {
  try {
    await context.invokeTauri('remove_dir_all', { path: tempDir })
    context.debug('临时目录已清理')
  } catch (error) {
    context.debug('清理失败:', error)
  }
}
```

## 🔒 安全机制

### 权限系统

插件必须在manifest.json中声明权限：

```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "permissions": [
    "hook:component",      // Hook Vue组件
    "hook:store",          // Hook Pinia Store
    "hook:service",        // Hook服务函数
    "network",             // 网络访问
    "filesystem:read",     // 文件系统读取
    "filesystem:write",    // 文件系统写入
    "clipboard",           // 剪贴板访问
    "notification"         // 通知
  ],
  "dependencies": {
    "other-plugin": "^1.0.0"
  },
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll",
    "commands": ["my_command", "another_command"]
  },
  "config": {
    "apiKey": {
      "type": "string",
      "default": "",
      "description": "API密钥"
    }
  }
}
```

### 沙箱隔离

1. **代码隔离**
   - 插件代码在独立作用域执行
   - 只能通过PluginContext访问主应用

2. **资源限制**
   - 限制内存使用
   - 限制CPU时间
   - 限制网络请求频率

3. **API限制**
   - 根据权限控制API访问
   - 敏感操作需要用户确认

## 🔧 后端架构

### Rust动态库方式

**优势**：
- 性能最佳，直接内存调用
- 与主应用共享进程
- 无需额外端口

**实现方式**：

1. **插件后端代码（Rust）**
```rust
// backend/src/lib.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub data: String,
    pub error: Option<String>,
}

// 插件初始化函数
#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[Plugin] Backend initialized");
}

// 插件清理函数
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[Plugin] Backend cleaned up");
}

// 插件业务逻辑函数
pub fn process_data(input: &str) -> ProcessResult {
    ProcessResult {
        success: true,
        data: format!("Processed: {}", input),
        error: None,
    }
}
```

2. **主应用加载动态库（Rust）**
```rust
// src-tauri/src/plugin_manager.rs
use libloading::{Library, Symbol};

pub struct PluginBackend {
    library: Library,
    commands: Vec<String>,
}

impl PluginBackend {
    pub fn load(path: &str) -> Result<Self, String> {
        unsafe {
            let lib = Library::new(path)
                .map_err(|e| format!("加载失败: {}", e))?;
            
            // 调用初始化函数
            if let Ok(init_fn) = lib.get::<extern "C" fn()>(b"plugin_init") {
                init_fn();
            }
            
            Ok(PluginBackend {
                library: lib,
                commands: vec![],
            })
        }
    }
}
```

### 主应用提供的通用后端命令

插件通过以下通用命令与后端交互：

#### HTTP请求命令
```typescript
// 发送HTTP请求（避免CORS限制）
const response = await context.invokeTauri<string>('http_request', {
    url: 'https://api.example.com/data',
    method: 'GET', // GET, POST, PUT, DELETE
    headers: {
        'User-Agent': 'MyApp/1.0',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ key: 'value' }) // 可选
})
```

#### 文件系统命令
```typescript
// 读取二进制文件
const bytes = await context.invokeTauri<number[]>('read_binary_file', {
    path: '/path/to/image.png'
})

// 递归删除目录
await context.invokeTauri('remove_dir_all', {
    path: '/temp/directory'
})
```

#### 插件管理命令
```typescript
// 这些命令由插件系统内部使用
await context.invokeTauri('plugin_load_backend', {
    pluginId: 'my-plugin',
    backendPath: '/path/to/plugin.dll'
})

await context.invokeTauri('plugin_unload_backend', {
    pluginId: 'my-plugin'
})
```

### 前后端通信流程

**当前实现的通信方式**：

```
前端插件
   │
   │ 1. context.invokeTauri('http_request', {url, method, headers})
   ↓
Tauri IPC 层
   │
   │ 2. 主应用通用命令处理
   ↓
主应用后端 (Rust)
   │
   │ 3. 执行HTTP请求/文件操作等
   ↓
返回结果
   │
   │ 4. 通过IPC返回
   ↓
前端插件接收结果
```

**插件后端动态库的作用**：
- 主要用于复杂的数据处理逻辑
- 通过 `plugin_init()` 函数进行初始化
- 目前主要通过主应用提供的通用命令间接调用

## 🛠️ 开发工具

### CLI工具 (plugin-cli)

```bash
# 创建插件
plugin-cli create my-plugin

# 构建插件
plugin-cli build my-plugin

# 验证插件
plugin-cli validate my-plugin

# 打包插件
plugin-cli package my-plugin

# 列出插件
plugin-cli list
```

### 符号扫描器 (symbolScanner)

自动扫描主应用，生成可Hook的符号列表：

```bash
npm run plugin:scan
```

生成 `symbol-map.json`：
```json
{
  "components": [
    {
      "name": "ChatWindow",
      "path": "src/components/ChatWindow.vue",
      "props": ["messages", "user"],
      "emits": ["send", "close"],
      "methods": ["scrollToBottom", "clearInput"]
    }
  ],
  "stores": [
    {
      "name": "chatStore",
      "path": "src/stores/chat.ts",
      "state": ["messages", "currentUser"],
      "actions": ["sendMessage", "loadHistory"]
    }
  ]
}
```

## 🚀 部署流程

### 插件开发

```bash
# 1. 创建插件
cd pluginLoader
node tools/plugin-cli.js create my-plugin

# 2. 开发插件
cd plugins/my-plugin
# 编辑 index.ts

# 3. 构建插件
npm run build

# 4. 验证插件
node tools/plugin-cli.js validate my-plugin

# 5. 打包插件
node tools/plugin-cli.js package my-plugin
# 生成 my-plugin-1.0.0.zip
```

### 插件安装

**方式1：本地安装**
```typescript
await pluginLoader.installPlugin('/path/to/plugin.zip')
await pluginLoader.loadPlugin('com.example.myplugin')
```

**方式2：UI安装**
- 在设置页面选择插件包文件
- 自动安装和启用
- 显示安装结果和通知

## 📊 性能优化

### 懒加载

- 插件按需加载
- 后端延迟初始化
- 组件动态导入

### 缓存机制

- 插件代码缓存
- 配置缓存
- 符号映射缓存

### 并发控制

- 限制同时加载的插件数量
- 异步加载优化
- 防止阻塞主线程

## 🔍 错误处理

### 插件加载失败

```typescript
try {
  await pluginLoader.loadPlugin('my-plugin')
} catch (error) {
  // 显示错误提示
  // 记录日志
  // 回滚状态
}
```

### 运行时错误

- Hook执行错误不影响主应用
- 自动捕获并记录
- 提供错误恢复机制

### 后端崩溃

- 自动重启后端
- 降级到纯前端模式
- 通知用户

## 📋 总结

本插件系统设计具有以下特点：

1. **灵活性** - 支持纯前端和混合插件
2. **安全性** - 权限控制和沙箱隔离
3. **性能** - Rust动态库，零开销抽象
4. **易用性** - 丰富的API和开发工具
5. **可扩展** - 模块化设计，易于扩展
6. **生产就绪** - 完整的路径管理和部署方案

通过这套机制，开发者可以轻松扩展应用功能，而不影响核心稳定性。插件系统已经在生产环境中稳定运行，支持热插拔、跨窗口通信、LLM工具集成等高级功能。

---

**🎉 这是一个生产级别的插件系统架构！**