# 桌宠工具系统 - 快速开始

## 5 分钟集成指南

### 步骤 1: 导入 API

```typescript
import {
  getPetToolPrompt,
  extractToolCallFromResponse,
  executePetToolCall
} from '@/pluginLoader/init'
```

### 步骤 2: 修改系统提示词

在桌宠 LLM 的系统提示词中添加工具列表：

```typescript
const systemPrompt = `你是一个可爱的桌宠助手。

${getPetToolPrompt()}`
```

### 步骤 3: 处理 LLM 响应

在 LLM 响应后检查工具调用：

```typescript
// 调用 LLM
const llmResponse = await yourLLMFunction(messages)

// 检查工具调用
const toolCall = extractToolCallFromResponse(llmResponse)

if (toolCall) {
  // 执行工具
  const result = await executePetToolCall(toolCall.tool, toolCall.args)
  
  if (result.success) {
    // 将结果注入回对话
    // 再次调用 LLM 生成最终回复
  }
}
```

### 完整示例

```typescript
async function chat(userMessage: string) {
  const messages = [
    {
      role: 'system',
      content: `你是桌宠助手。\n\n${getPetToolPrompt()}`
    },
    {
      role: 'user',
      content: userMessage
    }
  ]

  // 第一次调用 LLM
  let response = await callLLM(messages)

  // 检查工具调用
  const toolCall = extractToolCallFromResponse(response)

  if (toolCall) {
    // 执行工具
    const result = await executePetToolCall(toolCall.tool, toolCall.args)

    // 添加工具结果到对话
    messages.push({ role: 'assistant', content: response })
    messages.push({
      role: 'system',
      content: `[工具结果] ${JSON.stringify(result.result)}`
    })

    // 第二次调用 LLM
    response = await callLLM(messages)
  }

  return response
}
```

## 测试

### 测试工具列表

```typescript
console.log(getPetToolPrompt())
```

### 测试工具调用

```typescript
const result = await executePetToolCall('search_local_emoji', {
  query: '开心',
  limit: 5
})
console.log(result)
```

## 常见问题

### Q: 工具列表为空？
A: 确保插件已加载并注册了工具。

### Q: 工具调用失败？
A: 检查参数是否正确，查看 `result.error`。

### Q: LLM 不调用工具？
A: 优化系统提示词，明确说明何时使用工具。

## 下一步

- 查看完整文档: `PET_TOOL_SYSTEM.md`
- 查看示例代码: `examples/pet-tool-integration.ts`
- 开发自己的工具插件
