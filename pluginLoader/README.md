# 插件加载器

Ling-Pet 桌宠应用的核心插件系统实现。

## 🎯 设计理念

**无侵入式扩展** - 在不修改主应用源码的前提下，实现功能的无限扩展。

### 核心原理

1. **Vue 实例拦截** - 通过拦截 Vue 组件实例化过程，实现组件 Hook
2. **智能组件发现** - 自动发现和注入局部导入的组件
3. **DOM 注入管理** - 统一管理页面内容注入和清理
4. **工具系统集成** - 为 AI 桌宠提供丰富的工具能力

## 📁 目录结构

```
pluginLoader/
├── core/                   # 核心实现
│   ├── pluginLoader.ts     # 插件加载器主类
│   ├── pluginApi.ts        # 插件 API 实现
│   ├── componentInjection.ts # 组件注入系统
│   ├── domInjection.ts     # DOM 注入管理
│   ├── hookEngine.ts       # Hook 引擎
│   ├── toolManager.ts      # 工具管理器
│   ├── petToolManager.ts   # 桌宠工具管理
│   └── ...                 # 其他核心模块
├── types/                  # 类型定义
│   └── api.ts              # 插件 API 类型
├── plugins/                # 插件目录
│   ├── bilibili-emoji/     # B站表情包插件
│   ├── dom-injection-test/ # DOM注入测试插件
│   └── hook-test/          # Hook测试插件
├── tools/                  # 开发工具
│   ├── plugin-cli.js       # 插件CLI工具
│   ├── compiler.cjs        # 插件编译器
│   ├── packager.cjs        # 插件打包器
│   └── ...                 # 其他工具
├── docs/                   # 文档
│   ├── BUILD_GUIDE.md      # 构建指南
│   ├── PET_TOOL_SYSTEM.md  # 桌宠工具系统
│   └── ...                 # 其他文档
└── init.ts                 # 插件系统初始化
```

## 🔧 核心模块

### PluginLoader
插件加载器主类，负责：
- 插件生命周期管理
- 插件上下文创建
- 权限检查和控制
- 跨窗口插件同步

### ComponentInjection
组件注入系统，实现：
- Vue 组件智能注入
- 局部组件自动发现
- 注入位置精确控制
- 注入清理和恢复

### DOMInjection
DOM 注入管理器，提供：
- HTML/CSS/Vue 组件注入
- 元素查询和等待
- 注入生命周期管理
- 自动清理机制

### HookEngine
Hook 引擎，支持：
- Vue 组件 Hook
- Pinia Store Hook
- 服务函数 Hook
- 生命周期拦截

### ToolManager
工具管理器，负责：
- LLM 工具注册
- 工具调用执行
- 参数验证
- 结果格式化

### PetToolManager
桌宠工具管理器，实现：
- 工具提示词生成
- 工具调用解析
- 会话管理
- 工具推荐

## 🚀 使用方式

### 初始化插件系统

```typescript
import { initializePluginSystem } from './pluginLoader/init'

// 在主应用中初始化
await initializePluginSystem(app, router)
```

### 创建插件

```typescript
import { definePlugin } from './core/pluginApi'

export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    async onLoad(context) {
        // 插件加载逻辑
        context.debug('插件已加载')
        
        // 注入组件
        const cleanup = context.injectComponent('ChatInput', MyComponent)
        
        // 注册工具
        context.registerTool({
            name: 'my_tool',
            description: '我的工具',
            handler: async (args) => {
                return '工具执行结果'
            }
        })
        
        return cleanup
    }
})
```

## 🛠️ 开发工具

### 插件 CLI
```bash
# 创建插件
npm run plugin:create my-plugin

# 构建插件
npm run plugin:build my-plugin

# 打包插件
npm run plugin:release my-plugin
```

### 调试工具
```javascript
// 浏览器控制台
__pluginLoader.getLoadedPlugins()  // 查看已加载插件
__domInjectionManager.getStats()   // 查看DOM注入统计
forceCheckInjections()             // 强制检查注入
```

## 📚 相关文档

- [构建指南](docs/BUILD_GUIDE.md) - 插件构建和打包
- [桌宠工具系统](docs/PET_TOOL_SYSTEM.md) - AI 工具集成
- [工具速查表](tools/CHEATSHEET.md) - 常用命令和 API

## 🔗 API 参考

详见项目根目录的 [API_REFERENCE.md](../API_REFERENCE.md)

## 🤝 贡献

欢迎贡献代码和插件！请参考项目根目录的贡献指南。