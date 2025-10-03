# 插件设置页面 API

## 概述

插件加载器提供了统一的设置页面 API，允许插件在设置页面注册自定义操作按钮，而无需直接操作 DOM。

## 设计原则

1. **解耦**：主项目不需要为任何插件编写专门代码
2. **标准化**：所有插件使用相同的 API 注册设置操作
3. **可维护**：插件加载器统一管理和渲染按钮
4. **热加载友好**：插件加载/卸载时自动管理 UI 元素

## API 使用

### 注册设置操作按钮

```typescript
context.registerSettingsAction({
  label: '下载表情包',           // 按钮文本
  icon: 'mdi-download',          // Material Design Icons 图标
  color: 'primary',              // 按钮颜色：primary | secondary | success | warning | error | info
  variant: 'outlined',           // 按钮样式：elevated | flat | tonal | outlined | text | plain
  loading: () => isDownloading,  // 加载状态（可以是布尔值或函数）
  disabled: false,               // 禁用状态（可以是布尔值或函数）
  handler: async () => {         // 点击处理函数
    // 执行操作...
  }
})
```

### 完整示例

```typescript
export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  async onLoad(context: PluginContext) {
    let isProcessing = false
    
    // 注册设置操作
    context.registerSettingsAction({
      label: '执行操作',
      icon: 'mdi-play',
      color: 'primary',
      variant: 'outlined',
      loading: () => isProcessing,
      handler: async () => {
        try {
          isProcessing = true
          // 执行操作...
          await doSomething()
          alert('操作成功！')
        } catch (error) {
          alert(`操作失败：${error.message}`)
        } finally {
          isProcessing = false
        }
      }
    })
    
    // 可以注册多个操作
    context.registerSettingsAction({
      label: '查看统计',
      icon: 'mdi-chart-bar',
      color: 'info',
      variant: 'text',
      handler: () => {
        // 显示统计信息...
      }
    })
  }
})
```

## 类型定义

```typescript
interface PluginSettingsAction {
  /** 按钮文本 */
  label: string
  
  /** 按钮图标（Material Design Icons） */
  icon?: string
  
  /** 按钮颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  
  /** 按钮样式 */
  variant?: 'elevated' | 'flat' | 'tonal' | 'outlined' | 'text' | 'plain'
  
  /** 点击处理函数 */
  handler: () => Promise<void> | void
  
  /** 是否禁用 */
  disabled?: boolean | (() => boolean)
  
  /** 是否加载中 */
  loading?: boolean | (() => boolean)
}
```

## 实际案例：bilibili-emoji 插件

```typescript
// 在插件中注册下载表情包按钮
let isDownloading = false

context.registerSettingsAction({
  label: '下载表情包',
  icon: 'mdi-download',
  color: 'primary',
  variant: 'outlined',
  loading: () => isDownloading,
  handler: async () => {
    try {
      const keyword = prompt('请输入要搜索的表情包关键词：')
      if (!keyword) return

      isDownloading = true
      
      const result = await searchBilibiliSuits(keyword)
      // 处理搜索结果...
      
      alert('下载成功！')
    } catch (error) {
      alert(`下载失败：${error.message}`)
    } finally {
      isDownloading = false
    }
  }
})
```

## 优势

### 对比旧方案（直接操作 DOM）

**旧方案的问题：**
```typescript
// ❌ 需要手动操作 DOM
const container = document.getElementById('plugin-actions-bilibili-emoji')
const button = document.createElement('button')
button.className = 'v-btn ...' // 需要知道具体的 CSS 类
button.innerHTML = '...'        // 需要手动构建 HTML
container.appendChild(button)

// ❌ 需要手动管理状态
button.disabled = true
button.innerHTML = '加载中...'

// ❌ 卸载时需要手动清理
button.remove()
```

**新方案的优势：**
```typescript
// ✅ 声明式 API，简洁清晰
context.registerSettingsAction({
  label: '下载表情包',
  icon: 'mdi-download',
  loading: () => isDownloading,
  handler: async () => { /* ... */ }
})

// ✅ 状态自动响应
// ✅ 自动清理，无需手动管理
```

### 主要优势

1. **声明式 API**：插件只需声明按钮的属性和行为
2. **自动管理**：加载器负责渲染、状态更新、清理
3. **类型安全**：完整的 TypeScript 类型定义
4. **响应式状态**：支持函数形式的 `loading` 和 `disabled`
5. **统一样式**：所有按钮使用 Vuetify 组件，样式一致
6. **易于维护**：主项目代码完全不知道具体插件

## 扩展性

任何插件都可以使用相同的 API 注册自己的设置操作：

```typescript
// 插件 A
context.registerSettingsAction({
  label: '导出数据',
  icon: 'mdi-export',
  handler: () => { /* ... */ }
})

// 插件 B
context.registerSettingsAction({
  label: '同步设置',
  icon: 'mdi-sync',
  handler: () => { /* ... */ }
})

// 插件 C
context.registerSettingsAction({
  label: '清理缓存',
  icon: 'mdi-delete-sweep',
  color: 'warning',
  handler: () => { /* ... */ }
})
```

每个插件的按钮会自动显示在对应插件的设置面板中，互不干扰。

## 总结

通过提供统一的设置页面 API，插件系统实现了：

- ✅ 主项目与插件完全解耦
- ✅ 插件开发更简单、更标准化
- ✅ 更好的可维护性和扩展性
- ✅ 符合"不修改主项目源码"的设计初衷
