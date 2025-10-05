# Ling-Pet 插件系统完整指南

> 为 Ling-Pet 桌宠应用设计的无侵入式插件系统，支持运行时扩展和 AI 工具集成

## 📋 目录

- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [插件开发](#插件开发)
- [后端开发](#后端开发)
- [API参考](#api参考)
- [工具和命令](#工具和命令)
- [示例插件](#示例插件)
- [故障排除](#故障排除)

---

## 🚀 快速开始

### 用户：安装插件

1. **下载插件包** - 获取 `.zip` 格式的插件文件
2. **打开插件管理** - 应用 > 设置 > 插件管理
3. **安装插件** - 点击"安装插件"并选择文件
4. **启用插件** - 在插件列表中启用插件

### 开发者：创建插件

```bash
# 1. 创建新插件
cd pluginLoader/plugins
mkdir my-plugin && cd my-plugin

# 2. 创建基础文件
echo '{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的第一个插件",
  "main": "index.ts"
}' > package.json

# 3. 创建插件代码
echo 'import { definePlugin } from "../../core/pluginApi"

export default definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  
  async onLoad(context) {
    context.debug("插件已加载！")
  }
})' > index.ts

# 4. 构建插件
cd ../../../
npm run plugin:build my-plugin
```

---

## 🎯 核心概念

### 设计理念

**无侵入式扩展** - 在不修改主应用源码的前提下，实现功能的无限扩展

### 核心特性

- 🔌 **零源码修改** - 通过 Vue 实例拦截和智能注入实现扩展
- 🔥 **热插拔支持** - 运行时加载/卸载，无需重启应用
- 🤖 **AI 工具集成** - 为桌宠 LLM 提供丰富的工具能力
- 🛡️ **权限控制** - 细粒度权限管理确保安全性
- 🌐 **跨平台支持** - Windows/macOS/Linux 统一架构
- 📊 **实时监控** - 性能指标、日志系统、健康检查

### 系统架构

```
┌─────────────────────────────────────┐
│         主应用 (Vue + Tauri)         │
├─────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │     插件加载器 (PluginLoader)   │ │
│  └────────────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │Hook引擎  │ │包管理器  │ │运行时│ │
│  └──────────┘ └──────────┘ └──────┘ │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
   ┌────▼───┐ ┌──▼───┐ ┌───▼────┐
   │插件A   │ │插件B │ │插件C   │
   │(前端)  │ │(混合)│ │(前端)  │
   └────────┘ └──────┘ └────────┘
```

---

## 🔧 插件开发

### 插件结构

```
my-plugin/
├── package.json          # 插件配置
├── index.ts             # 前端入口
├── README.md            # 说明文档
├── assets/              # 资源文件（可选）
└── backend/             # 后端代码（可选）
    ├── Cargo.toml
    └── src/lib.rs
```

### 基础插件示例

```typescript
import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: 'hello-world',
  version: '1.0.0',
  description: '简单的问候插件',
  
  async onLoad(context: PluginContext) {
    context.debug('Hello World 插件加载中...')
    
    // 注入HTML内容
    const cleanup = context.injectHTML('body', `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 9999;
      ">
        Hello from Plugin!
      </div>
    `, { position: 'append' })
    
    // 注册LLM工具
    const unregisterTool = context.registerTool({
      name: 'say_hello',
      description: '向用户问好',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: '用户名称',
          required: true
        }
      ],
      handler: async (args) => {
        return `Hello, ${args.name}! 很高兴见到你！`
      },
      category: 'greeting',
      examples: ['say_hello({"name": "张三"})']
    })
    
    // 返回清理函数
    return () => {
      cleanup()
      unregisterTool()
    }
  },
  
  async onUnload(context: PluginContext) {
    context.debug('Hello World 插件已卸载')
  }
})
```

### 高级功能

#### 1. Vue组件注入

```typescript
// 注入到现有组件
const cleanup = context.injectComponent('Live2DAvatar', MyComponent, {
  position: 'after',
  props: { message: 'Hello' },
  order: 1
})
```

#### 2. Hook系统

```typescript
// Hook Vue组件
context.hookComponent('ChatWindow', {
  mounted(instance) {
    console.log('聊天窗口已挂载')
  }
})

// Hook Pinia Store
context.hookStore('chatStore', {
  afterAction(name, args, result) {
    if (name === 'sendMessage') {
      console.log('消息已发送:', args[0])
    }
  }
})
```

#### 3. 插件页面系统

```typescript
// 注册插件页面
context.registerPage({
  path: '/my-plugin',
  component: MyPageComponent,
  title: '我的插件页面',
  icon: 'mdi-puzzle',
  showInNavigation: true
})
```

#### 4. 插件间通信

```typescript
// 事件通信
context.on('my-event', (data) => {
  console.log('收到事件:', data)
})
context.emit('my-event', { message: 'Hello' })

// RPC调用
context.registerRPC('my-method', async (params) => {
  return { result: 'success' }
})
const result = await context.callRPC('other-plugin', 'their-method', params)
```

#### 5. 配置管理

插件系统支持丰富的配置类型和高级特性：

**支持的配置类型**：
- `string` - 文本输入框
- `textarea` - 多行文本
- `number` - 数字输入
- `range` - 范围滑块
- `boolean` - 开关按钮
- `select` - 下拉选择
- `multiselect` - 多选下拉
- `color` - 颜色选择器
- `file` - 文件选择
- `group` - 配置分组

```typescript
// 完整配置示例
export default definePlugin({
  configSchema: {
    // 基础设置分组
    basic: {
      type: 'group',
      label: '基础设置',
      expanded: true,
      children: {
        apiKey: {
          type: 'string',
          label: 'API密钥',
          description: '用于访问外部服务',
          secret: true,
          required: true,
          placeholder: '请输入API密钥'
        },
        enabled: {
          type: 'boolean',
          label: '启用功能',
          default: true
        },
        maxRetries: {
          type: 'number',
          label: '最大重试次数',
          default: 3,
          min: 1,
          max: 10,
          unit: '次'
        }
      }
    },
    
    // 高级设置分组
    advanced: {
      type: 'group',
      label: '高级设置',
      collapsible: true,
      children: {
        theme: {
          type: 'select',
          label: '主题',
          default: 'auto',
          options: [
            { label: '自动', value: 'auto' },
            { label: '浅色', value: 'light' },
            { label: '深色', value: 'dark' }
          ]
        },
        customColor: {
          type: 'color',
          label: '自定义颜色',
          default: '#4CAF50',
          condition: (config) => config.theme === 'custom'
        }
      }
    }
  },
  
  async onLoad(context) {
    // 读取配置
    const apiKey = context.getConfig('apiKey', '')
    const enabled = context.getConfig('enabled', true)
    
    // 保存配置
    await context.setConfig('lastUsed', Date.now())
  }
})
```

---

## 🦀 后端开发

### 创建Rust后端

#### 1. 项目结构

```
my-plugin/
├── package.json
├── index.ts
└── backend/
    ├── Cargo.toml
    └── src/
        └── lib.rs
```

#### 2. Cargo.toml配置

```toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
name = "plugin"
crate-type = ["cdylib"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
log = "0.4"
lazy_static = "1.4"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

#### 3. 后端实现

```rust
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

// 插件初始化
#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[Backend] Plugin initialized");
}

// 插件清理
#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[Backend] Plugin cleaned up");
}

// 健康检查
#[no_mangle]
pub extern "C" fn plugin_health_check() -> bool {
    true
}

// 业务函数
#[no_mangle]
pub extern "C" fn plugin_process_data(args_ptr: *const i8) -> *mut i8 {
    if args_ptr.is_null() {
        return std::ptr::null_mut();
    }
    
    unsafe {
        let args_cstr = CStr::from_ptr(args_ptr);
        let args_str = match args_cstr.to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        
        let args: serde_json::Value = match serde_json::from_str(args_str) {
            Ok(v) => v,
            Err(_) => return std::ptr::null_mut(),
        };
        
        let input = args["input"].as_str().unwrap_or("");
        let result = ProcessResult {
            success: true,
            data: Some(format!("Processed: {}", input)),
            error: None,
        };
        
        let result_json = serde_json::to_string(&result).unwrap();
        CString::new(result_json).unwrap().into_raw()
    }
}

// 释放内存
#[no_mangle]
pub extern "C" fn plugin_free_string(ptr: *mut i8) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}
```

#### 4. 前端调用后端

```typescript
// 在package.json中配置后端
{
  "backend": {
    "enabled": true,
    "type": "rust",
    "entry": "backend/target/release/plugin.dll"
  }
}

// 前端调用
export default definePlugin({
  async onLoad(context) {
    // 检查后端状态
    const isReady = await context.getBackendStatus()
    if (!isReady) return
    
    // 调用后端函数
    const result = await context.callBackend('process_data', {
      input: 'Hello from frontend!'
    })
    
    context.debug('后端结果:', result)
  }
})
```

### 后端高级功能

#### 1. 实时日志系统

```rust
use log::{info, warn, error};

#[no_mangle]
pub extern "C" fn plugin_my_function(args_ptr: *const i8) -> *mut i8 {
    info!("Function called with args");
    
    // 业务逻辑
    let result = process_business_logic();
    
    if result.is_ok() {
        info!("Function completed successfully");
    } else {
        error!("Function failed: {:?}", result.err());
    }
    
    // 返回结果...
}
```

#### 2. 状态管理（热重载支持）

```rust
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

lazy_static::lazy_static! {
    static ref PLUGIN_STATE: Arc<RwLock<HashMap<String, serde_json::Value>>> = 
        Arc::new(RwLock::new(HashMap::new()));
}

// 保存状态
#[no_mangle]
pub extern "C" fn plugin_save_state() -> *mut i8 {
    let state = PLUGIN_STATE.read().unwrap();
    let state_json = serde_json::to_string(&*state).unwrap();
    CString::new(state_json).unwrap().into_raw()
}

// 恢复状态
#[no_mangle]
pub extern "C" fn plugin_restore_state(state_ptr: *const i8) -> bool {
    // 恢复状态逻辑
    true
}
```

#### 3. 构建脚本

```bash
#!/bin/bash
# build.sh

echo "🔨 构建插件..."

# 构建后端
cd backend
cargo build --release
cd ..

# 构建前端
cd ../../../
npm run plugin:build my-plugin

echo "✅ 构建完成！"
```

---

## 📚 API参考

### PluginContext 核心API

#### 基础功能

```typescript
// 调试日志
context.debug('消息', data)

// 配置管理
const value = context.getConfig('key', defaultValue)
await context.setConfig('key', value)

// Tauri命令调用
const result = await context.invokeTauri('command', args)
```

#### Vue集成

```typescript
// 组件注入
context.injectComponent(target, component, options)

// Hook组件
context.hookComponent(name, hooks)

// Hook Store
context.hookStore(name, hooks)
```

#### DOM操作

```typescript
// HTML注入
context.injectHTML(selector, html, options)

// CSS注入
context.injectCSS(css, options)

// Vue组件注入到DOM
await context.injectVueComponent(selector, component, props, options)

// 元素查询
const element = context.querySelector(selector)
const elements = context.querySelectorAll(selector)

// 等待元素
const element = await context.waitForElement(selector, timeout)
```

#### 工具系统

```typescript
// 注册LLM工具
context.registerTool({
  name: 'tool_name',
  description: '工具描述',
  parameters: [
    {
      name: 'param',
      type: 'string',
      description: '参数描述',
      required: true
    }
  ],
  handler: async (args) => {
    return '工具执行结果'
  },
  category: 'utility',
  examples: ['tool_name({"param": "value"})']
})

// 调用工具
const result = await context.callTool('tool_name', args)

// 获取可用工具
const tools = context.getAvailableTools()
```

#### 插件通信

```typescript
// 事件系统
context.on('event', handler)
context.emit('event', data)
context.off('event', handler)

// 消息系统
context.sendMessage(targetPlugin, type, data)
context.onMessage(handler)

// RPC调用
context.registerRPC('method', handler)
await context.callRPC(targetPlugin, 'method', ...params)

// 共享状态
const state = context.createSharedState('key', initialValue, options)
const otherState = context.getSharedState(targetPlugin, 'key')
```

#### 后端集成

```typescript
// 后端调用
await context.callBackend('function_name', args)

// 后端状态
const isReady = await context.getBackendStatus()
const commands = await context.getBackendCommands()

// 后端管理（新增功能）
const metrics = await context.getBackendMetrics()
const isHealthy = await context.checkBackendHealth()
await context.restartBackend()

// 日志订阅
const unsubscribe = context.subscribeBackendLogs((log) => {
  console.log(`[${log.level}] ${log.message}`)
})
```

#### 页面系统

```typescript
// 注册页面
context.registerPage({
  path: '/my-page',
  component: MyComponent,
  title: '页面标题',
  icon: 'mdi-icon',
  showInNavigation: true,
  container: {
    useDefault: true,
    showHeader: true,
    showMenu: true
  }
})

// 导航到页面
context.navigateToPage('page-id')

// 外部页面组件
context.registerExternalPage({
  path: '/external',
  componentPath: './pages/ExternalPage.vue',
  title: '外部页面'
})
```

#### 设置页面集成

```typescript
// 注册设置页面操作按钮
const unregister = context.registerSettingsAction({
  label: '下载表情包',
  icon: 'mdi-download',
  color: 'primary',
  variant: 'outlined',
  handler: async () => {
    // 执行操作
    await downloadEmojis()
  }
})
```

### 文件系统

```typescript
// 获取目录
const appDataDir = await context.getAppDataDir()

// 文件操作
const entries = await context.fs.readDir(path)
const content = await context.fs.readFile(path)
await context.fs.writeFile(path, content)
const exists = await context.fs.exists(path)
await context.fs.mkdir(path, { recursive: true })
await context.fs.remove(path)
```

---

## 🛠️ 工具和命令

### CLI命令

```bash
# 插件管理
npm run plugin:create <name>        # 创建插件
npm run plugin:build <name>         # 构建插件
npm run plugin:release <name>       # 打包插件
npm run plugin:clean               # 清理构建产物

# 批量操作
npm run plugin:build-all           # 构建所有插件
npm run plugin:package-all         # 打包所有插件

# 开发工具
npm run plugin:scan                # 扫描可Hook符号
npm run plugin:validate <name>     # 验证插件
npm run plugin:test                # 测试插件系统
```

### 直接使用工具

```bash
# 编译工具
node pluginLoader/tools/compiler.cjs <plugin-path>

# 打包工具
node pluginLoader/tools/packager.cjs <plugin-path>

# 批量构建
node pluginLoader/tools/build-all.cjs

# 任务运行器
node pluginLoader/tools/tasks.cjs clean
node pluginLoader/tools/tasks.cjs check
node pluginLoader/tools/tasks.cjs release
```

### 开发调试

```javascript
// 浏览器控制台调试
__pluginLoader.getLoadedPlugins()     // 查看已加载插件
__domInjectionManager.getStats()      // DOM注入统计
forceCheckInjections()                // 强制检查注入
```

---

## 📦 示例插件

### 1. Hello World 插件

最简单的插件示例，展示基础功能。

**功能**：
- 页面横幅显示
- LLM问候工具
- 基础配置管理

**文件**：`pluginLoader/plugins/hello-world/`

### 2. B站表情包插件

完整的生产级插件，包含Rust后端。

**功能**：
- 扫描本地表情包
- 搜索B站装扮
- 下载表情包
- 7个LLM工具
- 完整的后端实现

**文件**：`pluginLoader/plugins/bilibili-emoji/`

### 3. 后端演示插件

展示增强后端功能的插件。

**功能**：
- 实时日志系统
- 热重载支持
- 状态管理
- 性能监控
- 健康检查

**文件**：`pluginLoader/plugins/backend-demo/`

### 4. 设置演示插件

展示配置系统的各种功能。

**功能**：
- 各种配置类型
- 配置验证
- 动态配置
- 设置页面操作

**文件**：`pluginLoader/plugins/settings-demo/`

### 5. 页面系统插件

展示插件页面系统的功能。

**功能**：
- 多种容器模式
- 动态页面加载
- 页面导航
- 外部组件

**文件**：`pluginLoader/plugins/page-demo/`

---

## 🐛 故障排除

### 常见问题

#### 1. 插件加载失败

**症状**：插件无法加载或启动时报错

**解决方案**：
```bash
# 检查插件文件结构
ls pluginLoader/plugins/my-plugin/

# 验证package.json格式
cat pluginLoader/plugins/my-plugin/package.json | jq .

# 检查TypeScript语法
npx tsc --noEmit pluginLoader/plugins/my-plugin/index.ts

# 查看详细错误
# 打开浏览器控制台查看错误信息
```

#### 2. 后端调用失败

**症状**：前端无法调用后端函数

**解决方案**：
```bash
# 检查后端编译
cd pluginLoader/plugins/my-plugin/backend
cargo build --release

# 检查动态库文件
ls target/release/plugin.*

# 验证函数导出
nm target/release/libplugin.so | grep plugin_

# 检查后端状态
# 在前端调用 context.getBackendStatus()
```

#### 3. Hook不生效

**症状**：组件或Store Hook没有执行

**解决方案**：
```bash
# 生成符号映射
npm run plugin:scan

# 检查符号映射
cat pluginLoader/tools/symbol-map.json

# 确认组件名称正确
# 使用符号扫描器生成的名称
```

#### 4. 组件注入失败

**症状**：注入的组件没有显示

**解决方案**：
```javascript
// 检查注入状态
__domInjectionManager.getStats()

// 强制检查注入
forceCheckInjections()

// 检查目标元素是否存在
document.querySelector('target-selector')
```

### 调试技巧

#### 1. 启用详细日志

```typescript
// 插件中使用详细日志
context.debug('详细信息:', { data, status, timestamp: Date.now() })

// 后端日志
use log::{debug, info, warn, error};
debug!("详细调试信息: {:?}", data);
```

#### 2. 性能分析

```typescript
// 测量执行时间
const start = performance.now()
await someOperation()
context.debug(`操作耗时: ${performance.now() - start}ms`)

// 获取后端指标
const metrics = await context.getBackendMetrics()
context.debug('后端指标:', metrics)
```

#### 3. 状态检查

```typescript
// 检查插件状态
const plugins = __pluginLoader.getLoadedPlugins()
console.log('已加载插件:', plugins)

// 检查后端健康
const isHealthy = await context.checkBackendHealth()
console.log('后端健康状态:', isHealthy)
```

### 错误代码参考

| 错误代码 | 描述 | 解决方案 |
|---------|------|----------|
| PLUGIN_NOT_FOUND | 插件文件不存在 | 检查文件路径和名称 |
| INVALID_MANIFEST | manifest.json格式错误 | 验证JSON格式 |
| PERMISSION_DENIED | 权限不足 | 检查权限配置 |
| BACKEND_LOAD_FAILED | 后端加载失败 | 检查动态库文件 |
| HOOK_REGISTER_FAILED | Hook注册失败 | 确认目标组件存在 |
| INJECTION_FAILED | 组件注入失败 | 检查目标选择器 |

---

## 📈 最佳实践

### 1. 插件设计

- **单一职责**：每个插件专注于一个特定功能
- **最小依赖**：减少对外部库的依赖
- **优雅降级**：在功能不可用时提供备选方案
- **错误处理**：完善的错误处理和用户提示

### 2. 性能优化

- **懒加载**：按需加载组件和资源
- **防抖节流**：对频繁操作进行优化
- **内存管理**：及时清理不需要的资源
- **异步操作**：避免阻塞主线程

### 3. 用户体验

- **加载提示**：显示加载状态和进度
- **错误反馈**：友好的错误信息
- **配置简化**：提供合理的默认值
- **文档完善**：清晰的使用说明

### 4. 安全考虑

- **权限最小化**：只申请必要的权限
- **输入验证**：验证所有外部输入
- **敏感信息**：安全存储API密钥等
- **代码审查**：定期检查安全漏洞

---

## 🤝 贡献指南

### 贡献方式

1. **Fork项目** - 创建你的分支
2. **开发功能** - 实现新功能或修复bug
3. **测试验证** - 确保功能正常工作
4. **提交PR** - 详细描述你的更改

### 代码规范

- **TypeScript** - 使用TypeScript编写前端代码
- **Rust** - 使用Rust编写后端代码
- **ESLint** - 遵循ESLint规则
- **注释** - 添加清晰的注释和文档
- **测试** - 编写必要的测试用例

### 文档贡献

- **示例插件** - 提供更多示例
- **教程文档** - 编写使用教程
- **API文档** - 完善API说明
- **故障排除** - 添加常见问题解决方案

---

**开始你的插件开发之旅吧！** 🚀

---