# 插件系统完整概览

## 文档导航

本插件系统包含以下核心文档：

1. **[插件架构设计](./plugin-architecture.md)** - 系统整体架构和设计理念
2. **[运行时架构](./plugin-runtime-architecture.md)** - 编译后应用的插件加载机制
3. **[后端实现指南](./plugin-backend-implementation.md)** - Rust后端开发详细说明
4. **[开发完整指南](./plugin-development-guide.md)** - 从入门到实战的开发教程
5. **[插件间通信](./plugin-communication.md)** - 插件间通信使用指南
6. **[动态注入方案](./DYNAMIC_INJECTION_SOLUTION.md)** - 无需预留注入点的组件注入

## 快速开始

### 5分钟创建第一个插件

```bash
# 1. 创建插件
cd pluginLoader
node tools/plugin-cli.js create my-first-plugin

# 2. 编辑代码
# 打开 plugins/my-first-plugin/index.ts

# 3. 构建
node tools/plugin-cli.js build my-first-plugin

# 4. 测试
node tools/plugin-cli.js test
```

### 插件代码模板

```typescript
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
  name: 'my-first-plugin',
  version: '1.0.0',
  
  async onLoad(context) {
    context.debug('插件已加载！')
    
    // 在这里添加你的功能
  }
})
```

## 核心概念

### 1. 插件定义 (PluginDefinition)

每个插件都是一个对象，包含：
- **name**: 插件唯一标识
- **version**: 版本号
- **onLoad**: 加载时执行的函数
- **onUnload**: 卸载时执行的函数（可选）

### 2. 插件上下文 (PluginContext)

插件通过上下文访问主应用功能：
- **app**: Vue应用实例
- **router**: 路由实例
- **hookComponent**: Hook组件
- **hookStore**: Hook状态管理
- **invokeTauri**: 调用后端命令

### 3. Hook机制

插件可以Hook三种对象：
- **组件Hook**: 拦截Vue组件生命周期
- **Store Hook**: 拦截Pinia状态变化
- **服务Hook**: 拦截服务函数调用

### 4. 前后端通信

- 前端通过 `context.invokeTauri()` 调用后端
- 后端使用Rust编写，编译为动态库
- 通过Tauri IPC进行通信

## 系统架构

```
┌─────────────────────────────────────────┐
│           主应用 (Vue + Tauri)           │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐   │
│  │     插件加载器 (PluginLoader)   │   │
│  └────────────────────────────────┘   │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │Hook引擎  │  │包管理器  │  │运行时│ │
│  └──────────┘  └──────────┘  └──────┘ │
│                                         │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
   ┌────▼───┐ ┌──▼───┐ ┌───▼────┐
   │插件A   │ │插件B │ │插件C   │
   │(前端)  │ │(混合)│ │(前端)  │
   └────────┘ └──────┘ └────────┘
```

## 主要功能

### ✅ 已实现

- [x] 插件加载/卸载
- [x] Hook引擎（组件/Store/服务）
- [x] 包管理器（安装/卸载）
- [x] Rust后端支持
- [x] 配置管理
- [x] 权限系统
- [x] CLI工具
- [x] 符号扫描器
- [x] **插件间通信**
  - [x] 事件系统
  - [x] 消息系统
  - [x] RPC调用
  - [x] 共享状态

### 🚧 计划中

- [ ] 插件市场
- [ ] 可视化开发工具
- [ ] 更多后端语言支持
- [ ] 自动更新机制
- [ ] 性能监控面板

## 开发工具

### CLI命令

```bash
# 创建插件
plugin-cli create <name>

# 构建插件
plugin-cli build [name]

# 验证插件
plugin-cli validate <name>

# 列出插件
plugin-cli list

# 测试加载器
plugin-cli test
```

### 符号扫描

```bash
# 扫描主应用，生成可Hook的符号列表
npm run plugin:scan
```

生成的 `symbol-map.json` 包含：
- 所有可Hook的组件
- 所有可Hook的Store
- 所有可Hook的服务函数

## API速查

### 组件Hook

```typescript
context.hookComponent('ComponentName', {
  mounted(instance) {
    // 组件挂载后执行
  }
})
```

### Store Hook

```typescript
context.hookStore('storeName', {
  afterAction(name, args, result) {
    // Action执行后
  }
})
```

### 服务Hook

```typescript
context.hookService('servicePath', 'functionName', {
  before(...args) {
    // 函数执行前
  },
  after(result, ...args) {
    // 函数执行后
    return result
  }
})
```

### 组件注入

```typescript
context.injectComponent('TargetComponent', MyComponent, {
  position: 'after',
  props: { /* ... */ }
})
```

### 添加路由

```typescript
context.addRoute({
  path: '/my-page',
  component: MyPage
})
```

### 配置管理

```typescript
// 读取
const value = context.getConfig('key', defaultValue)

// 保存
await context.setConfig('key', value)
```

### 调用后端

```typescript
const result = await context.invokeTauri(
  'plugin:my-plugin|my_command',
  { arg: 'value' }
)
```

## 实战案例

### 案例1: 消息增强

为聊天消息添加表情反应功能。

**关键技术：**
- Hook MessageItem组件
- Hook chatStore
- 注入反应面板组件

**参考：** [开发指南 - 案例1](./plugin-development-guide.md#案例1消息增强插件)

### 案例2: 主题切换

提供多种主题切换功能。

**关键技术：**
- 配置管理
- 组件注入
- 路由添加

**参考：** [开发指南 - 案例2](./plugin-development-guide.md#案例2主题切换插件)

### 案例3: 数据统计

统计用户的聊天数据（带Rust后端）。

**关键技术：**
- Rust动态库
- SQLite数据库
- 前后端通信

**参考：** [开发指南 - 案例3](./plugin-development-guide.md#案例3数据统计插件带后端)

## 性能指标

### 加载性能

- 插件加载时间: < 100ms（纯前端）
- 插件加载时间: < 500ms（带后端）
- Hook执行开销: < 1ms

### 内存占用

- 单个插件: < 10MB（前端）
- 单个插件: < 50MB（带后端）
- Hook引擎: < 5MB

### 并发能力

- 同时加载插件数: 无限制
- 同时运行插件数: 建议 < 20
- Hook数量: 建议 < 100

## 安全机制

### 权限控制

插件必须声明权限：
```json
{
  "permissions": [
    "hook:component",
    "hook:store",
    "network",
    "filesystem:read"
  ]
}
```

### 沙箱隔离

- 插件代码在独立作用域执行
- 只能通过PluginContext访问主应用
- 敏感操作需要用户确认

### 代码审查

- 插件安装前显示权限列表
- 用户可以查看插件代码
- 支持代码签名（计划中）

## 故障排查

### 常见问题

**Q: 插件加载失败？**
```
A: 检查manifest.json格式
   检查权限声明
   查看控制台错误信息
```

**Q: Hook不生效？**
```
A: 确认组件/Store名称正确
   使用符号扫描器生成的名称
   检查Hook注册时机
```

**Q: 后端命令调用失败？**
```
A: 检查命令名称格式
   确认后端已加载
   查看Tauri控制台日志
```

### 调试技巧

```typescript
// 1. 使用调试日志
context.debug('变量值:', someVariable)

// 2. 检查Hook执行
context.hookComponent('MyComponent', {
  mounted(instance) {
    console.trace() // 打印调用栈
  }
})

// 3. 监控性能
const start = performance.now()
// 执行操作
context.debug(`耗时: ${performance.now() - start}ms`)
```

## 最佳实践

### 1. 错误处理

```typescript
async onLoad(context) {
  try {
    await context.invokeTauri('some_command')
  } catch (error) {
    context.debug('操作失败:', error)
    // 降级处理
  }
}
```

### 2. 资源清理

```typescript
async onLoad(context) {
  const unhooks = []
  
  unhooks.push(context.hookComponent('MyComponent', {
    mounted() { /* ... */ }
  }))
  
  // 在卸载时清理
  return () => {
    unhooks.forEach(fn => fn())
  }
}
```

### 3. 性能优化

```typescript
// 使用防抖
import { debounce } from 'lodash'

const handler = debounce((data) => {
  // 处理逻辑
}, 300)

context.hookStore('myStore', {
  onStateChange: handler
})
```

### 4. 类型安全

```typescript
interface MyConfig {
  apiKey: string
  enabled: boolean
}

const config = context.getConfig<MyConfig>('config', {
  apiKey: '',
  enabled: true
})
```

## 发布流程

### 1. 准备

```bash
# 更新版本号
# 编辑 manifest.json

# 编写文档
# 更新 README.md
```

### 2. 构建

```bash
# 构建前端
node tools/plugin-cli.js build my-plugin

# 构建后端（如果有）
cd backend
cargo build --release
```

### 3. 验证

```bash
# 验证插件
node tools/plugin-cli.js validate my-plugin

# 测试功能
node tools/plugin-cli.js test
```

### 4. 打包

```bash
# 打包插件
node tools/plugin-cli.js package my-plugin

# 生成 my-plugin-1.0.0.zip
```

### 5. 分发

- 上传到插件市场（计划中）
- 或直接分发zip文件

## 社区资源

### 示例插件

- **hello-world** - 最简单的插件示例
- **message-reactions** - 消息增强插件
- **theme-switcher** - 主题切换插件
- **chat-stats** - 数据统计插件（带后端）

### 开发资源

- [Vue 3 文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Tauri 文档](https://tauri.app/)
- [Rust 文档](https://www.rust-lang.org/)

### 获取帮助

- 查看文档
- 查看示例代码
- 提交Issue
- 加入社区讨论

## 贡献指南

欢迎贡献代码、文档、示例插件！

### 贡献方式

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 发起Pull Request

### 代码规范

- 使用TypeScript
- 遵循ESLint规则
- 添加注释和文档
- 编写测试用例

## 版本历史

### v1.0.0 (当前)

- ✅ 基础插件系统
- ✅ Hook引擎
- ✅ Rust后端支持
- ✅ CLI工具

### v1.1.0 (计划)

- 🚧 插件市场
- 🚧 可视化开发工具
- 🚧 性能监控

### v2.0.0 (未来)

- 🚧 更多后端语言支持
- 🚧 插件间通信增强
- 🚧 自动更新机制

## 许可证

本项目采用 MIT 许可证。

## 联系方式

- 项目主页: [GitHub]
- 问题反馈: [Issues]
- 邮件: [Email]

---

**开始你的插件开发之旅吧！** 🚀

查看 [开发完整指南](./plugin-development-guide.md) 了解更多详情。
