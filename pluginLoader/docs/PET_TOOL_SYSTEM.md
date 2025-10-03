# 桌宠工具系统

## 概述

桌宠工具系统让桌宠 LLM 能够调用插件提供的工具来完成用户的请求。

## 架构

```
┌─────────────────────────────────────────┐
│            桌宠 LLM                      │
│  ┌────────────────────────────────┐    │
│  │  系统提示词 + 工具列表          │    │
│  └────────────────────────────────┘    │
│              ↓                          │
│  ┌────────────────────────────────┐    │
│  │  用户消息                       │    │
│  └────────────────────────────────┘    │
│              ↓                          │
│  ┌────────────────────────────────┐    │
│  │  LLM 生成响应                   │    │
│  │  (可能包含工具调用)             │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      PetToolManager                     │
│  ┌────────────────────────────────┐    │
│  │  解析工具调用                   │    │
│  └────────────────────────────────┘    │
│              ↓                          │
│  ┌────────────────────────────────┐    │
│  │  执行工具                       │    │
│  └────────────────────────────────┘    │
│              ↓                          │
│  ┌────────────────────────────────┐    │
│  │  返回结果                       │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         插件工具                         │
│  - search_local_emoji                   │
│  - download_emoji_suit                  │
│  - send_emoji                           │
│  - ...                                  │
└─────────────────────────────────────────┘
```

## 使用流程

### 1. 插件注册工具

插件通过 `context.registerTool()` 注册工具：

```typescript
export default definePlugin({
  name: 'bilibili-emoji',
  
  async onLoad(context) {
    // 注册工具
    context.registerTool({
      name: 'search_local_emoji',
      description: '搜索本地已下载的表情包',
      category: 'emoji',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: '搜索关键词',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: '返回结果数量',
          required: false
        }
      ],
      handler: async (query: string, limit: number = 10) => {
        // 实现搜索逻辑
        return {
          count: 5,
          emojis: [...]
        }
      }
    })
  }
})
```

### 2. 生成工具提示词

在桌宠 LLM 的系统提示词中注入工具列表：

```typescript
import { getPetToolPrompt } from '@/pluginLoader/init'

// 获取工具提示词
const toolPrompt = getPetToolPrompt()

// 构建完整的系统提示词
const systemPrompt = `
你是一个可爱的桌宠助手。

${toolPrompt}
`
```

生成的提示词格式：

```
## 可用工具

你可以使用以下工具来完成用户的请求。要调用工具，请使用以下格式：

\`\`\`tool
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
\`\`\`

### search_local_emoji
搜索本地已下载的表情包
分类: emoji
参数:
  - query (string) (必需): 搜索关键词
  - limit (number) (可选): 返回结果数量
  示例: search_local_emoji("开心"), search_local_emoji("哭", 5)

### download_emoji_suit
下载B站表情包装扮到本地
分类: emoji
参数:
  - suitId (number) (必需): 装扮ID（从search_bilibili_emoji获取）
  - suitType (string) (必需): 装扮类型：normal 或 dlc
  - lotteryId (number) (可选): 抽奖ID（dlc类型需要）
  示例: download_emoji_suit(114156001, "normal")

...
```

### 3. LLM 调用工具

当用户请求需要工具时，LLM 会生成工具调用：

**用户**: 帮我搜索一个开心的表情包

**LLM 响应**:
```
好的，我来帮你搜索开心的表情包。

\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
\`\`\`
```

### 4. 解析并执行工具

```typescript
import { 
  extractToolCallFromResponse,
  executePetToolCall 
} from '@/pluginLoader/init'

// 从 LLM 响应中提取工具调用
const toolCall = extractToolCallFromResponse(llmResponse)

if (toolCall) {
  // 执行工具
  const result = await executePetToolCall(toolCall.tool, toolCall.args)
  
  if (result.success) {
    console.log('工具执行成功:', result.result)
    
    // 将结果注入回对话
    const resultText = `
[工具执行结果]
工具: ${result.toolName}
结果: ${JSON.stringify(result.result, null, 2)}
`
    
    // 继续对话，让 LLM 基于结果生成最终回复
    // ...
  } else {
    console.error('工具执行失败:', result.error)
  }
}
```

### 5. LLM 生成最终回复

将工具结果注入回对话后，LLM 生成最终回复：

```
我找到了 5 个开心的表情包：
1. 开心笑脸 (静态图)
2. 开心跳舞 (动图)
3. 开心鼓掌 (动图)
4. 开心庆祝 (静态图)
5. 开心比心 (静态图)

你想要哪一个呢？
```

## 完整示例

### 桌宠对话处理

```typescript
import {
  getPetToolPrompt,
  extractToolCallFromResponse,
  executePetToolCall
} from '@/pluginLoader/init'

async function handleUserMessage(userMessage: string) {
  // 1. 构建消息列表
  const messages = [
    {
      role: 'system',
      content: `你是一个可爱的桌宠助手。\n\n${getPetToolPrompt()}`
    },
    {
      role: 'user',
      content: userMessage
    }
  ]
  
  // 2. 调用 LLM
  const llmResponse = await callLLM(messages)
  
  // 3. 检查是否有工具调用
  const toolCall = extractToolCallFromResponse(llmResponse)
  
  if (toolCall) {
    // 4. 执行工具
    const toolResult = await executePetToolCall(toolCall.tool, toolCall.args)
    
    // 5. 将结果注入回对话
    messages.push({
      role: 'assistant',
      content: llmResponse
    })
    
    messages.push({
      role: 'system',
      content: `[工具执行结果]\n工具: ${toolResult.toolName}\n结果: ${JSON.stringify(toolResult.result)}`
    })
    
    // 6. 让 LLM 基于结果生成最终回复
    const finalResponse = await callLLM(messages)
    
    return finalResponse
  }
  
  // 没有工具调用，直接返回
  return llmResponse
}
```

## API 参考

### getPetToolPrompt()

获取工具提示词，用于注入到系统提示中。

```typescript
const toolPrompt = getPetToolPrompt()
```

### extractToolCallFromResponse(response: string)

从 LLM 响应中提取工具调用。

```typescript
const toolCall = extractToolCallFromResponse(llmResponse)
// 返回: { tool: 'search_local_emoji', args: { query: '开心', limit: 5 } }
// 或 null（如果没有工具调用）
```

### executePetToolCall(toolName: string, args: Record<string, any>)

执行工具调用。

```typescript
const result = await executePetToolCall('search_local_emoji', {
  query: '开心',
  limit: 5
})

// 返回:
// {
//   success: true,
//   result: { count: 5, emojis: [...] },
//   toolName: 'search_local_emoji'
// }
```

### getPetToolList()

获取简化的工具列表（用于 UI 显示）。

```typescript
const tools = getPetToolList()
// 返回:
// [
//   {
//     name: 'search_local_emoji',
//     description: '搜索本地已下载的表情包',
//     category: 'emoji',
//     plugin: 'bilibili-emoji',
//     paramCount: 2
//   },
//   ...
// ]
```

### getPetToolDocumentation()

获取 Markdown 格式的工具文档。

```typescript
const doc = getPetToolDocumentation()
// 返回完整的 Markdown 文档
```

## 工具调用格式

LLM 必须使用以下格式调用工具：

```
\`\`\`tool
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
\`\`\`
```

**示例**:

```
\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
\`\`\`
```

## 最佳实践

### 1. 提示词设计

在系统提示词中明确说明工具使用规则：

```
## 工具使用规则

1. 当用户的请求需要使用工具时，先输出你的思考过程
2. 然后使用 \`\`\`tool 代码块调用工具
3. 等待工具执行结果后，再给出最终回复
4. 一次只能调用一个工具
5. 如果需要多个工具，请分步骤调用
```

### 2. 错误处理

```typescript
const result = await executePetToolCall(toolCall.tool, toolCall.args)

if (!result.success) {
  // 告诉 LLM 工具执行失败
  const errorMessage = `工具执行失败: ${result.error}`
  // 继续对话...
}
```

### 3. 工具链

对于需要多个工具的复杂任务，让 LLM 分步骤调用：

```
用户: 帮我下载鸽宝表情包

LLM: 好的，我先搜索鸽宝表情包。

\`\`\`tool
{
  "tool": "search_bilibili_emoji",
  "args": { "keyword": "鸽宝" }
}
\`\`\`

[工具结果: 找到装扮 ID 114156001]

LLM: 找到了鸽宝装扮，现在开始下载。

\`\`\`tool
{
  "tool": "download_emoji_suit",
  "args": { "suitId": 114156001, "suitType": "normal" }
}
\`\`\`

[工具结果: 成功下载 24 个表情包]

LLM: 已成功下载鸽宝表情包，共 24 个表情！
```

## 调试

### 查看可用工具

```typescript
const tools = getPetToolList()
console.log('可用工具:', tools)
```

### 查看工具统计

```typescript
const stats = (window as any).__petToolManager.getToolStats()
console.log('工具统计:', stats)
```

### 测试工具调用

```typescript
const result = await executePetToolCall('search_local_emoji', {
  query: '开心',
  limit: 5
})
console.log('测试结果:', result)
```

## 总结

桌宠工具系统提供了：

✅ 自动扫描插件注册的工具
✅ 生成工具提示词注入到系统提示
✅ 解析 LLM 的工具调用请求
✅ 执行工具并返回结果
✅ 完整的错误处理
✅ 工具文档生成

让桌宠 LLM 能够真正使用插件提供的能力！🎉
