# 动态插件页面系统

## 🚀 核心特性

插件页面系统支持在主程序编译后完全动态地加载和注册页面，无需重新编译主程序。

## 🔧 技术实现

### 1. 运行时路由注册

```typescript
// 插件加载时动态添加路由
this.router.addRoute({
  path: `/plugin/${pluginId}/${pagePath}`,
  name: pageId,
  component: PluginPageComponent,  // 动态组件
  meta: { pluginPage: true }
})
```

### 2. 动态组件系统

```typescript
// 插件可以在运行时创建组件
const DynamicPage = defineComponent({
  name: 'DynamicPage',
  setup() {
    // 组件逻辑
    return () => h('div', '动态创建的页面')
  }
})

// 注册到路由系统
context.registerPage({
  path: '/dynamic',
  component: DynamicPage
})
```

### 3. 热插拔支持

```typescript
// 插件卸载时自动清理路由
unregisterPage() {
  // 移除路由记录
  this.registeredPages.delete(pageId)
  // 更新导航
  this.notifyNavigationChange()
}
```

## 📦 插件包结构

动态插件页面的典型结构：

```
my-plugin/
├── manifest.json          # 插件清单
├── index.ts              # 插件入口
├── pages/                # 页面组件
│   ├── MainPage.vue      # 主页面
│   ├── SettingsPage.vue  # 设置页面
│   └── components/       # 页面组件
└── assets/               # 静态资源
```

## 🔄 动态加载流程

### 1. 插件安装
```
用户安装插件 → 解压到插件目录 → 更新插件列表
```

### 2. 插件加载
```
启用插件 → 加载插件代码 → 执行 onLoad → 注册页面
```

### 3. 页面访问
```
用户访问页面 → 路由匹配 → 渲染插件组件
```

### 4. 插件卸载
```
禁用插件 → 执行 onUnload → 清理路由 → 移除页面
```

## 💡 实际应用示例

### 示例1：简单页面插件

```typescript
// plugins/hello-world/index.ts
export default definePlugin({
  name: 'hello-world',
  
  async onLoad(context) {
    // 动态创建页面组件
    const HelloPage = defineComponent({
      setup() {
        return () => h('div', { class: 'pa-6' }, [
          h('h1', 'Hello World!'),
          h('p', '这是一个动态加载的插件页面')
        ])
      }
    })
    
    // 注册页面
    return context.registerPage({
      path: '/hello',
      component: HelloPage,
      title: 'Hello World',
      showInNavigation: true
    })
  }
})
```

### 示例2：复杂应用插件

```typescript
// plugins/todo-app/index.ts
export default definePlugin({
  name: 'todo-app',
  
  async onLoad(context) {
    // 导入页面组件（可以是外部文件）
    const TodoListPage = await import('./pages/TodoListPage.vue')
    const TodoDetailPage = await import('./pages/TodoDetailPage.vue')
    
    // 注册多个页面
    const cleanups = [
      context.registerPage({
        path: '/todos',
        component: TodoListPage.default,
        title: '待办事项',
        icon: 'mdi-check-circle'
      }),
      
      context.registerPage({
        path: '/todos/:id',
        component: TodoDetailPage.default,
        title: '待办详情',
        showInNavigation: false
      })
    ]
    
    return () => cleanups.forEach(cleanup => cleanup())
  }
})
```

## 🌟 高级特性

### 1. 异步组件加载

```typescript
// 支持异步组件
const AsyncPage = defineAsyncComponent(() => 
  import('./components/HeavyPage.vue')
)

context.registerPage({
  path: '/heavy',
  component: AsyncPage
})
```

### 2. 条件页面注册

```typescript
// 根据条件动态注册页面
const config = await context.getConfig('features')

if (config.enableAdvanced) {
  context.registerPage({
    path: '/advanced',
    component: AdvancedPage
  })
}
```

### 3. 页面间通信

```typescript
// 页面可以通过插件上下文通信
const PageA = defineComponent({
  setup() {
    const sendMessage = () => {
      context.emit('page-message', { from: 'PageA', data: 'Hello' })
    }
    
    return () => h('button', { onClick: sendMessage }, '发送消息')
  }
})

const PageB = defineComponent({
  setup() {
    context.on('page-message', (data) => {
      console.log('收到消息:', data)
    })
    
    return () => h('div', '等待消息...')
  }
})
```

## 🔒 安全考虑

### 1. 路径隔离
- 所有插件页面路径自动添加 `/plugin/{pluginId}/` 前缀
- 避免插件间路径冲突
- 防止覆盖系统路由

### 2. 组件隔离
- 插件组件在独立作用域中运行
- 无法直接访问其他插件的组件
- 通过插件上下文进行受控交互

### 3. 资源管理
- 插件卸载时自动清理所有注册的路由
- 防止内存泄漏
- 确保系统稳定性

## 📊 性能优化

### 1. 懒加载
```typescript
// 页面组件懒加载
const LazyPage = defineAsyncComponent({
  loader: () => import('./HeavyPage.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorPage,
  delay: 200,
  timeout: 3000
})
```

### 2. 代码分割
```typescript
// 按需加载页面资源
const loadPageResources = async () => {
  const [component, styles, data] = await Promise.all([
    import('./PageComponent.vue'),
    import('./page-styles.css'),
    fetchPageData()
  ])
  
  return { component, styles, data }
}
```

### 3. 缓存策略
```typescript
// 页面组件缓存
const componentCache = new Map()

const getCachedComponent = (pageId: string) => {
  if (!componentCache.has(pageId)) {
    componentCache.set(pageId, createPageComponent(pageId))
  }
  return componentCache.get(pageId)
}
```

## 🛠️ 开发工具

### 1. 热重载支持
```typescript
// 开发模式下支持页面热重载
if (import.meta.hot) {
  import.meta.hot.accept('./PageComponent.vue', (newModule) => {
    // 更新页面组件
    updatePageComponent(newModule.default)
  })
}
```

### 2. 调试工具
```javascript
// 浏览器控制台调试
window.__pluginPages = {
  list: () => __pluginLoader.getPageManager().getPluginPages(),
  navigate: (path) => __pluginLoader.getPageManager().navigateToPage(path),
  reload: (pluginId) => __pluginLoader.reloadPlugin(pluginId)
}
```

## 🎯 总结

动态插件页面系统的核心优势：

1. **零编译部署** - 插件页面可以在运行时动态加载
2. **热插拔支持** - 插件可以随时安装、卸载、更新
3. **完全隔离** - 插件间互不干扰，系统稳定性高
4. **无限扩展** - 支持任意复杂的页面应用
5. **开发友好** - 提供完整的开发工具和调试支持

这使得 Ling Pet 具备了真正的插件生态能力，用户可以通过安装插件来扩展应用功能，而无需重新编译或重启应用。