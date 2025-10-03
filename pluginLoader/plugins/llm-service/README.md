# LLM服务插件

为桌宠和其他插件提供LLM调用能力。

## 功能

### 注册的工具

1. **llm_chat** - 聊天补全
2. **llm_complete** - 文本补全
3. **llm_function_call** - 函数调用
4. **llm_embedding** - 嵌入向量

### RPC方法

1. **chat(messages, options)** - 聊天
2. **complete(prompt, maxTokens)** - 补全

### 共享状态

- `llm.available` - 是否可用
- `llm.model` - 使用的模型
- `llm.requestCount` - 请求次数
- `llm.totalTokens` - 总token数

## 配置

```json
{
  "apiKey": "your-api-key",
  "model": "gpt-3.5-turbo",
  "baseURL": "https://api.openai.com/v1"
}
```

## 使用示例

### 1. 使用工具

```typescript
// 聊天
const result = await context.callTool('llm_chat', {
  messages: [
    { role: 'user', content: '你好' }
  ]
})

console.log(result.result.content)
```

### 2. 使用RPC

```typescript
// 更简洁的方式
const response = await context.callRPC('llm-service', 'chat', [
  { role: 'user', content: '你好' }
])

console.log(response.content)
```

### 3. 访问共享状态

```typescript
const llmState = context.getSharedState('llm-service', 'llm')
console.log('LLM可用:', llmState.available)
console.log('请求次数:', llmState.requestCount)
```

## 依赖

其他插件可以依赖此插件：

```json
{
  "dependencies": {
    "llm-service": "^1.0.0"
  }
}
```
