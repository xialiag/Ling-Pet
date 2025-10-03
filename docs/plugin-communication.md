# 插件间通信

## 四种通信方式

### 1. 事件 - 简单通知
```typescript
// 发送
context.emit('user:login', { userId: '123' })

// 接收
context.on('user:login', (data) => {
  console.log('用户登录:', data)
})
```

### 2. 消息 - 结构化数据
```typescript
// 发送给指定插件
context.sendMessage('plugin-b', 'data:update', { value: 42 })

// 广播给所有插件
context.sendMessage(undefined, 'notification', { text: 'hello' })

// 接收
context.onMessage((msg) => {
  if (msg.type === 'data:update') {
    console.log('数据:', msg.data)
  }
})
```

### 3. RPC - 调用方法
```typescript
// 注册方法
context.registerRPC('getUserInfo', async (userId) => {
  return { id: userId, name: 'Alice' }
})

// 调用方法
const user = await context.callRPC('plugin-a', 'getUserInfo', '123')
```

### 4. 共享状态 - 响应式数据
```typescript
// 创建
const state = context.createSharedState('data', { count: 0 })
state.count++ // 修改

// 访问
const data = context.getSharedState('plugin-a', 'data')
watch(() => data.count, (count) => {
  console.log('count:', count)
})
```

## 完整示例

### 插件A - 数据提供者
```typescript
export default definePlugin({
  name: 'plugin-a',
  async onLoad(context) {
    // 创建共享状态
    const state = context.createSharedState('users', {
      list: [],
      count: 0
    })
    
    // 提供RPC方法
    context.registerRPC('addUser', async (name) => {
      const user = { id: Date.now(), name }
      state.list.push(user)
      state.count++
      
      // 发送事件通知
      context.emit('user:added', user)
      
      return user
    })
  }
})
```

### 插件B - 数据消费者
```typescript
export default definePlugin({
  name: 'plugin-b',
  async onLoad(context) {
    // 监听事件
    context.on('user:added', (user) => {
      console.log('新用户:', user)
    })
    
    // 访问共享状态
    const users = context.getSharedState('plugin-a', 'users')
    watch(() => users.count, (count) => {
      console.log('用户数:', count)
    })
    
    // 调用RPC
    await context.callRPC('plugin-a', 'addUser', 'Bob')
  }
})
```

## API参考

```typescript
// 事件
context.on(event: string, handler: Function): UnhookFunction
context.emit(event: string, ...args: any[]): void
context.off(event: string, handler?: Function): void

// 消息
context.sendMessage(to: string | undefined, type: string, data: any): string
context.onMessage(handler: (msg: PluginMessage) => void): UnhookFunction

// RPC
context.registerRPC(method: string, handler: Function): UnhookFunction
context.callRPC<T>(pluginId: string, method: string, ...params: any[]): Promise<T>

// 共享状态
context.createSharedState(key: string, initialValue: any, options?: { readonly?: boolean }): any
context.getSharedState(pluginId: string, key: string): any
```

## 选择指南

| 需求 | 使用 |
|------|------|
| 简单通知 | 事件 |
| 结构化数据 | 消息 |
| 需要返回值 | RPC |
| 共享数据 | 共享状态 |

## 注意事项

1. **资源清理** - 插件卸载时自动清理
2. **错误隔离** - 一个插件出错不影响其他插件
3. **类型安全** - 使用TypeScript类型
4. **避免循环** - 不要在事件处理中发送相同事件

示例代码：`pluginLoader/plugins/example-communication/`
