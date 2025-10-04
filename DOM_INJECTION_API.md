# DOM注入API文档

## 概述

DOM注入API为插件提供了强大的DOM操作能力，允许插件直接向页面注入HTML、CSS、Vue组件等内容，而无需修改源码。

## 🎯 核心特性

- **多种注入类型**: HTML、文本、Vue组件、CSS样式
- **灵活的位置控制**: before、after、prepend、append、replace
- **智能元素查找**: 支持CSS选择器和元素等待
- **自动清理**: 插件卸载时自动清理所有注入内容
- **条件注入**: 支持条件判断的动态注入

## 📚 API参考

### HTML注入

```typescript
// 注入HTML内容
const cleanup = context.injectHTML(
  '.target-selector',           // 目标选择器
  '<div>Hello World</div>',     // HTML内容
  {
    position: 'after',          // 注入位置
    className: 'my-injection',  // CSS类名
    style: { color: 'red' },    // 内联样式
    attributes: { id: 'test' }  // HTML属性
  }
)

// 清理注入
cleanup()
```

### 文本注入

```typescript
// 注入纯文本
const cleanup = context.injectText(
  'title',                      // 目标选择器
  ' - 插件标题',                // 文本内容
  {
    position: 'append',         // 追加到末尾
    style: 'color: blue;'       // CSS样式字符串
  }
)
```

### Vue组件注入

```typescript
// 注入Vue组件
const MyComponent = defineComponent({
  props: ['message'],
  setup(props) {
    return () => h('div', props.message)
  }
})

const cleanup = await context.injectVueComponent(
  '.main-container',            // 目标选择器
  MyComponent,                  // Vue组件
  { message: 'Hello!' },        // 组件props
  {
    position: 'prepend',        // 插入到开头
    className: 'vue-injection'  // 容器类名
  }
)
```

### CSS样式注入

```typescript
// 注入CSS样式
const cleanup = context.injectCSS(`
  .my-style {
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    padding: 10px;
    border-radius: 8px;
  }
`, {
  id: 'my-plugin-styles'        // 样式表ID
})
```

### DOM查询

```typescript
// 查询单个元素
const element = context.querySelector('.target')

// 查询所有匹配元素
const elements = context.querySelectorAll('div')

// 等待元素出现
try {
  const element = await context.waitForElement('.dynamic-element', 5000)
  console.log('元素已出现:', element)
} catch (error) {
  console.log('元素未在5秒内出现')
}
```

## 🔧 注入选项

### DOMInjectionOptions

```typescript
interface DOMInjectionOptions {
  // 注入位置
  position?: 'before' | 'after' | 'prepend' | 'append' | 'replace'
  
  // CSS类名
  className?: string
  
  // 内联样式（对象或字符串）
  style?: Record<string, string> | string
  
  // HTML属性
  attributes?: Record<string, string>
  
  // 注入条件函数
  condition?: () => boolean
  
  // 注入顺序（数字越小越靠前）
  order?: number
  
  // 是否自动清理（默认true）
  autoRemove?: boolean
}
```

### 位置说明

- **before**: 在目标元素之前插入
- **after**: 在目标元素之后插入  
- **prepend**: 插入到目标元素内部的开头
- **append**: 插入到目标元素内部的末尾
- **replace**: 替换目标元素

## 🎨 实际应用示例

### 1. 添加页面横幅

```typescript
export default definePlugin({
  name: 'page-banner',
  async onLoad(context) {
    // 注入CSS
    const cleanupCSS = context.injectCSS(`
      .plugin-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #4CAF50;
        color: white;
        text-align: center;
        padding: 10px;
        z-index: 9999;
      }
    `)
    
    // 注入横幅
    const cleanupBanner = context.injectHTML('body', `
      <div class="plugin-banner">
        🎉 欢迎使用插件系统！
      </div>
    `, { position: 'prepend' })
    
    // 保存清理函数
    return () => {
      cleanupCSS()
      cleanupBanner()
    }
  }
})
```

### 2. 增强现有组件

```typescript
export default definePlugin({
  name: 'component-enhancer',
  async onLoad(context) {
    // 等待目标组件出现
    const targetElement = await context.waitForElement('.live2d-container')
    
    // 添加增强功能
    const cleanup = context.injectHTML('.live2d-container', `
      <div style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
      ">
        增强功能已激活
      </div>
    `, { position: 'append' })
    
    return cleanup
  }
})
```

### 3. 动态Vue组件

```typescript
const StatusComponent = defineComponent({
  name: 'PluginStatus',
  setup() {
    const status = ref('运行中')
    const color = ref('#4CAF50')
    
    onMounted(() => {
      setInterval(() => {
        status.value = status.value === '运行中' ? '待机中' : '运行中'
        color.value = status.value === '运行中' ? '#4CAF50' : '#FF9800'
      }, 3000)
    })
    
    return () => h('div', {
      style: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: color.value,
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold'
      }
    }, `插件状态: ${status.value}`)
  }
})

export default definePlugin({
  name: 'status-display',
  async onLoad(context) {
    const cleanup = await context.injectVueComponent(
      'body',
      StatusComponent,
      {},
      { position: 'append' }
    )
    
    return cleanup
  }
})
```

## 🛡️ 最佳实践

### 1. 样式隔离

```typescript
// 使用插件特定的类名前缀
const cleanup = context.injectCSS(`
  .my-plugin-container {
    /* 插件样式 */
  }
  
  .my-plugin-button {
    /* 按钮样式 */
  }
`)
```

### 2. 响应式设计

```typescript
const cleanup = context.injectCSS(`
  .responsive-injection {
    position: fixed;
    top: 10px;
    right: 10px;
  }
  
  @media (max-width: 768px) {
    .responsive-injection {
      position: relative;
      top: auto;
      right: auto;
      margin: 10px;
    }
  }
`)
```

### 3. 条件注入

```typescript
const cleanup = context.injectHTML('.target', '<div>内容</div>', {
  condition: () => {
    // 只在特定条件下注入
    return window.innerWidth > 1024
  }
})
```

### 4. 错误处理

```typescript
export default definePlugin({
  name: 'safe-injection',
  async onLoad(context) {
    try {
      // 等待元素，设置合理的超时时间
      const element = await context.waitForElement('.target', 3000)
      
      const cleanup = context.injectHTML('.target', '<div>内容</div>')
      return cleanup
      
    } catch (error) {
      context.debug('目标元素未找到，使用备用方案')
      
      // 备用注入方案
      const cleanup = context.injectHTML('body', `
        <div style="position: fixed; top: 10px; left: 10px;">
          备用内容
        </div>
      `, { position: 'append' })
      
      return cleanup
    }
  }
})
```

## 🔍 调试技巧

### 1. 检查注入状态

```javascript
// 在浏览器控制台中
console.log('DOM注入统计:', __domInjectionManager.getStats())
```

### 2. 查找注入元素

```javascript
// 查找所有插件注入的元素
document.querySelectorAll('[data-plugin-id]')

// 查找特定插件的注入
document.querySelectorAll('[data-plugin-id="my-plugin"]')
```

### 3. 测试选择器

```javascript
// 测试选择器是否有效
__domInjectionManager.querySelector('.my-selector')
__domInjectionManager.querySelectorAll('.my-selector')
```

## ⚠️ 注意事项

1. **性能考虑**: 避免频繁的DOM操作，合理使用条件注入
2. **样式冲突**: 使用特定的类名前缀避免样式冲突
3. **清理责任**: 插件卸载时会自动清理，但复杂的Vue组件可能需要手动清理
4. **选择器准确性**: 确保CSS选择器的准确性，避免意外注入
5. **兼容性**: 考虑不同屏幕尺寸和设备的兼容性

## 🎉 总结

DOM注入API为插件开发提供了强大而灵活的DOM操作能力，让插件可以：

- **无侵入地增强现有功能**
- **添加全新的UI元素**
- **动态响应页面变化**
- **提供丰富的用户体验**

通过合理使用这些API，插件可以在不修改源码的前提下，为应用带来无限的扩展可能性。