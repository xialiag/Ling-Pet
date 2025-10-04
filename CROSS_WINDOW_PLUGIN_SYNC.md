# 跨窗口插件同步解决方案

## 🎯 问题

- 设置窗口和主窗口（Live2D）都初始化了插件系统
- 但它们是独立的实例，不共享状态
- 在设置窗口启用插件，主窗口不知道

## ✅ 解决方案

使用 **Tauri 事件系统** 同步插件状态。

## 🔧 实现

### 1. 修改 PluginLoader - 发送事件

在 `pluginLoader/core/pluginLoader.ts` 中：

```typescript
import { emit } from '@tauri-apps/api/event'

async enablePlugin(pluginName: string): Promise<boolean> {
    const success = await this.loadPlugin(pluginName)
    
    if (success) {
        await this.saveEnabledPlugins()
        
        // 🆕 发送跨窗口事件
        try {
            await emit('plugin:enabled', { pluginName })
            console.log(`[PluginLoader] Emitted plugin:enabled event for ${pluginName}`)
        } catch (error) {
            console.warn(`[PluginLoader] Failed to emit event:`, error)
        }
    }
    
    return success
}

async disablePlugin(pluginName: string): Promise<boolean> {
    const success = await this.unloadPlugin(pluginName)
    
    if (success) {
        await this.saveEnabledPlugins()
        
        // 🆕 发送跨窗口事件
        try {
            await emit('plugin:disabled', { pluginName })
            console.log(`[PluginLoader] Emitted plugin:disabled event for ${pluginName}`)
        } catch (error) {
            console.warn(`[PluginLoader] Failed to emit event:`, error)
        }
    }
    
    return success
}
```

### 2. 修改 PluginLoader - 监听事件

在 `initialize` 方法中添加事件监听：

```typescript
import { listen } from '@tauri-apps/api/event'

async initialize(app: App, router: Router): Promise<void> {
    this.app = app
    this.router = router
    
    // ... 其他初始化代码
    
    // 🆕 监听跨窗口插件事件
    await this.setupCrossWindowSync()
    
    console.log('[PluginLoader] Initialized')
}

private async setupCrossWindowSync(): Promise<void> {
    try {
        // 监听插件启用事件
        await listen('plugin:enabled', async (event: any) => {
            const { pluginName } = event.payload
            console.log(`[PluginLoader] Received plugin:enabled event for ${pluginName}`)
            
            // 如果本窗口还没加载这个插件，加载它
            if (!this.loadedPlugins.has(pluginName)) {
                console.log(`[PluginLoader] Loading plugin ${pluginName} in this window`)
                await this.loadPlugin(pluginName)
            }
        })
        
        // 监听插件禁用事件
        await listen('plugin:disabled', async (event: any) => {
            const { pluginName } = event.payload
            console.log(`[PluginLoader] Received plugin:disabled event for ${pluginName}`)
            
            // 如果本窗口加载了这个插件，卸载它
            if (this.loadedPlugins.has(pluginName)) {
                console.log(`[PluginLoader] Unloading plugin ${pluginName} in this window`)
                await this.unloadPlugin(pluginName)
            }
        })
        
        console.log('[PluginLoader] Cross-window sync setup complete')
    } catch (error) {
        console.warn('[PluginLoader] Failed to setup cross-window sync:', error)
    }
}
```

## 🎨 工作流程

```
设置窗口                          主窗口（Live2D）
    │                                  │
    │ 用户启用插件                      │
    ├─> loadPlugin()                   │
    │                                  │
    ├─> emit('plugin:enabled')         │
    │        │                         │
    │        └────────────────────────>│
    │                                  │
    │                          listen('plugin:enabled')
    │                                  │
    │                          loadPlugin() ←─┤
    │                                  │
    │                          ✅ 插件在主窗口加载
    │                                  │
    │                          Vue组件注入生效
    │                                  │
```

## 📊 效果

### 修改前

| 操作 | 设置窗口 | 主窗口 | 问题 |
|------|---------|--------|------|
| 启用插件 | ✅ 加载 | ❌ 不知道 | 需要刷新 |
| 禁用插件 | ✅ 卸载 | ❌ 不知道 | 需要刷新 |

### 修改后

| 操作 | 设置窗口 | 主窗口 | 问题 |
|------|---------|--------|------|
| 启用插件 | ✅ 加载 | ✅ 自动加载 | 无 |
| 禁用插件 | ✅ 卸载 | ✅ 自动卸载 | 无 |

## 🎯 优势

1. **自动同步** - 所有窗口自动同步插件状态
2. **无需刷新** - 实时生效
3. **统一管理** - 在任何窗口启用/禁用都会同步
4. **可扩展** - 支持任意数量的窗口

## 🧪 测试

### 测试步骤

1. **启动应用**
2. **打开设置窗口**
3. **启用 hook-test 插件**
4. **切换到主窗口**
5. **观察**：应该看到 Vue 组件注入的粉色文本框
6. **回到设置窗口**
7. **禁用插件**
8. **切换到主窗口**
9. **观察**：粉色文本框应该消失

### 预期日志

**设置窗口**:
```
[PluginLoader] Plugin hook-test loaded successfully
[PluginLoader] Emitted plugin:enabled event for hook-test
```

**主窗口**:
```
[PluginLoader] Received plugin:enabled event for hook-test
[PluginLoader] Loading plugin hook-test in this window
[Plugin:hook-test] Hook测试插件加载中...
[Plugin:hook-test] Vue组件注入已设置
```

## 🔍 调试

### 检查事件是否发送

在设置窗口控制台：
```javascript
// 手动发送测试事件
import { emit } from '@tauri-apps/api/event'
await emit('plugin:enabled', { pluginName: 'hook-test' })
```

### 检查事件是否接收

在主窗口控制台：
```javascript
// 手动监听事件
import { listen } from '@tauri-apps/api/event'
await listen('plugin:enabled', (event) => {
    console.log('Received event:', event)
})
```

## 📝 注意事项

### 1. 避免循环

事件监听器中加载插件时，不要再次发送事件：

```typescript
// ❌ 错误：会导致循环
await listen('plugin:enabled', async (event) => {
    await this.enablePlugin(pluginName)  // 这会再次发送事件
})

// ✅ 正确：直接加载，不发送事件
await listen('plugin:enabled', async (event) => {
    await this.loadPlugin(pluginName)  // 只加载，不发送事件
})
```

### 2. 防止重复加载

检查插件是否已加载：

```typescript
if (!this.loadedPlugins.has(pluginName)) {
    await this.loadPlugin(pluginName)
}
```

### 3. 错误处理

事件发送失败不应该影响插件加载：

```typescript
try {
    await emit('plugin:enabled', { pluginName })
} catch (error) {
    console.warn('Failed to emit event:', error)
    // 继续执行，不抛出错误
}
```

## 🎊 总结

通过 Tauri 事件系统实现跨窗口插件同步：

- ✅ 自动同步所有窗口
- ✅ 无需手动刷新
- ✅ 实时生效
- ✅ 简单可靠

---

**实现这个方案后，所有窗口的插件都会自动同步！** 🚀
