# Ling-Pet 插件系统

一个完整的、生产级别的插件系统，支持Vue组件注入、DOM操作和LLM工具集成。

## 🌟 核心特性

- ✅ **Vue组件注入**: 无需修改源码即可Hook任何组件
- ✅ **DOM注入API**: 灵活的HTML/CSS/Vue组件注入
- ✅ **LLM工具集成**: 为AI助手提供扩展工具
- ✅ **插件通信**: 事件系统和RPC调用
- ✅ **热加载**: 运行时加载和卸载插件
- ✅ **权限系统**: 细粒度的权限控制

## 🚀 快速开始

### 安装插件

1. 下载插件包（.zip 文件）
2. 打开应用 > 设置 > 插件管理
3. 点击"安装插件"
4. 选择 zip 文件
5. 启用插件

### 开发插件

```bash
# 1. 创建插件目录
mkdir -p pluginLoader/plugins/my-plugin

# 2. 创建 package.json
cat > pluginLoader/plugins/my-plugin/package.json << EOF
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.ts"
}
EOF

# 3. 创建 index.ts
cat > pluginLoader/plugins/my-plugin/index.ts << EOF
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    async onLoad(context) {
        context.debug('Plugin loaded!')
    }
})
EOF

# 4. 构建
npm run plugin:release my-plugin

# 5. 输出
# releases/plugins/my-plugin-1.0.0.zip
```

## 📦 示例插件

### Bilibili Emoji
B 站表情包管理插件，包含完整的 Rust 后端。

**功能**:
- 扫描本地表情包
- 搜索 B 站装扮
- 下载表情包
- 7 个 LLM 工具

**文件**: `pluginLoader/plugins/bilibili-emoji/`

### LLM Service
LLM 工具服务插件。

**文件**: `pluginLoader/plugins/llm-service/`

### Example Native
带 Rust 后端的示例插件。

**文件**: `pluginLoader/plugins/example-native/`

## 🏗️ 架构

```
┌─────────────────────────────────────┐
│         主应用 (Tauri)              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      插件加载器 (TypeScript)        │
│  - 生命周期管理                     │
│  - 权限控制                         │
│  - 事件系统                         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    插件后端加载器 (Rust)            │
│  - 动态库加载                       │
│  - C FFI 桥接                       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  插件动态库 (plugin.dll/.so/.dylib) │
│  - 原生功能                         │
│  - 高性能计算                       │
└─────────────────────────────────────┘
```

## 📚 文档

### 核心文档
- [使用指南](PLUGIN_SYSTEM_GUIDE.md) - 完整的开发和使用指南
- [API参考](API_REFERENCE.md) - 详细的API文档
- [故障排除](TROUBLESHOOTING.md) - 常见问题和解决方案
- [快速参考](pluginLoader/tools/CHEATSHEET.md) - 命令和API速查

## 🛠️ 构建工具

### 一键构建
```bash
npm run plugin:release [plugin-name]
```

自动完成：
1. TypeScript 编译
2. Rust 后端编译
3. 资源文件复制
4. manifest.json 生成
5. 打包成 zip
6. 生成元数据

### 分步构建
```bash
# 只编译
npm run plugin:build

# 只打包
npm run plugin:package
```

## 🔌 插件 API

### 基础 API
```typescript
context.debug(...args)              // 调试日志
context.getConfig(key, default)     // 获取配置
context.setConfig(key, value)       // 保存配置
context.invokeTauri(cmd, args)      // 调用 Tauri 命令
```

### Hook API
```typescript
context.hookComponent(name, hooks)  // Hook Vue 组件
context.hookStore(name, hooks)      // Hook Pinia Store
context.hookService(path, fn, hooks)// Hook 服务函数
```

### 组件 API
```typescript
context.injectComponent(target, component, options)
context.wrapComponent(name, wrapper)
context.addRoute(route)
```

### 通信 API
```typescript
context.on(event, handler)          // 监听事件
context.emit(event, ...args)        // 发送事件
context.registerRPC(method, handler)// 注册 RPC
context.callRPC(plugin, method, ...params) // 调用 RPC
```

### 工具 API
```typescript
context.registerTool(tool)          // 注册 LLM 工具
context.callTool(name, args)        // 调用工具
context.getAvailableTools()         // 获取工具列表
```

## 🎯 使用场景

### 1. 扩展 UI
```typescript
context.injectComponent('ChatInput', MyComponent, {
    position: 'after'
})
```

### 2. 添加功能
```typescript
context.registerTool({
    name: 'my_function',
    description: '我的功能',
    handler: async (args) => {
        // 实现功能
    }
})
```

### 3. Hook 行为
```typescript
context.hookStore('chatStore', {
    afterAction: (name, args, result) => {
        console.log('Action called:', name)
    }
})
```

### 4. 原生功能
```rust
// backend/src/lib.rs
#[no_mangle]
pub extern "C" fn my_function(input: *const i8) -> *mut i8 {
    // 高性能计算
}
```

## 🔒 权限系统

在 `package.json` 中声明权限：

```json
{
  "permissions": [
    "storage:read",
    "storage:write",
    "network:request",
    "command:execute",
    "hook:component",
    "hook:store"
  ]
}
```

## 🌍 跨平台

### 纯前端插件
一次构建，到处运行：
```
my-plugin-1.0.0.zip (通用)
```

### 带后端插件
每个平台单独构建：
```
my-plugin-1.0.0-win32.zip   (Windows)
my-plugin-1.0.0-darwin.zip  (macOS)
my-plugin-1.0.0-linux.zip   (Linux)
```

## 📊 统计

- **代码**: 5000+ 行
- **文件**: 100+ 个
- **文档**: 15+ 篇
- **示例**: 3 个插件
- **工具**: 5 个构建工具

## 🤝 贡献

欢迎贡献插件和改进！

1. Fork 项目
2. 创建插件
3. 测试功能
4. 提交 PR

## 📄 许可证

MIT

## 🙏 致谢

感谢所有贡献者和用户！

---

**状态**: 生产就绪 ✅  
**版本**: 1.0.0  
**更新**: 2025-10-03
