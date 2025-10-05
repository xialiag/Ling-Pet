# 插件开发快速参考

> 快速查找常用命令和API。详细说明请查看 [插件系统完整指南](../../PLUGIN_SYSTEM_COMPLETE_GUIDE.md)

## 🚀 常用命令

### 插件管理
```bash
npm run plugin:create <name>        # 创建新插件
npm run plugin:build <name>         # 构建指定插件
npm run plugin:build-all           # 构建所有插件
npm run plugin:release <name>       # 打包插件为zip
npm run plugin:clean               # 清理构建产物
```

### 开发调试
```bash
npm run plugin:scan                # 扫描可Hook符号
npm run plugin:validate <name>     # 验证插件
npm run plugin:test                # 测试插件系统
npm run dev                        # 启动开发服务器
```

## 📝 快速开始

### 1. 创建插件
```bash
cd pluginLoader/plugins
mkdir my-plugin && cd my-plugin

# 创建 package.json
echo '{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "index.ts"
}' > package.json

# 创建插件代码
echo 'import { definePlugin } from "../../core/pluginApi"
export default definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  async onLoad(context) {
    context.debug("插件已加载！")
  }
})' > index.ts
```

### 2. 构建和测试
```bash
cd ../../../
npm run plugin:build my-plugin
npm run dev  # 在应用中测试
```

## 🔧 核心API速查

### 基础功能
```typescript
context.debug('消息', data)                    // 调试日志
context.getConfig('key', default)              // 获取配置
await context.setConfig('key', value)          // 保存配置
await context.invokeTauri('command', args)     // 调用Tauri
```

### Vue集成
```typescript
// 组件注入
context.injectComponent('Target', Component, {
  position: 'after',
  props: { data }
})

// Hook组件
context.hookComponent('Component', {
  mounted(instance) { /* ... */ }
})

// Hook Store
context.hookStore('store', {
  afterAction(name, args, result) { /* ... */ }
})
```

### DOM操作
```typescript
// HTML注入
context.injectHTML('.selector', '<div>内容</div>', {
  position: 'append'
})

// CSS注入
context.injectCSS('.my-style { color: red; }')

// Vue组件注入到DOM
await context.injectVueComponent('.selector', Component, props)
```

### LLM工具
```typescript
context.registerTool({
  name: 'my_tool',
  description: '工具描述',
  parameters: [
    { name: 'param', type: 'string', required: true }
  ],
  handler: async (args) => '结果',
  category: 'utility'
})
```

### 插件通信
```typescript
// 事件
context.on('event', handler)
context.emit('event', data)

// RPC
context.registerRPC('method', handler)
await context.callRPC('plugin', 'method', params)
```

### 后端集成
```typescript
await context.callBackend('function', args)    // 调用后端
await context.getBackendStatus()               // 后端状态
await context.getBackendMetrics()              // 性能指标
await context.restartBackend()                 // 热重载
```

### 页面系统
```typescript
context.registerPage({
  path: '/page',
  component: Component,
  title: '页面标题',
  showInNavigation: true
})
```

## 🦀 Rust后端速查

### 基础结构
```rust
// Cargo.toml
[lib]
name = "plugin"
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 必需函数
```rust
#[no_mangle]
pub extern "C" fn plugin_init() { }

#[no_mangle]
pub extern "C" fn plugin_cleanup() { }

#[no_mangle]
pub extern "C" fn plugin_health_check() -> bool { true }

#[no_mangle]
pub extern "C" fn plugin_free_string(ptr: *mut i8) { }
```

### 业务函数模板
```rust
#[no_mangle]
pub extern "C" fn plugin_my_function(args_ptr: *const i8) -> *mut i8 {
    if args_ptr.is_null() {
        return std::ptr::null_mut();
    }
    
    unsafe {
        let args_cstr = CStr::from_ptr(args_ptr);
        let args_str = args_cstr.to_str().unwrap();
        let args: serde_json::Value = serde_json::from_str(args_str).unwrap();
        
        // 业务逻辑
        let result = process_data(&args);
        
        let result_json = serde_json::to_string(&result).unwrap();
        CString::new(result_json).unwrap().into_raw()
    }
}
```

## 🔧 直接使用工具

### 编译工具
```bash
node pluginLoader/tools/compiler.cjs <plugin-path>
node pluginLoader/tools/compiler.cjs <plugin-path> --watch
```

### 打包工具
```bash
node pluginLoader/tools/packager.cjs <plugin-path>
node pluginLoader/tools/packager.cjs <plugin-path> --out-dir ./releases
```

### 任务运行器
```bash
node pluginLoader/tools/tasks.cjs clean    # 清理
node pluginLoader/tools/tasks.cjs check    # 检查
node pluginLoader/tools/tasks.cjs release  # 发布
```

## 📁 目录结构

```
my-plugin/
├── package.json          # 插件配置
├── index.ts             # 前端入口
├── README.md            # 说明文档
├── assets/              # 资源文件（可选）
└── backend/             # Rust后端（可选）
    ├── Cargo.toml
    └── src/lib.rs
```

## 🐛 调试技巧

### 浏览器控制台
```javascript
__pluginLoader.getLoadedPlugins()     // 查看已加载插件
__domInjectionManager.getStats()      // DOM注入统计
forceCheckInjections()                // 强制检查注入
```

### 日志调试
```typescript
// 前端详细日志
context.debug('详细信息:', { data, status, timestamp: Date.now() })

// 后端日志订阅
context.subscribeBackendLogs((log) => {
  console.log(`[${log.level}] ${log.message}`)
})
```

### 性能分析
```typescript
// 执行时间测量
const start = performance.now()
await operation()
context.debug(`耗时: ${performance.now() - start}ms`)

// 后端指标
const metrics = await context.getBackendMetrics()
console.log('后端指标:', metrics)
```

## 📊 输出目录

```
dist/plugins/           # 编译后的插件
releases/plugins/       # 打包后的插件（.zip）
pluginLoader/tools/symbol-map.json  # 符号映射
```

## 🎯 开发工作流

```
创建 → 开发 → 构建 → 测试 → 发布
  ↓      ↓      ↓      ↓      ↓
create  code   build  debug package
```

---

*更多详细信息请查看 [插件系统完整指南](../../PLUGIN_SYSTEM_COMPLETE_GUIDE.md)*

## 🐛 常见问题

### 编译失败
```bash
# 查看详细错误
node pluginLoader/tools/compiler.cjs <path> --verbose

# 检查 TypeScript
cd pluginLoader/plugins/my-plugin
npx tsc --noEmit
```

### Rust 编译失败
```bash
# 检查 Rust
rustc --version
cargo --version

# 手动编译
cd pluginLoader/plugins/my-plugin/backend
cargo build --release
```

### 监听不工作
```bash
# Linux: 增加监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 💡 提示

- ✅ 开发时用 `--no-minify`（代码可读）
- ✅ 发布前运行 `plugin:check`（验证完整性）
- ✅ 使用监听模式提高效率
- ✅ 定期清理构建产物
- ✅ 遵循语义化版本

## 📚 文档

- [完整文档](./README.md)
- [快速入门](./QUICKSTART.md)
- [使用示例](./USAGE_EXAMPLES.md)

## 🔗 相关

- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构](../docs/plugin-architecture.md)
- [API 文档](../types/api.ts)
