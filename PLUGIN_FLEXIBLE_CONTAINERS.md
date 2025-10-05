# 插件页面容器灵活配置指南

## 🎯 设计理念

插件页面系统提供了完全的灵活性，插件开发者可以选择：

1. **使用标准容器** - 获得一致的用户体验
2. **自定义容器配置** - 部分定制外观和行为
3. **完全自定义** - 拥有完全的设计自由度

## 🛠️ 配置选项

### 1. 标准容器（默认）

```typescript
// 不设置 container 配置，使用默认标准容器
context.registerPage({
  path: '/my-page',
  component: MyPageComponent,
  title: '我的页面'
  // container 配置省略，使用默认值
})
```

**特性**:
- ✅ 统一的页面头部
- ✅ 返回按钮和菜单
- ✅ 页面标题和图标显示
- ✅ 一致的用户体验

### 2. 简化容器

```typescript
context.registerPage({
  path: '/minimal-page',
  component: MyPageComponent,
  title: '简化页面',
  container: {
    useDefault: true,
    showHeader: false,    // 隐藏头部
    showMenu: false,      // 隐藏菜单
    showBackButton: false // 隐藏返回按钮
  }
})
```

**特性**:
- ✅ 保留基本布局结构
- ❌ 移除不需要的UI元素
- ✅ 更简洁的外观

### 3. 完全自定义（无容器）

```typescript
context.registerPage({
  path: '/custom-page',
  component: FullyCustomComponent,
  title: '自定义页面',
  container: {
    useDefault: false  // 完全不使用系统容器
  }
})
```

**特性**:
- ✅ 完全的设计自由度
- ✅ 自定义布局和样式
- ✅ 独特的用户体验
- ❌ 需要自己处理导航等功能

### 4. 自定义容器组件

```typescript
// 创建自定义容器
const MyCustomContainer = defineComponent({
  setup(_, { slots }) {
    return () => h('div', {
      class: 'my-custom-container'
    }, [
      h('header', '自定义头部'),
      h('main', slots.default?.()),
      h('footer', '自定义底部')
    ])
  }
})

// 使用自定义容器
context.registerPage({
  path: '/custom-container-page',
  component: MyPageComponent,
  title: '自定义容器页面',
  container: {
    customContainer: MyCustomContainer
  }
})
```

**特性**:
- ✅ 自定义容器布局
- ✅ 保持页面内容的复用性
- ✅ 平衡自由度和一致性

### 5. 容器样式定制

```typescript
context.registerPage({
  path: '/styled-page',
  component: MyPageComponent,
  title: '样式定制页面',
  container: {
    useDefault: true,
    containerClass: 'my-custom-page-class',
    containerStyle: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }
  }
})
```

## 📋 完整配置接口

```typescript
interface PluginPageContainerConfig {
  /** 是否使用默认容器 */
  useDefault?: boolean
  
  /** 是否显示头部 */
  showHeader?: boolean
  
  /** 是否显示菜单 */
  showMenu?: boolean
  
  /** 是否显示返回按钮 */
  showBackButton?: boolean
  
  /** 自定义容器组件 */
  customContainer?: Component
  
  /** 容器样式类 */
  containerClass?: string
  
  /** 容器样式 */
  containerStyle?: Record<string, any>
}
```

## 🎨 使用场景

### 1. 工具类插件 - 使用标准容器

```typescript
// 适合设置页面、配置页面等
context.registerPage({
  path: '/settings',
  component: SettingsPage,
  title: '插件设置',
  // 使用默认容器，保持一致性
})
```

### 2. 展示类插件 - 使用简化容器

```typescript
// 适合图片展示、数据可视化等
context.registerPage({
  path: '/gallery',
  component: GalleryPage,
  title: '图片画廊',
  container: {
    useDefault: true,
    showHeader: false,  // 隐藏头部，更多展示空间
    showMenu: false
  }
})
```

### 3. 游戏类插件 - 完全自定义

```typescript
// 适合游戏、创意应用等
context.registerPage({
  path: '/game',
  component: GamePage,
  title: '小游戏',
  container: {
    useDefault: false  // 完全自定义，沉浸式体验
  }
})
```

### 4. 品牌类插件 - 自定义容器

```typescript
// 适合有品牌要求的企业插件
context.registerPage({
  path: '/brand-page',
  component: BrandPage,
  title: '品牌页面',
  container: {
    customContainer: BrandContainer  // 符合品牌设计的容器
  }
})
```

## 🔧 开发技巧

### 1. 响应式设计

```typescript
// 在自定义页面中处理响应式
const ResponsiveCustomPage = defineComponent({
  setup() {
    const isMobile = ref(window.innerWidth < 768)
    
    onMounted(() => {
      const handleResize = () => {
        isMobile.value = window.innerWidth < 768
      }
      window.addEventListener('resize', handleResize)
      onUnmounted(() => window.removeEventListener('resize', handleResize))
    })
    
    return () => h('div', {
      class: isMobile.value ? 'mobile-layout' : 'desktop-layout'
    }, [
      // 页面内容
    ])
  }
})
```

### 2. 主题适配

```typescript
// 在自定义容器中适配主题
const ThemeAwareContainer = defineComponent({
  setup(_, { slots }) {
    const isDark = ref(false) // 从主题系统获取
    
    return () => h('div', {
      class: ['custom-container', isDark.value ? 'dark' : 'light']
    }, slots.default?.())
  }
})
```

### 3. 导航处理

```typescript
// 在完全自定义页面中处理导航
const CustomPageWithNavigation = defineComponent({
  setup() {
    const router = useRouter()
    
    const goBack = () => {
      if (window.history.length > 1) {
        router.go(-1)
      } else {
        router.push('/')
      }
    }
    
    return () => h('div', [
      h('button', { onClick: goBack }, '返回'),
      // 页面内容
    ])
  }
})
```

## 🎯 最佳实践

### 1. 选择合适的容器类型

- **标准容器**: 适合大多数常规页面
- **简化容器**: 适合需要更多展示空间的页面
- **完全自定义**: 适合有特殊设计需求的页面
- **自定义容器**: 适合需要品牌一致性的页面

### 2. 保持用户体验一致性

```typescript
// 即使使用自定义容器，也要保持基本的用户体验
const ConsistentCustomContainer = defineComponent({
  setup(_, { slots }) {
    return () => h('div', { class: 'custom-container' }, [
      // 保持基本的导航功能
      h('nav', { class: 'custom-nav' }, [
        h('button', { onClick: () => history.back() }, '返回')
      ]),
      
      // 页面内容
      h('main', { class: 'custom-main' }, slots.default?.()),
      
      // 可选的底部信息
      h('footer', { class: 'custom-footer' }, '插件信息')
    ])
  }
})
```

### 3. 性能考虑

```typescript
// 对于复杂的自定义容器，使用异步组件
const HeavyCustomContainer = defineAsyncComponent({
  loader: () => import('./HeavyCustomContainer.vue'),
  loadingComponent: SimpleLoadingComponent,
  delay: 200
})
```

## 📚 示例插件

查看 `pluginLoader/plugins/flexible-page-demo/` 目录中的完整示例，包含：

- 完全自定义页面
- 简化容器页面  
- 自定义容器页面
- 标准容器页面

## 🚀 总结

插件页面容器系统提供了从完全标准化到完全自定义的全谱系选择：

- **标准容器** → 快速开发，一致体验
- **简化容器** → 减少干扰，突出内容
- **自定义容器** → 品牌一致，灵活布局
- **完全自定义** → 无限创意，独特体验

选择合适的容器类型，可以在开发效率、用户体验和设计自由度之间找到最佳平衡点。