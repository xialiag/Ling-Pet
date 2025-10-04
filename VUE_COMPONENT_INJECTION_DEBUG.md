# Vue 组件注入调试指南

## 🎯 问题

- ✅ 跨窗口同步工作（禁用后组件消失）
- ✅ DOM 注入显示（紫色文本框）
- ❌ Vue 组件注入不显示（粉色文本框）

## 🔍 诊断步骤

### 1. 检查主窗口控制台

刷新浏览器，启用插件，然后在**主窗口**（Live2D 窗口）打开控制台（F12），查找：

#### 应该看到的日志：
```
[PluginLoader] Received plugin:enabled event for hook-test
[PluginLoader] Loading plugin hook-test in this window
[Plugin:hook-test] 🚀 Hook测试插件加载中...
[Plugin:hook-test] ✅ Vue组件注入已设置
[Plugin:hook-test] 📌 目标组件: Live2DAvatar
```

#### 可能的警告：
```
[Plugin:hook-test] Target component Live2DAvatar not found, injection will be applied when component is registered
```

### 2. 检查 Live2DAvatar 组件是否存在

在主窗口控制台执行：

```javascript
// 检查 Live2DAvatar 组件是否在 DOM 中
document.querySelector('.live2d-wrapper')
document.querySelector('.live2d-container')
document.querySelector('.live2d-canvas')

// 如果都返回 null，说明 Live2D 组件还没加载
```

### 3. 检查组件注入管理器

在主窗口控制台执行：

```javascript
// 查看组件注入统计
// 需要访问内部 API（仅用于调试）
```

## 🐛 可能的原因

### 原因1: Live2DAvatar 组件未注册

**症状**: 控制台显示 "Target component Live2DAvatar not found"

**原因**: 
- `Live2DAvatar` 组件在 Vue 中的注册名称可能不是 "Live2DAvatar"
- 组件可能使用了不同的名称

**解决**: 查找正确的组件名称

在主窗口控制台：
```javascript
// 查看所有已注册的组件
// Vue 3 中组件名称可能不同
```

或者查看 `src/components/main/Live2DAvatar.vue` 文件，检查组件的 `name` 属性。

### 原因2: 组件注册时机问题

**症状**: 插件加载时组件还没注册

**原因**:
- 插件在应用启动时加载
- Live2DAvatar 组件在路由切换时才注册

**解决**: 使用延迟注入或监听组件注册

### 原因3: 组件注入机制未应用

**症状**: 组件注入注册了，但没有实际应用到组件

**原因**:
- `hookEngine.initialize` 可能没有正确拦截组件注册
- 组件已经注册，注入来不及应用

**解决**: 检查 Hook 引擎的实现

## 🔧 临时解决方案

由于 Vue 组件注入比较复杂，我们可以先使用 **DOM 注入** 作为替代方案。

### 修改插件使用 DOM 注入到 Live2D 容器

```typescript
// 查找 Live2D 容器并注入
const findAndInject = () => {
    const wrapper = document.querySelector('.live2d-wrapper')
    const container = document.querySelector('.live2d-container')
    const target = wrapper || container
    
    if (target && !document.getElementById('hook-test-vue-like')) {
        const element = document.createElement('div')
        element.id = 'hook-test-vue-like'
        element.className = 'hook-test-overlay'
        element.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
            z-index: 999999;
            pointer-events: none;
        `
        element.textContent = '✨ hook组件成功 (DOM模拟Vue注入)'
        
        document.body.appendChild(element)
        return true
    }
    return false
}

// 立即尝试
if (!findAndInject()) {
    // 使用 MutationObserver 等待
    const observer = new MutationObserver(() => {
        if (findAndInject()) {
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
}
```

## 📝 建议

### 短期方案

1. **使用 DOM 注入** - 更可靠，易于调试
2. **查找正确的组件名称** - 可能不是 "Live2DAvatar"
3. **添加更多调试日志** - 了解组件注册时机

### 长期方案

1. **改进组件注入机制** - 支持延迟注入
2. **添加组件发现功能** - 自动查找可用组件
3. **提供组件列表 API** - 让插件知道哪些组件可用

## 🎯 下一步

1. **检查主窗口控制台** - 查找警告信息
2. **查找组件名称** - 确认 Live2DAvatar 的实际名称
3. **如果需要，使用 DOM 注入** - 作为临时方案

---

**现在刷新浏览器，查看主窗口控制台的日志！** 🔍
