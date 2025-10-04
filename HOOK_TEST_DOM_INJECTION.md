# Hook测试插件 - DOM直接注入方案

## 🎯 问题分析

原始方案使用 Vue 组件注入，但存在问题：
- 插件在设置页面加载
- Live2DAvatar 组件可能在不同的路由或窗口
- 组件注入无法跨窗口工作

## ✅ 解决方案

使用直接 DOM 操作 + MutationObserver 监听：

### 1. 直接 DOM 注入

```typescript
const injectHookElement = () => {
  // 查找目标元素
  const canvas = document.querySelector('.live2d-canvas')
  const wrapper = document.querySelector('.live2d-wrapper')
  const container = document.querySelector('.live2d-container')
  
  const targetElement = wrapper || container || canvas?.parentElement

  if (targetElement) {
    // 创建并注入元素
    const hookElement = document.createElement('div')
    hookElement.id = 'hook-test-element'
    hookElement.className = 'hook-test-overlay'
    hookElement.textContent = 'hook组件成功 ✨'
    targetElement.appendChild(hookElement)
    return true
  }
  return false
}
```

### 2. MutationObserver 监听

如果元素还没加载，使用 MutationObserver 监听 DOM 变化：

```typescript
const observer = new MutationObserver(() => {
  if (injectHookElement()) {
    observer.disconnect()  // 注入成功后停止监听
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})
```

### 3. 样式注入

使用 `position: fixed` 确保在整个窗口中显示：

```css
.hook-test-overlay {
  position: fixed;  /* 固定定位，相对于窗口 */
  top: 5%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;  /* 高层级确保在最上方 */
  /* ... 其他样式 */
}
```

## 📊 工作流程

```
插件加载
  ↓
注入样式到 <head>
  ↓
查找目标元素 (.live2d-canvas 等)
  ↓
找到了？
  ├─ 是 → 直接注入元素 → 完成
  └─ 否 → 启动 MutationObserver
           ↓
         监听 DOM 变化
           ↓
         找到目标元素
           ↓
         注入元素 → 停止监听 → 完成
```

## 🎨 注入位置

插件会按优先级查找以下元素：

1. `.live2d-wrapper` - Live2D 包装容器
2. `.live2d-container` - Live2D 容器
3. `.live2d-canvas` 的父元素

找到后，在该元素内部添加 Hook 元素。

## 🔧 代码结构

### onLoad

```typescript
async onLoad(context) {
  // 1. 注入样式
  const styleElement = document.createElement('style')
  styleElement.id = 'hook-test-styles'
  styleElement.textContent = `/* CSS */`
  document.head.appendChild(styleElement)

  // 2. 定义注入函数
  const injectHookElement = () => { /* ... */ }

  // 3. 尝试立即注入
  if (!injectHookElement()) {
    // 4. 如果失败，使用 MutationObserver
    const observer = new MutationObserver(() => {
      if (injectHookElement()) {
        observer.disconnect()
      }
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    cleanupFunctions.push(() => observer.disconnect())
  }

  // 5. 备用：Vue 组件注入（如果在同一窗口）
  try {
    const unhook = context.injectComponent('Live2DAvatar', Component, {...})
    cleanupFunctions.push(unhook)
  } catch (error) {
    // 跨窗口时会失败，忽略
  }
}
```

### onUnload

```typescript
async onUnload(context) {
  // 1. 执行所有清理函数（包括 MutationObserver）
  cleanupFunctions.forEach(cleanup => cleanup())
  cleanupFunctions = []

  // 2. 移除注入的 DOM 元素
  document.getElementById('hook-test-element')?.remove()

  // 3. 移除样式
  document.getElementById('hook-test-styles')?.remove()
}
```

## 🎯 优势

### 1. 跨路由工作

不依赖 Vue 组件系统，可以在任何页面工作。

### 2. 跨窗口潜力

如果插件系统在多个窗口加载，每个窗口都会尝试注入。

### 3. 自动适应

使用 MutationObserver 自动检测元素出现，无需手动触发。

### 4. 清理完整

卸载时正确清理所有资源：
- DOM 元素
- 样式
- MutationObserver

## 📝 使用方法

### 1. 编译插件

```bash
npm run plugin:compile pluginLoader/plugins/hook-test
```

### 2. 刷新浏览器

```bash
# 如果应用正在运行，刷新浏览器
# 或重新启动
npm run dev
```

### 3. 启用插件

1. 打开设置 → 插件管理
2. 启用 "Hook测试插件"
3. 查看 Live2D 模型区域

### 4. 查看效果

- 如果 Live2D 已加载：立即显示 Hook 元素
- 如果 Live2D 未加载：等待加载后自动显示

## 🐛 调试

### 控制台输出

```
[Plugin:hook-test] Hook测试插件加载中...
[Plugin:hook-test] Hook测试样式已注入
[Plugin:hook-test] Hook元素已注入到 DOM
// 或
[Plugin:hook-test] 未找到目标元素，将使用 MutationObserver 监听
[Plugin:hook-test] Hook元素已注入到 DOM
[Plugin:hook-test] MutationObserver 已停止监听
```

### 检查元素

在浏览器开发者工具中：

1. 打开 Elements 面板
2. 查找 `#hook-test-element`
3. 应该看到：
   ```html
   <div id="hook-test-element" class="hook-test-overlay">
     hook组件成功 ✨
   </div>
   ```

### 检查样式

在 Elements 面板中：

1. 查找 `<head>` 中的 `<style id="hook-test-styles">`
2. 应该包含 `.hook-test-overlay` 样式和 `@keyframes hookFadeIn` 动画

## 🎨 自定义

### 修改位置

编辑 `.hook-test-overlay` 样式：

```css
.hook-test-overlay {
  position: fixed;
  top: 5%;      /* 改为 bottom: 5% 显示在底部 */
  left: 50%;    /* 改为 left: 10% 显示在左侧 */
  /* ... */
}
```

### 修改内容

编辑注入代码：

```typescript
hookElement.textContent = 'hook组件成功 ✨'  // 改为其他文本
```

### 修改样式

编辑 CSS：

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
/* 改为其他颜色 */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

## 🎉 总结

### 技术亮点

- ✅ 直接 DOM 操作，不依赖框架
- ✅ MutationObserver 自动检测
- ✅ 跨路由、跨页面工作
- ✅ 完整的资源清理
- ✅ 备用方案（Vue 组件注入）

### 适用场景

这个方案适用于：
- 需要在特定 DOM 元素附近显示内容
- 跨路由或跨页面的功能
- 不确定目标元素何时加载的情况
- 需要在框架之外工作的场景

---

**现在刷新浏览器，应该能看到 Hook 元素了！** 🎉
