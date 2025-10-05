# 插件页面开发指南

## 概述

插件页面系统允许插件注册自己的独立页面，用户可以通过路由导航访问这些页面。这为插件提供了完整的用户界面能力。

## 🚀 快速开始

### 1. 基本页面注册

```typescript
import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'
import { defineComponent, h } from 'vue'

// 创建页面组件
const MyPage = defineComponent({
  name: 'MyPage',
  setup() {
    return () => h('div', { class: 'pa-6' }, [
      h('h1', '我的插件页面'),
      h('p', '这是一个由插件注册的页面')
    ])
  }
})

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  async onLoad(context: PluginContext) {
    // 注册页面
    const unregisterPage = context.registerPage({
      path: '/my-page',
      name: 'my-page',
      component: MyPage,
      title: '我的页面',
      icon: 'mdi-home',
      description: '这是我的插件页面'
    })
    
    // 返回清理函数
    return () => {
      unregisterPage()
    }
  }
})
```

### 2. 页面配置选项

```typescript
interface PluginPageConfig {
  /** 路由路径 */
  path: string
  /** 路由名称 */
  name?: string
  /** 页面组件 */
  component: Component
  /** 页面标题 */
  title?: string
  /** 页面图标 */
  icon?: string
  /** 页面描述 */
  description?: string
  /** 是否在导航中显示 */
  showInNavigation?: boolean
  /** 导航分组 */
  navigationGroup?: string
  /** 路由元数据 */
  meta?: Record<string, any>
}
```

## 📄 页面路径规则

插件页面的完整路径会自动添加插件前缀：

- 配置路径：`/my-page`
- 实际路径：`/plugin/my-plugin/my-page`

这样可以避免不同插件之间的路径冲突。

## 🧭 导航管理

### 显示在导航中

```typescript
context.registerPage({
  path: '/dashboard',
  component: DashboardPage,
  title: '仪表板',
  icon: 'mdi-view-dashboard',
  showInNavigation: true,  // 显示在导航中
  navigationGroup: 'main'  // 导航分组
})
```

### 隐藏页面

```typescript
context.registerPage({
  path: '/settings',
  component: SettingsPage,
  title: '设置',
  showInNavigation: false  // 不显示在导航中
})
```

### 导航分组

常用的导航分组：

- `'main'` - 主要功能
- `'tools'` - 工具类
- `'settings'` - 设置类
- `'entertainment'` - 娱乐类
- `'productivity'` - 效率类

## 🎨 页面组件开发

### 使用 Vue 组合式 API

```typescript
import { defineComponent, ref, onMounted } from 'vue'

const MyPage = defineComponent({
  name: 'MyPage',
  setup() {
    const data = ref([])
    const loading = ref(false)
    
    const loadData = async () => {
      loading.value = true
      try {
        // 加载数据
        data.value = await fetchData()
      } finally {
        loading.value = false
      }
    }
    
    onMounted(() => {
      loadData()
    })
    
    return () => h('div', { class: 'my-page' }, [
      // 页面内容
    ])
  }
})
```

### 使用 Vuetify 组件

```typescript
const MyPage = defineComponent({
  setup() {
    return () => h('v-container', [
      h('v-row', [
        h('v-col', { cols: 12 }, [
          h('v-card', [
            h('v-card-title', '页面标题'),
            h('v-card-text', '页面内容')
          ])
        ])
      ])
    ])
  }
})
```

### 访问插件上下文

```typescript
const MyPage = defineComponent({
  setup() {
    // 获取插件上下文（如果需要）
    const pluginLoader = (window as any).__pluginLoader
    
    const saveSettings = async () => {
      // 通过插件上下文保存配置
      // 注意：这里需要获取具体的插件上下文
    }
    
    return () => h('div', [
      // 页面内容
    ])
  }
})
```

## 🔄 页面导航

### 程序化导航

```typescript
// 在插件中导航到其他页面
context.navigateToPage('my-page-id')

// 或者使用 Vue Router
context.router.push('/plugin/my-plugin/my-page')
```

### 页面间传参

```typescript
// 通过路由参数
context.registerPage({
  path: '/user/:id',
  component: UserPage
})

// 在组件中获取参数
const UserPage = defineComponent({
  setup() {
    const route = useRoute()
    const userId = route.params.id
    
    return () => h('div', `用户ID: ${userId}`)
  }
})
```

## 📱 响应式设计

```typescript
const ResponsivePage = defineComponent({
  setup() {
    return () => h('v-container', { fluid: true }, [
      h('v-row', [
        // 桌面端显示
        h('v-col', { 
          cols: 12, 
          md: 8,
          class: 'd-none d-md-block'
        }, [
          h('div', '桌面端内容')
        ]),
        
        // 移动端显示
        h('v-col', { 
          cols: 12,
          class: 'd-md-none'
        }, [
          h('div', '移动端内容')
        ])
      ])
    ])
  }
})
```

## 🛠️ 最佳实践

### 1. 页面命名

- 使用描述性的页面名称
- 避免与系统页面冲突
- 使用插件前缀避免冲突

### 2. 路径设计

```typescript
// 好的路径设计
'/dashboard'        // 主页面
'/settings'         // 设置页面
'/tools/converter'  // 工具子页面
'/help'            // 帮助页面

// 避免的路径
'/page1'           // 不描述性
'/temp'            // 临时路径
'/test'            // 测试路径
```

### 3. 组件结构

```typescript
const WellStructuredPage = defineComponent({
  name: 'WellStructuredPage',
  setup() {
    // 状态管理
    const state = reactive({
      loading: false,
      data: [],
      error: null
    })
    
    // 方法定义
    const methods = {
      async loadData() {
        // 加载逻辑
      },
      
      handleError(error: Error) {
        // 错误处理
      }
    }
    
    // 生命周期
    onMounted(() => {
      methods.loadData()
    })
    
    // 渲染函数
    return () => h('div', { class: 'page-container' }, [
      // 页面结构
    ])
  }
})
```

### 4. 错误处理

```typescript
const SafePage = defineComponent({
  setup() {
    const error = ref<string | null>(null)
    
    const handleError = (err: Error) => {
      error.value = err.message
      console.error('[Plugin Page Error]', err)
    }
    
    return () => {
      if (error.value) {
        return h('v-alert', {
          type: 'error',
          title: '页面错误',
          text: error.value
        })
      }
      
      return h('div', [
        // 正常页面内容
      ])
    }
  }
})
```

## 🔧 调试技巧

### 1. 查看已注册页面

```javascript
// 在浏览器控制台中
const pageManager = __pluginLoader.getPageManager()
console.log('已注册页面:', pageManager.getPluginPages())
console.log('导航项:', pageManager.getNavigationItems())
```

### 2. 页面路由调试

```javascript
// 检查当前路由
console.log('当前路由:', this.$route)

// 检查路由元数据
console.log('页面元数据:', this.$route.meta)
```

### 3. 插件状态检查

```javascript
// 检查插件加载状态
console.log('已加载插件:', __pluginLoader.getLoadedPlugins())
```

## 📚 完整示例

查看 `pluginLoader/plugins/page-demo/` 目录中的完整示例，包含：

- 主页面展示
- 设置页面
- 隐藏页面
- 导航管理
- 组件交互

## 🚀 下一步

1. 创建你的第一个插件页面
2. 实验不同的页面配置
3. 添加页面间的导航
4. 集成插件的业务逻辑
5. 优化用户体验

插件页面系统为你的插件提供了无限的可能性，开始创建属于你的独特页面吧！