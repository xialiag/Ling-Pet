# 插件系统

一个强大、灵活、安全的插件系统，支持前端Hook、后端扩展和热重载。

## 🌟 特性

- ✅ **灵活的Hook机制** - Hook Vue组件、Pinia Store、服务函数
- ✅ **前后端分离** - 支持纯前端插件和带Rust后端的混合插件
- ✅ **热重载** - 开发时自动重载，无需重启应用
- ✅ **权限控制** - 细粒度的权限管理，保障安全
- ✅ **包管理** - 完整的插件安装、卸载、更新机制
- ✅ **开发工具** - CLI工具和符号扫描器，提升开发效率
- ✅ **类型安全** - 完整的TypeScript类型定义

## 📚 文档

- **[系统概览](../docs/plugin-system-overview.md)** - 快速了解插件系统
- **[架构设计](../docs/plugin-architecture.md)** - 深入理解系统架构
- **[开发指南](../docs/plugin-development-guide.md)** - 从入门到实战
- **[后端实现](../docs/plugin-backend-implementation.md)** - Rust后端开发
- **[流程图](../docs/plugin-flow-diagrams.md)** - 可视化流程说明

## 🚀 快速开始

### 创建插件

```bash
# 进入插件加载器目录
cd pluginLoader

# 创建新插件
node tools/plugin-cli.js create my-plugin

# 构建插件
node tools/plugin-cli.js build my-plugin

# 验证插件
node tools/plugin-cli.js validate my-plugin
```

### 插件代码示例

```typescript
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: '我的第一个插件',
  
  async onLoad(context) {
    // Hook组件
    context.hookComponent('ChatWindow', {
      mounted(instance) {
        context.debug('聊天窗口已挂载')
      }
    })
    
    // Hook Store
    context.hookStore('chatStore', {
      afterAction(name, args, result) {
        if (name === 'sendMessage') {
          context.debug('消息已发送:', args[0])
        }
      }
    })
    
    // 添加路由
    context.addRoute({
      path: '/my-page',
      component: MyPage
    })
    
    // 调用后端
    const result = await context.invokeTauri('my_command', {
      param: 'value'
    })
  },
  
  async onUnload(context) {
    context.debug('插件已卸载')
  }
})
```

## 📦 目录结构

```
pluginLoader/
├── core/                    # 核心模块
│   ├── hookEngine.ts       # Hook引擎
│   ├── pluginLoader.ts     # 插件加载器
│   ├── pluginRuntime.ts    # 运行时管理
│   ├── packageManager.ts   # 包管理器
│   ├── pluginApi.ts        # 插件API
│   └── index.ts            # 导出
├── types/                   # 类型定义
│   └── api.ts              # API类型
├── tools/                   # 开发工具
│   ├── plugin-cli.js       # CLI工具
│   ├── symbolScanner.ts    # 符号扫描器
│   └── symbol-map.json     # 符号映射
├── plugins/                 # 插件目录（开发）
│   └── example-plugin/
├── init.ts                  # 初始化
└── README.md               # 本文件
```

## 🛠️ CLI命令

```bash
# 创建插件
plugin-cli create <name>

# 构建插件（单个）
plugin-cli build <name>

# 构建所有插件
plugin-cli build

# 验证插件
plugin-cli validate <name>

# 列出所有插件
plugin-cli list

# 测试加载器
plugin-cli test

# 显示帮助
plugin-cli help
```

## 🔌 API参考

### PluginContext

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
  
  // 组件操作
  injectComponent: (target, component, options) => UnhookFunction
  wrapComponent: (name, wrapper) => UnhookFunction
  
  // 路由
  addRoute: (route) => void
  
  // 配置
  getConfig: <T>(key, default?) => T
  setConfig: (key, value) => Promise<void>
  
  // Tauri命令
  invokeTauri: <T>(command, args?) => Promise<T>
  
  // 工具
  debug: (...args) => void
}
```

### Hook类型

```typescript
// 组件Hook
interface ComponentHooks {
  beforeMount?: (instance) => void
  mounted?: (instance) => void
  beforeUpdate?: (instance) => void
  updated?: (instance) => void
  beforeUnmount?: (instance) => void
  unmounted?: (instance) => void
}

// Store Hook
interface StoreHooks {
  beforeAction?: (name, args) => void | false
  afterAction?: (name, args, result) => void
  onStateChange?: (state, oldState) => void
}

// 服务Hook
interface ServiceHooks {
  before?: (...args) => any[] | void
  after?: (result, ...args) => any
  replace?: (...args) => any
  onError?: (error, ...args) => void
}
```

## 🎯 实战案例

### 案例1: 消息增强插件

为聊天消息添加表情反应功能。

```typescript
export default definePlugin({
  name: 'message-reactions',
  version: '1.0.0',
  
  async onLoad(context) {
    // Hook消息组件
    context.hookComponent('MessageItem', {
      mounted(instance) {
        // 添加反应按钮
      }
    })
    
    // 注入反应面板
    context.injectComponent('MessageItem', ReactionPanel, {
      position: 'after'
    })
  }
})
```

### 案例2: 数据统计插件（带后端）

统计聊天数据，使用Rust后端存储。

**前端：**
```typescript
export default definePlugin({
  name: 'chat-stats',
  version: '1.0.0',
  
  async onLoad(context) {
    // Hook消息发送
    context.hookStore('chatStore', {
      afterAction(name, args) {
        if (name === 'sendMessage') {
          context.invokeTauri('plugin:chat-stats|record_message', {
            message: args[0]
          })
        }
      }
    })
    
    // 添加统计页面
    context.addRoute({
      path: '/stats',
      component: StatsPage
    })
  }
})
```

**后端（Rust）：**
```rust
#[command]
fn record_message(message: String) -> Result<(), String> {
    // 存储到数据库
    Ok(())
}

#[no_mangle]
pub extern "C" fn plugin_init(app: AppHandle) -> Vec<String> {
    app.plugin(
        tauri::plugin::Builder::new("chat-stats")
            .invoke_handler(tauri::generate_handler![record_message])
            .build()
    ).expect("无法注册插件");
    
    vec!["record_message".to_string()]
}
```

## 🔒 安全机制

### 权限声明

插件必须在 `manifest.json` 中声明权限：

```json
{
  "permissions": [
    "hook:component",
    "hook:store",
    "hook:service",
    "network",
    "filesystem:read",
    "filesystem:write",
    "clipboard",
    "notification"
  ]
}
```

### 沙箱隔离

- 插件代码在独立作用域执行
- 只能通过PluginContext访问主应用
- 敏感操作需要用户确认

## 📊 性能指标

- 插件加载时间: < 100ms（纯前端）
- 插件加载时间: < 500ms（带后端）
- Hook执行开销: < 1ms
- 单个插件内存: < 10MB（前端）

## 🐛 故障排查

### 插件加载失败

1. 检查 `manifest.json` 格式
2. 检查权限声明
3. 查看控制台错误信息

### Hook不生效

1. 确认组件/Store名称正确
2. 使用符号扫描器生成的名称
3. 检查Hook注册时机

### 后端命令调用失败

1. 检查命令名称格式：`plugin:<plugin-name>|<command-name>`
2. 确认后端已加载
3. 查看Tauri控制台日志

## 🤝 贡献

欢迎贡献代码、文档、示例插件！

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 发起Pull Request

## 📝 许可证

MIT License

## 📮 联系方式

- 问题反馈: [Issues]
- 邮件: [Email]

---

**开始你的插件开发之旅吧！** 🚀
