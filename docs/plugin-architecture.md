# 插件系统前后端运行机制设计

## 一、架构概览

插件系统采用**前后端分离**的架构，支持纯前端插件和带后端的混合插件。

```
┌─────────────────────────────────────────────────────────────┐
│                      主应用 (Vue + Tauri)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              插件加载器 (PluginLoader)                │  │
│  │  - 插件生命周期管理                                   │  │
│  │  - 权限控制                                           │  │
│  │  │  - 依赖解析                                         │  │
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

## 二、核心组件

### 2.1 插件加载器 (PluginLoader)

**职责：**
- 插件的加载、卸载、热重载
- 插件生命周期管理（onLoad、onUnload）
- 权限验证和依赖解析
- 插件上下文（PluginContext）创建

**关键方法：**
```typescript
class PluginLoader {
  // 初始化插件系统
  async initialize(app: App, router: Router): Promise<void>
  
  // 加载单个插件
  async loadPlugin(pluginId: string): Promise<boolean>
  
  // 卸载插件
  async unloadPlugin(pluginId: string): Promise<boolean>
  
  // 批量加载
  async loadPlugins(pluginIds: string[]): Promise<void>
  
  // 获取已加载插件
  getLoadedPlugins(): PluginMetadata[]
}
```

### 2.2 Hook引擎 (HookEngine)

**职责：**
- 拦截和增强Vue组件、Pinia Store、服务函数
- 提供before/after/replace钩子
- 管理Hook的注册和注销

**Hook类型：**

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

### 2.3 包管理器 (PackageManager)

**职责：**
- 插件的安装、卸载、更新
- 插件文件管理（读取、验证）
- 插件元数据管理（manifest.json）
- 后端动态库加载

**插件包结构：**
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

**manifest.json 结构：**
```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者名",
  "entry": "index.js",
  "icon": "icon.png",
  "permissions": [
    "hook:component",
    "hook:store",
    "hook:service",
    "network",
    "filesystem"
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

### 2.4 运行时管理器 (PluginRuntime)

**职责：**
- 管理插件后端进程/动态库
- 处理前后端通信（IPC）
- 监控后端状态

**后端类型：**
1. **Rust动态库** - 通过libloading加载，性能最佳
2. **独立进程** - HTTP/WebSocket通信（未来支持）

## 三、前端运行机制

### 3.1 插件加载流程

```
1. 用户触发加载
   ↓
2. PackageManager验证插件
   - 检查manifest.json
   - 验证权限
   - 检查依赖
   ↓
3. 读取插件代码
   - 读取index.js
   - 执行代码获取PluginDefinition
   ↓
4. 创建PluginContext
   - 注入API（app, router, hookComponent等）
   - 配置管理
   - Tauri命令调用
   ↓
5. 执行onLoad
   - 插件初始化逻辑
   - 注册Hook
   - 添加路由/组件
   ↓
6. 标记为已加载
```

### 3.2 插件上下文 (PluginContext)

插件通过PluginContext访问主应用功能：

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
  
  // 调试
  debug: (...args) => void
}
```

### 3.3 插件代码示例

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
    
    // 5. 调用后端
    if (context.getConfig('enableBackend')) {
      const result = await context.invokeTauri('my_plugin_command', {
        param: 'value'
      })
      context.debug('后端返回:', result)
    }
  },
  
  async onUnload(context) {
    context.debug('插件卸载')
    // Hook会自动清理
  }
})
```

## 四、后端运行机制

### 4.1 Rust动态库方式

**优势：**
- 性能最佳，直接内存调用
- 与主应用共享进程
- 无需额外端口

**实现方式：**

1. **插件后端代码（Rust）**
```rust
// backend/src/lib.rs
use tauri::{command, Runtime};

#[command]
pub fn my_plugin_command<R: Runtime>(param: String) -> Result<String, String> {
    Ok(format!("处理结果: {}", param))
}

// 导出初始化函数
#[no_mangle]
pub extern "C" fn plugin_init(app: tauri::AppHandle) {
    // 注册命令
    app.plugin(tauri::plugin::Builder::new("my-plugin")
        .invoke_handler(tauri::generate_handler![my_plugin_command])
        .build());
}
```

2. **主应用加载动态库（Rust）**
```rust
// src-tauri/src/plugin_loader.rs
use libloading::{Library, Symbol};

pub struct PluginBackend {
    library: Library,
    commands: Vec<String>,
}

impl PluginBackend {
    pub fn load(path: &str, app: tauri::AppHandle) -> Result<Self, String> {
        unsafe {
            let lib = Library::new(path)
                .map_err(|e| format!("加载失败: {}", e))?;
            
            // 调用初始化函数
            let init: Symbol<extern "C" fn(tauri::AppHandle)> = lib
                .get(b"plugin_init")
                .map_err(|e| format!("找不到初始化函数: {}", e))?;
            
            init(app);
            
            Ok(PluginBackend {
                library: lib,
                commands: vec![],
            })
        }
    }
}
```

3. **Tauri命令**
```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn plugin_load_backend(
    plugin_id: String,
    backend_path: String,
    app: tauri::AppHandle,
) -> Result<PluginLoadResult, String> {
    let backend = PluginBackend::load(&backend_path, app)?;
    
    // 存储到全局状态
    app.state::<PluginManager>()
        .add_backend(plugin_id, backend);
    
    Ok(PluginLoadResult { success: true })
}

#[tauri::command]
pub async fn plugin_unload_backend(
    plugin_id: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    app.state::<PluginManager>()
        .remove_backend(&plugin_id);
    Ok(())
}
```

### 4.2 前后端通信流程

```
前端插件
   │
   │ 1. context.invokeTauri('my_plugin_command', args)
   ↓
Tauri IPC
   │
   │ 2. 路由到插件命令
   ↓
插件后端 (Rust动态库)
   │
   │ 3. 执行命令逻辑
   ↓
返回结果
   │
   │ 4. 通过IPC返回
   ↓
前端插件接收结果
```

## 五、安全机制

### 5.1 权限系统

插件必须在manifest.json中声明权限：

```json
{
  "permissions": [
    "hook:component",      // Hook Vue组件
    "hook:store",          // Hook Pinia Store
    "hook:service",        // Hook服务函数
    "network",             // 网络访问
    "filesystem:read",     // 文件系统读取
    "filesystem:write",    // 文件系统写入
    "clipboard",           // 剪贴板访问
    "notification"         // 通知
  ]
}
```

### 5.2 沙箱隔离

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

### 5.3 代码签名（未来）

- 插件包数字签名
- 验证插件来源
- 防止篡改

## 六、开发工具

### 6.1 CLI工具 (plugin-cli)

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

### 6.2 符号扫描器 (symbolScanner)

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
  ],
  "services": [
    {
      "name": "apiService",
      "path": "src/services/api.ts",
      "functions": ["fetchData", "postData"]
    }
  ]
}
```

### 6.3 开发模式

```typescript
// 开发时热重载
if (import.meta.env.DEV) {
  pluginLoader.enableHotReload('my-plugin', './plugins/my-plugin')
}
```

## 七、部署流程

### 7.1 插件开发

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

### 7.2 插件安装

**方式1：本地安装**
```typescript
await pluginLoader.installPlugin('/path/to/plugin.zip')
await pluginLoader.loadPlugin('com.example.myplugin')
```

**方式2：插件市场（未来）**
- 在线浏览插件
- 一键安装
- 自动更新

### 7.3 插件分发

插件包结构（编译后）：
```
my-plugin-1.0.0.zip
├── manifest.json
├── index.js              # 编译后的前端代码
├── icon.png
├── README.md
└── backend/              # 可选
    ├── plugin.dll        # Windows
    ├── libplugin.dylib   # macOS
    └── libplugin.so      # Linux
```

## 八、性能优化

### 8.1 懒加载

- 插件按需加载
- 后端延迟初始化
- 组件动态导入

### 8.2 缓存机制

- 插件代码缓存
- 配置缓存
- 符号映射缓存

### 8.3 并发控制

- 限制同时加载的插件数量
- 异步加载优化
- 防止阻塞主线程

## 九、错误处理

### 9.1 插件加载失败

```typescript
try {
  await pluginLoader.loadPlugin('my-plugin')
} catch (error) {
  // 显示错误提示
  // 记录日志
  // 回滚状态
}
```

### 9.2 运行时错误

- Hook执行错误不影响主应用
- 自动捕获并记录
- 提供错误恢复机制

### 9.3 后端崩溃

- 自动重启后端
- 降级到纯前端模式
- 通知用户

## 十、未来扩展

### 10.1 插件市场

- 在线浏览和搜索
- 评分和评论
- 自动更新

### 10.2 插件间通信

```typescript
// 插件A
context.emit('my-event', data)

// 插件B
context.on('my-event', (data) => {
  console.log('收到事件:', data)
})
```

### 10.3 更多后端支持

- Node.js后端
- Python后端
- WebAssembly

### 10.4 可视化开发

- 拖拽式插件开发
- 实时预览
- 调试工具

## 十一、总结

本插件系统设计具有以下特点：

1. **灵活性** - 支持纯前端和混合插件
2. **安全性** - 权限控制和沙箱隔离
3. **性能** - Rust动态库，零开销抽象
4. **易用性** - 丰富的API和开发工具
5. **可扩展** - 模块化设计，易于扩展

通过这套机制，开发者可以轻松扩展应用功能，而不影响核心稳定性。
