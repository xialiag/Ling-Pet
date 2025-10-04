# 插件系统故障排除

## 🔍 常见问题

### 插件加载问题

#### 插件无法加载
**症状**: 插件在插件管理中显示但无法启用

**解决方案**:
1. 检查插件package.json格式
2. 确认入口文件存在
3. 查看浏览器控制台错误

```javascript
// 调试命令
__pluginLoader.getLoadedPlugins()
__pluginLoader.getAllPlugins()
```

#### 插件加载后无效果
**症状**: 插件显示已启用但功能不工作

**解决方案**:
1. 检查插件代码中的错误
2. 确认目标组件存在
3. 验证选择器正确性

```javascript
// 检查组件发现
__vueInstanceInterceptor.getStats()

// 检查DOM注入
__domInjectionManager.getStats()

// 手动触发检查
forceCheckInjections()
```

### Vue组件注入问题

#### 组件注入不显示
**症状**: `context.injectComponent()` 调用成功但看不到效果

**解决方案**:
1. 确认目标组件名称正确
2. 检查组件是否已挂载
3. 验证注入位置

```typescript
// 调试代码
export default definePlugin({
    async onLoad(context) {
        context.debug('开始注入组件')
        
        // 等待组件挂载
        setTimeout(() => {
            const cleanup = context.injectComponent('Live2DAvatar', MyComponent, {
                position: 'before'
            })
            context.debug('组件注入完成')
        }, 2000)
    }
})
```

#### 局部导入组件无法Hook
**症状**: 全局组件可以Hook，局部导入的不行

**解决方案**: 系统已自动支持，如果仍有问题：
1. 检查组件名称是否正确
2. 确认组件已渲染到DOM
3. 使用DOM注入作为备选方案

```typescript
// 备选方案：使用DOM注入
const cleanup = await context.injectVueComponent(
    '.live2d-wrapper',  // 使用CSS选择器
    MyComponent
)
```

### DOM注入问题

#### CSS选择器无效
**症状**: `injectHTML` 或 `injectVueComponent` 无法找到目标元素

**解决方案**:
1. 验证选择器语法
2. 确认元素已存在
3. 使用 `waitForElement` 等待元素

```typescript
// 等待元素出现
try {
    await context.waitForElement('.target-element', 5000)
    const cleanup = context.injectHTML('.target-element', '<div>内容</div>')
} catch (error) {
    context.debug('元素未找到，使用备选方案')
    // 备选方案
}
```

#### 样式冲突
**症状**: 注入的样式被覆盖或影响其他元素

**解决方案**:
1. 使用特定的类名前缀
2. 提高CSS优先级
3. 使用CSS模块化

```typescript
const cleanup = context.injectCSS(`
    .my-plugin-container {
        /* 使用插件特定前缀 */
    }
    
    .my-plugin-container .button {
        /* 避免全局样式冲突 */
        background: #4CAF50 !important;
    }
`)
```

### 工具注册问题

#### LLM工具无法调用
**症状**: 工具注册成功但LLM无法使用

**解决方案**:
1. 检查工具名称和参数定义
2. 确认handler函数正确
3. 验证返回值格式

```typescript
const cleanup = context.registerTool({
    name: 'my_tool',  // 使用下划线，不要用连字符
    description: '详细的工具描述',
    parameters: [
        {
            name: 'input',
            type: 'string',
            description: '输入参数的详细说明',
            required: true
        }
    ],
    handler: async (args) => {
        try {
            // 确保返回有意义的结果
            return { result: 'success', data: args.input }
        } catch (error) {
            context.debug('工具执行错误:', error)
            throw error
        }
    }
})
```

### 插件通信问题

#### 事件监听无效
**症状**: `context.on()` 设置但收不到事件

**解决方案**:
1. 确认事件名称一致
2. 检查事件发送时机
3. 验证插件加载顺序

```typescript
// 发送方
context.emit('my-event', { data: 'test' })

// 接收方
const cleanup = context.on('my-event', (data) => {
    context.debug('收到事件:', data)
})
```

#### RPC调用失败
**症状**: `callRPC` 调用返回错误

**解决方案**:
1. 确认目标插件已加载
2. 检查方法名称正确
3. 验证参数格式

```typescript
// 注册RPC方法
const cleanup = context.registerRPC('getData', async (params) => {
    context.debug('RPC调用参数:', params)
    return { success: true, data: 'result' }
})

// 调用RPC方法
try {
    const result = await context.callRPC('target-plugin', 'getData', { id: 123 })
    context.debug('RPC结果:', result)
} catch (error) {
    context.debug('RPC调用失败:', error)
}
```

## 🛠️ 调试工具

### 浏览器控制台命令

```javascript
// 插件系统状态
__pluginLoader.getLoadedPlugins()
__pluginLoader.getAllPlugins()

// Vue组件发现状态
__vueInstanceInterceptor.getStats()
__vueInstanceInterceptor.forceCheckAllInjections()

// DOM注入状态
__domInjectionManager.getStats()

// 手动触发注入检查
forceCheckInjections()

// 调试控制台
debug.help()
debug.plugins()
debug.tools()
```

### 插件调试代码

```typescript
export default definePlugin({
    name: 'debug-plugin',
    async onLoad(context) {
        // 1. 基础信息调试
        context.debug('插件开始加载')
        context.debug('应用实例:', context.app)
        context.debug('路由实例:', context.router)
        
        // 2. 配置调试
        const config = context.getConfig('debug', true)
        context.debug('调试配置:', config)
        
        // 3. DOM状态调试
        const bodyElement = context.querySelector('body')
        context.debug('Body元素:', bodyElement)
        
        const allDivs = context.querySelectorAll('div')
        context.debug('Div元素数量:', allDivs.length)
        
        // 4. 组件状态调试
        setTimeout(() => {
            context.debug('延迟检查组件状态')
            // 检查特定组件
        }, 1000)
        
        // 5. 错误处理调试
        try {
            // 可能出错的操作
        } catch (error) {
            context.debug('捕获错误:', error)
        }
    }
})
```

## 📋 检查清单

### 插件开发检查
- [ ] package.json 格式正确
- [ ] 入口文件存在且可执行
- [ ] 插件名称唯一
- [ ] 版本号符合语义化版本
- [ ] 必要的权限已声明

### 功能测试检查
- [ ] 插件可以正常加载
- [ ] 插件可以正常卸载
- [ ] 注入功能工作正常
- [ ] 工具注册成功
- [ ] 事件通信正常

### 性能检查
- [ ] 没有内存泄漏
- [ ] DOM操作频率合理
- [ ] 事件监听器正确清理
- [ ] 异步操作有超时处理

### 兼容性检查
- [ ] 不同屏幕尺寸下正常工作
- [ ] 与其他插件无冲突
- [ ] 样式不影响主应用
- [ ] 错误不影响系统稳定性

## 🚨 紧急修复

### 插件导致系统崩溃
1. 打开开发者工具
2. 在控制台执行：
```javascript
// 禁用所有插件
__pluginLoader.getAllPlugins().forEach(plugin => {
    __pluginLoader.disablePlugin(plugin.name)
})
```

### 插件无法卸载
1. 强制清理插件：
```javascript
// 强制清理特定插件
__pluginLoader.unloadPlugin('problem-plugin')
```

### DOM注入导致页面异常
1. 清理所有DOM注入：
```javascript
// 清理所有注入
document.querySelectorAll('[data-plugin-id]').forEach(el => el.remove())
```

## 📞 获取帮助

### 日志收集
1. 打开开发者工具
2. 复制控制台错误信息
3. 记录复现步骤
4. 收集插件配置信息

### 常用调试信息
```javascript
// 收集系统信息
const debugInfo = {
    loadedPlugins: __pluginLoader.getLoadedPlugins(),
    componentStats: __vueInstanceInterceptor.getStats(),
    domStats: __domInjectionManager.getStats(),
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
}
console.log('调试信息:', JSON.stringify(debugInfo, null, 2))
```

记住：大多数问题都可以通过仔细检查代码和使用调试工具来解决。如果问题持续存在，请收集详细的错误信息和复现步骤。