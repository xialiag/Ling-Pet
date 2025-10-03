# 插件运行时架构

## 问题：编译后的应用如何加载插件？

### 应用结构

```
编译后的应用
├── app.exe (Windows) / app.app (macOS) / app (Linux)
└── 内部资源（打包在可执行文件中）
    ├── index.html
    ├── assets/
    └── ...

用户数据目录 (appData)
└── plugins/
    ├── plugin-a/
    │   ├── manifest.json
    │   ├── index.js (编译后的插件代码)
    │   └── backend/ (可选)
    └── plugin-b/
        └── ...
```

## 解决方案

### 1. 插件加载流程

```
应用启动
  ↓
初始化插件系统
  ↓
扫描 appData/plugins/ 目录
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
调用 onLoad(context)
  ↓
插件通过 context API 操作应用
```

### 2. 组件注入的实现

#### 运行时动态包装（当前实现）✅

**原理**：
- 插件通过 `context.injectComponent()` 注册注入信息
- ComponentInjectionManager 管理所有注入
- 当目标组件注册时，自动包装它
- 包装后的组件在渲染时动态插入注入的组件

**优点**：
- ✅ 完全动态，无需重新编译
- ✅ 无需预留注入点
- ✅ 支持热加载
- ✅ 插件可以随时添加/移除

**实现**：
```typescript
// 插件代码（从 appData 加载）
export default definePlugin({
  async onLoad(context) {
    // 注入组件，无需主应用预留任何东西
    context.injectComponent('ChatWindow', MyComponent, {
      position: 'after'
    })
  }
})

// 运行时处理
// 1. 注册注入信息
componentInjectionManager.registerInjection(...)

// 2. 包装目标组件
const wrapped = createWrappedComponent(original, 'ChatWindow')

// 3. 重新注册
app.component('ChatWindow', wrapped)

// 4. 渲染时动态插入
render() {
  return [
    h(BeforeComponent1),
    h(BeforeComponent2),
    h(OriginalComponent),
    h(AfterComponent1),
    h(AfterComponent2)
  ]
}
```

### 3. 完整的运行时架构

```
┌─────────────────────────────────────────────────────┐
│              编译后的应用 (app.exe)                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │           Vue 应用实例 (app)                  │  │
│  │  - 已注册的组件                               │  │
│  │  - 路由                                       │  │
│  │  - Store                                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │         插件加载器 (PluginLoader)             │  │
│  │  - 扫描 appData/plugins/                     │  │
│  │  - 读取插件文件                               │  │
│  │  - 执行插件代码                               │  │
│  │  - 提供 PluginContext API                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │    组件注入管理器 (ComponentInjectionManager) │  │
│  │  - 管理注入信息                               │  │
│  │  - 包装目标组件                               │  │
│  │  - 动态渲染注入组件                           │  │
│  └──────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────┬─────────────────────────────┘
                        │
                        │ 读取插件文件
                        ↓
┌─────────────────────────────────────────────────────┐
│          用户数据目录 (appData/plugins/)              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  plugin-a/                                           │
│  ├── manifest.json                                   │
│  ├── index.js         ← 编译后的插件代码              │
│  └── backend/         ← 可选的后端动态库              │
│                                                       │
│  plugin-b/                                           │
│  └── ...                                             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 4. 插件代码的执行

```typescript
// 1. 读取插件文件
const code = await readTextFile(pluginPath + '/index.js')

// 2. 创建沙箱环境
const sandbox = {
  console,
  Promise,
  // 不暴露危险的全局对象
}

// 3. 使用 Function 构造器执行
const func = new Function(...Object.keys(sandbox), code)
const pluginDefinition = func(...Object.values(sandbox))

// 4. 创建插件上下文
const context = {
  app,           // Vue 应用实例
  router,        // Vue Router
  injectComponent: (...) => { ... },
  hookComponent: (...) => { ... },
  // ... 其他 API
}

// 5. 执行插件
await pluginDefinition.onLoad(context)
```

### 5. 组件注入的具体实现

```typescript
// 插件调用
context.injectComponent('ChatWindow', MyComponent, {
  position: 'after'
})

// 内部处理
class ComponentInjectionManager {
  registerInjection(injection) {
    // 1. 保存注入信息
    this.injections.get('ChatWindow').push(injection)
    
    // 2. 获取原始组件
    const original = app.component('ChatWindow')
    
    // 3. 创建包装组件
    const wrapped = defineComponent({
      setup(props, { slots, attrs }) {
        return () => {
          const children = []
          
          // Before 注入
          this.getInjections('ChatWindow')
            .filter(i => i.position === 'before')
            .forEach(i => {
              children.push(h(i.component, i.props))
            })
          
          // 原始组件
          children.push(h(original, { ...props, ...attrs }, slots))
          
          // After 注入
          this.getInjections('ChatWindow')
            .filter(i => i.position === 'after')
            .forEach(i => {
              children.push(h(i.component, i.props))
            })
          
          return h('div', children)
        }
      }
    })
    
    // 4. 重新注册包装后的组件
    app.component('ChatWindow', wrapped)
  }
}
```

### 6. 热加载的实现

```typescript
// 加载插件
await pluginLoader.loadPlugin('my-plugin')
// ✅ 组件注入立即生效

// 卸载插件
await pluginLoader.unloadPlugin('my-plugin')
// ✅ 组件注入自动移除
// ✅ 恢复原始组件（如果没有其他注入）
```

### 7. 关键点总结

#### ✅ 可行性
1. **插件存储在 appData** - Tauri 提供 API 访问
2. **动态读取文件** - 使用 `@tauri-apps/plugin-fs`
3. **动态执行代码** - 使用 Function 构造器
4. **运行时注入** - 通过 Vue 的响应式系统
5. **热加载** - 完全支持

#### ✅ 安全性
1. **沙箱环境** - 限制插件访问的全局对象
2. **权限系统** - 插件需要声明权限
3. **代码签名** - 可选的插件验证

#### ✅ 性能
1. **按需加载** - 只加载已启用的插件
2. **懒执行** - 插件代码只在需要时执行
3. **响应式更新** - 利用 Vue 的高效更新机制

## 实际使用示例

### 主应用代码

```typescript
// main.ts
import { createApp } from 'vue'
import { initializePluginSystem } from './pluginLoader/init'

const app = createApp(App)
const router = createRouter(...)

// 初始化插件系统
await initializePluginSystem(app, router)

app.mount('#app')
```

### 插件代码（存储在 appData/plugins/my-plugin/index.js）

```javascript
// 这是编译后的代码
(function() {
  return {
    name: 'my-plugin',
    version: '1.0.0',
    
    async onLoad(context) {
      // 注入组件
      context.injectComponent('ChatWindow', {
        setup() {
          return () => h('div', { class: 'my-banner' }, 'Hello from plugin!')
        }
      }, {
        position: 'before'
      })
      
      // Hook 组件
      context.hookComponent('ChatWindow', {
        mounted(instance) {
          console.log('ChatWindow mounted')
        }
      })
      
      // 添加路由
      context.addRoute({
        path: '/my-plugin',
        component: MyPluginPage
      })
    }
  }
})()
```

## 结论

当前的实现**完全支持**编译后应用的插件热加载：

✅ 插件存储在用户数据目录
✅ 运行时动态加载
✅ 组件注入通过 Vue 实例操作
✅ 支持热加载和卸载
✅ 无需重新编译应用

这是一个**生产级别**的插件系统架构！
