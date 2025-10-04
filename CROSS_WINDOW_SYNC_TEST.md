# 跨窗口插件同步测试指南

## 🎉 已实现

跨窗口插件同步功能已添加到插件加载器！

## 🧪 测试步骤

### 1. 刷新所有窗口

```bash
# 刷新浏览器或重启应用
按 F5 或 Ctrl+R
```

### 2. 打开设置窗口

从系统托盘或主窗口打开设置。

### 3. 启用 hook-test 插件

在设置 → 插件管理中启用 "Hook测试插件"

**预期日志（设置窗口）**:
```
[PluginLoader] Plugin hook-test loaded successfully
[PluginLoader] Emitted plugin:enabled event for hook-test
```

**预期日志（主窗口）**:
```
[PluginLoader] Received plugin:enabled event for hook-test
[PluginLoader] Loading plugin hook-test in this window
[Plugin:hook-test] 🚀 Hook测试插件加载中...
[Plugin:hook-test] ✅ Vue组件注入已设置
```

### 4. 切换到主窗口（Live2D）

**预期效果**:
- ✅ 看到紫色文本框（DOM注入）
- ✅ 看到粉色文本框（Vue组件注入）
- ✅ **无需刷新页面**

### 5. 回到设置窗口，禁用插件

**预期日志（设置窗口）**:
```
[PluginLoader] Plugin hook-test unloaded
[PluginLoader] Emitted plugin:disabled event for hook-test
```

**预期日志（主窗口）**:
```
[PluginLoader] Received plugin:disabled event for hook-test
[PluginLoader] Unloading plugin hook-test in this window
```

### 6. 切换到主窗口

**预期效果**:
- ✅ 两个文本框都消失
- ✅ **无需刷新页面**

## 📊 测试矩阵

| 操作 | 设置窗口 | 主窗口 | 需要刷新 | 状态 |
|------|---------|--------|---------|------|
| 启用插件 | ✅ 加载 | ✅ 自动加载 | ❌ 否 | 待测试 |
| 禁用插件 | ✅ 卸载 | ✅ 自动卸载 | ❌ 否 | 待测试 |
| Vue组件注入 | ⚠️ 无目标 | ✅ 显示 | ❌ 否 | 待测试 |
| 自动清理 | ✅ 工作 | ✅ 工作 | ❌ 否 | 待测试 |

## 🔍 调试

### 检查事件是否发送

在设置窗口控制台：
```javascript
// 查看是否有 emit 调用
// 应该在启用/禁用插件时看到日志
```

### 检查事件是否接收

在主窗口控制台：
```javascript
// 应该看到 "Received plugin:enabled event" 日志
```

### 手动测试事件

在设置窗口控制台：
```javascript
import { emit } from '@tauri-apps/api/event'
await emit('plugin:enabled', { pluginName: 'hook-test' })
```

然后切换到主窗口，应该看到插件加载。

## ✅ 成功标志

当看到以下情况时，说明跨窗口同步工作正常：

1. **启用插件后**
   - ✅ 设置窗口显示 DOM 注入
   - ✅ 主窗口显示 DOM 和 Vue 组件注入
   - ✅ 无需刷新主窗口

2. **禁用插件后**
   - ✅ 两个窗口的元素都消失
   - ✅ 无需刷新任何窗口

3. **控制台日志**
   - ✅ 设置窗口：`Emitted plugin:enabled event`
   - ✅ 主窗口：`Received plugin:enabled event`
   - ✅ 主窗口：`Loading plugin hook-test in this window`

## 🐛 故障排查

### 问题1: 主窗口没有收到事件

**症状**: 主窗口没有日志 "Received plugin:enabled event"

**原因**: 
- Tauri 事件系统未初始化
- 事件监听器未设置

**解决**:
1. 确认主窗口已刷新
2. 检查主窗口控制台是否有 "Cross-window sync setup complete" 日志
3. 检查是否有错误信息

### 问题2: Vue 组件注入不显示

**症状**: 只看到紫色文本框，没有粉色文本框

**原因**:
- `Live2DAvatar` 组件未找到
- 组件注入失败

**解决**:
1. 检查主窗口是否有 Live2D 组件
2. 查看控制台是否有 "Target component Live2DAvatar not found" 警告
3. 确认插件在主窗口加载

### 问题3: 仍需刷新页面

**症状**: 切换到主窗口时看不到效果，需要刷新

**原因**:
- 事件未发送或未接收
- 插件未在主窗口加载

**解决**:
1. 检查两个窗口的控制台日志
2. 确认事件发送和接收都有日志
3. 手动测试事件系统

## 🎊 总结

### 实现的功能

1. **跨窗口事件通信** - 使用 Tauri 事件系统
2. **自动插件同步** - 所有窗口自动同步插件状态
3. **实时生效** - 无需刷新页面

### 技术栈

- **Tauri Events** - `emit` 和 `listen`
- **Plugin Loader** - 跨窗口同步逻辑
- **Vue Component Injection** - 在正确的窗口注入

### 受益对象

- ✅ 所有使用 `injectComponent` 的插件
- ✅ 多窗口应用
- ✅ 用户体验

---

**现在刷新浏览器开始测试吧！** 🚀

应该能看到：
1. 在设置窗口启用插件
2. 主窗口自动加载插件（无需刷新）
3. 看到 Vue 组件注入的粉色文本框
