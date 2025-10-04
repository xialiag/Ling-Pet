# Hook测试插件 - 快速开始

## 🎯 目标

在Live2D模型上方显示一个文本："hook组件成功 ✨"

## ✅ 已完成

插件已经创建并编译完成！

## 🚀 使用步骤

### 1. 启动应用

```bash
npm run dev
```

### 2. 查看效果

启动后，你应该能在Live2D模型上方看到：
- 一个紫色渐变背景的文本框
- 显示"hook组件成功 ✨"
- 带有淡入动画效果
- 位于模型顶部5%的位置

### 3. 查看调试信息

打开浏览器控制台（F12），你会看到：
```
[Plugin:hook-test] Hook测试插件加载中...
[Plugin:hook-test] Hook测试样式已注入
[Plugin:hook-test] Hook组件已注入到Live2DAvatar
[Plugin:hook-test] Live2DAvatar组件已挂载，Hook测试组件应该已显示
```

## 📁 文件结构

```
pluginLoader/plugins/hook-test/
├── index.ts           # 插件主文件
├── manifest.json      # 插件清单
├── package.json       # 包信息
├── README.md          # 详细文档
└── QUICKSTART.md      # 本文件

dist/plugins/hook-test/
├── index.js           # 编译后的代码
├── index.js.map       # Source map
├── package.json       # 包信息
└── README.md          # 文档
```

## 🔧 技术实现

### 核心代码

```typescript
// 1. 创建Vue组件
const HookSuccessComponent = defineComponent({
  name: 'HookSuccessComponent',
  setup() {
    return () => h('div', { style: {...} }, 'hook组件成功 ✨')
  }
})

// 2. 注入到Live2DAvatar前面
context.injectComponent('Live2DAvatar', HookSuccessComponent, {
  position: 'before',  // 在目标组件前面
  order: 1             // 注入顺序
})

// 3. Hook生命周期
context.hookComponent('Live2DAvatar', {
  mounted(instance) {
    context.debug('Live2DAvatar组件已挂载')
  }
})
```

## 🎨 样式说明

- **位置**: 绝对定位，top: 5%, 水平居中
- **背景**: 紫色渐变 (#667eea → #764ba2)
- **动画**: 淡入效果，从上方20px滑入
- **层级**: z-index: 100，确保在模型上方
- **交互**: pointer-events: none，不阻挡鼠标事件

## 🔄 热重载

如果修改了插件代码：

```bash
# 重新编译
npm run plugin:compile pluginLoader/plugins/hook-test

# 刷新浏览器即可看到更新
```

## 🧹 卸载

插件会自动清理：
- 移除注入的组件
- 移除注入的样式
- 清理所有Hook

## 💡 扩展建议

基于这个插件，你可以：

1. **修改位置**: 改变 `top` 和 `left` 值
2. **修改样式**: 改变颜色、大小、字体等
3. **添加交互**: 移除 `pointer-events: none`，添加点击事件
4. **动态内容**: 使用 `ref` 和 `computed` 显示动态数据
5. **多个组件**: 注入多个组件到不同位置

## 📚 相关文档

- [插件系统README](../../README.md)
- [插件开发指南](../../../docs/plugin-development-guide.md)
- [组件注入文档](../../docs/COMPONENT_INJECTION.md)
- [Hook引擎文档](../../core/hookEngine.ts)

## ❓ 常见问题

### Q: 看不到Hook组件？
A: 检查：
1. 插件是否已编译（查看 dist/plugins/hook-test/）
2. 浏览器控制台是否有错误
3. Live2DAvatar组件是否已加载

### Q: 如何修改显示内容？
A: 编辑 `index.ts` 中的文本，重新编译即可

### Q: 如何改变位置？
A: 修改 `style` 中的 `top` 和 `left` 值

## ✨ 成功标志

如果你看到了紫色渐变的"hook组件成功 ✨"文本，说明：
- ✅ 插件系统工作正常
- ✅ Hook机制工作正常
- ✅ 组件注入功能正常
- ✅ 样式注入功能正常

恭喜！你已经成功创建并运行了一个Hook测试插件！🎉
