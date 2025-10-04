# Hook测试插件

## 功能

这是一个简单的测试插件，用于验证插件系统的Hook功能。

插件会在Live2D模型上方显示一个带有渐变背景的文本："hook组件成功 ✨"

## 特性

- ✅ 使用 `injectComponent` API 在Live2DAvatar组件前注入自定义组件
- ✅ 使用 `hookComponent` API 监听组件生命周期
- ✅ 动态注入CSS样式和动画
- ✅ 完全不修改主项目代码
- ✅ 支持热重载

## 使用方法

### 1. 编译插件

```bash
npm run plugin:compile pluginLoader/plugins/hook-test
```

### 2. 启动应用

```bash
npm run dev
```

### 3. 查看效果

启动后，你应该能在Live2D模型上方看到一个紫色渐变的文本框，显示"hook组件成功 ✨"

## 技术实现

### 组件注入

```typescript
context.injectComponent('Live2DAvatar', HookSuccessComponent, {
  position: 'before',  // 在目标组件前面注入
  order: 1             // 注入顺序
})
```

### 生命周期Hook

```typescript
context.hookComponent('Live2DAvatar', {
  mounted(instance) {
    context.debug('Live2DAvatar组件已挂载')
  }
})
```

### 样式注入

插件动态创建 `<style>` 标签并注入到 `<head>` 中，包含CSS动画。

## 清理

插件卸载时会自动：
- 移除注入的组件
- 移除注入的样式
- 清理所有Hook

## 设计原则

遵循插件系统的核心原则：
- ✅ 不修改主项目源码
- ✅ 使用通用API实现功能
- ✅ 完全独立和可热重载
- ✅ 正确的资源清理

## 调试

在浏览器控制台中可以看到插件的调试信息：
- `Hook测试插件加载中...`
- `Hook测试样式已注入`
- `Hook组件已注入到Live2DAvatar`
- `Live2DAvatar组件已挂载，Hook测试组件应该已显示`
