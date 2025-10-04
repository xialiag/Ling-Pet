# 桌宠工具系统使用示例

## 基础使用

### 1. 获取工具提示词并注入到系统提示

```typescript
import { getPetToolPrompt } from '@/pluginLoader/init'

// 基础使用
const toolPrompt = getPetToolPrompt()

// 带统计信息和推荐
const enhancedPrompt = getPetToolPrompt({
  includeStats: true,
  includeRecommendations: true,
  sessionId: 'user_session_123'
})

// 构建完整的系统提示词
const systemPrompt = `
你是一个可爱的桌宠助手，名叫小灵。

${enhancedPrompt}

请根据用户的需求，合理使用工具来帮助用户。
`
```

### 2. 处理用户消息和工具调用

```typescript
import {
  extractToolCallFromResponse,
  executePetToolCall,
  formatPetToolResult,
  createPetToolSession
} from '@/pluginLoader/init'

async function handleUserMessage(userMessage: string, userId: string) {
  // 1. 创建或获取会话
  const sessionId = `user_${userId}_${Date.now()}`
  createPetToolSession(sessionId)
  
  // 2. 构建消息列表
  const messages = [
    {
      role: 'system',
      content: `你是小灵，一个可爱的桌宠助手。\n\n${getPetToolPrompt({
        includeStats: true,
        includeRecommendations: true,
        sessionId
      })}`
    },
    {
      role: 'user',
      content: userMessage
    }
  ]
  
  // 3. 调用 LLM
  const llmResponse = await callLLM(messages)
  
  // 4. 检查是否有工具调用
  const toolCall = extractToolCallFromResponse(llmResponse)
  
  if (toolCall) {
    // 5. 执行工具
    const toolResult = await executePetToolCall(
      toolCall.tool, 
      toolCall.args, 
      sessionId
    )
    
    // 6. 将结果注入回对话
    messages.push({
      role: 'assistant',
      content: llmResponse
    })
    
    messages.push({
      role: 'system',
      content: formatPetToolResult(toolResult)
    })
    
    // 7. 让 LLM 基于结果生成最终回复
    const finalResponse = await callLLM(messages)
    
    return {
      response: finalResponse,
      toolUsed: toolCall.tool,
      toolResult: toolResult.success
    }
  }
  
  // 没有工具调用，直接返回
  return {
    response: llmResponse,
    toolUsed: null,
    toolResult: null
  }
}
```

## 高级功能

### 1. 会话管理

```typescript
import {
  createPetToolSession,
  getPetToolSession,
  getPetToolRecommendations
} from '@/pluginLoader/init'

// 创建会话
const sessionId = createPetToolSession()

// 获取会话信息
const session = getPetToolSession(sessionId)
console.log('会话调用历史:', session?.calls)

// 获取智能推荐
const recommendations = getPetToolRecommendations(sessionId)
console.log('推荐工具:', recommendations)
```

### 2. 工具统计和监控

```typescript
import { getPetToolStats } from '@/pluginLoader/init'

// 获取详细统计
const stats = getPetToolStats()
console.log('工具统计:', {
  总工具数: stats.total,
  按分类: stats.byCategory,
  按插件: stats.byPlugin,
  活跃会话: stats.sessions.active,
  总调用次数: stats.sessions.totalCalls,
  工具使用统计: stats.toolStats,
  工具关联关系: stats.toolRelations
})
```

### 3. 多轮对话示例

```typescript
class PetChatManager {
  private sessions = new Map<string, any>()
  
  async startChat(userId: string) {
    const sessionId = createPetToolSession(`user_${userId}`)
    
    this.sessions.set(userId, {
      sessionId,
      messages: [{
        role: 'system',
        content: `你是小灵，一个可爱的桌宠助手。\n\n${getPetToolPrompt({
          includeStats: true,
          includeRecommendations: true,
          sessionId
        })}`
      }]
    })
    
    return sessionId
  }
  
  async sendMessage(userId: string, message: string) {
    const session = this.sessions.get(userId)
    if (!session) {
      throw new Error('会话不存在，请先开始对话')
    }
    
    // 添加用户消息
    session.messages.push({
      role: 'user',
      content: message
    })
    
    // 调用 LLM
    let llmResponse = await callLLM(session.messages)
    
    // 处理工具调用链
    let toolCallCount = 0
    const maxToolCalls = 5 // 防止无限循环
    
    while (toolCallCount < maxToolCalls) {
      const toolCall = extractToolCallFromResponse(llmResponse)
      
      if (!toolCall) break
      
      // 执行工具
      const toolResult = await executePetToolCall(
        toolCall.tool,
        toolCall.args,
        session.sessionId
      )
      
      // 添加助手响应和工具结果
      session.messages.push({
        role: 'assistant',
        content: llmResponse
      })
      
      session.messages.push({
        role: 'system',
        content: formatPetToolResult(toolResult)
      })
      
      // 继续对话
      llmResponse = await callLLM(session.messages)
      toolCallCount++
    }
    
    // 添加最终响应
    session.messages.push({
      role: 'assistant',
      content: llmResponse
    })
    
    return llmResponse
  }
  
  getRecommendations(userId: string) {
    const session = this.sessions.get(userId)
    if (!session) return []
    
    return getPetToolRecommendations(session.sessionId)
  }
}
```

## 实际使用场景

### 场景1：表情包管理

```typescript
// 用户: "帮我找一个开心的表情包"
// 系统会自动：
// 1. 识别需要搜索表情包
// 2. 调用 search_local_emoji 工具
// 3. 如果本地没有，推荐 search_bilibili_emoji
// 4. 如果找到合适的，推荐 download_emoji_suit

const response = await handleUserMessage("帮我找一个开心的表情包", "user123")
// 可能的工具调用链：
// search_local_emoji -> search_bilibili_emoji -> download_emoji_suit
```

### 场景2：智能推荐

```typescript
// 基于用户的使用历史，系统会学习工具之间的关联关系
// 例如：用户经常在搜索表情包后下载，系统会自动推荐下载工具

const sessionId = createPetToolSession()

// 第一次调用搜索
await executePetToolCall('search_local_emoji', { query: '开心' }, sessionId)

// 系统会记录这次调用，并在下次提示中推荐相关工具
const promptWithRecommendations = getPetToolPrompt({
  includeRecommendations: true,
  sessionId
})
// 会包含基于历史的推荐
```

### 场景3：错误恢复

```typescript
// 当工具调用失败时，系统会推荐替代方案
const result = await executePetToolCall('search_bilibili_emoji', { 
  keyword: '测试' 
}, sessionId)

if (!result.success) {
  // 系统会在 result.suggestions 中提供替代工具
  console.log('建议尝试:', result.suggestions)
  // 可能包含: ['search_local_emoji', 'browse_emoji_categories']
}
```

## 调试和监控

### 1. 实时监控

```typescript
// 监听工具调用事件
window.__petToolManager.on?.('toolCall', (event) => {
  console.log('工具调用:', event)
})

// 查看实时统计
setInterval(() => {
  const stats = getPetToolStats()
  console.log('实时统计:', stats)
}, 10000)
```

### 2. 调试工具

```typescript
// 在浏览器控制台中使用
console.log('可用工具:', window.__petToolManager.getToolList())
console.log('工具统计:', window.__petToolManager.getDetailedStats())

// 测试工具调用
const testResult = await window.__petToolManager.executeToolCall({
  tool: 'search_local_emoji',
  args: { query: '测试', limit: 3 }
})
console.log('测试结果:', testResult)
```

## 最佳实践

### 1. 会话管理
- 为每个用户创建独立的会话
- 定期清理过期会话
- 合理设置会话超时时间

### 2. 错误处理
- 始终检查工具调用结果
- 提供友好的错误提示
- 实现工具调用重试机制

### 3. 性能优化
- 避免在系统提示中包含过多统计信息
- 合理使用工具推荐功能
- 监控工具调用性能

### 4. 用户体验
- 在工具执行时显示加载状态
- 提供工具调用的可视化反馈
- 允许用户中断长时间运行的工具

这个工具管理器为桌宠提供了强大的扩展能力，让桌宠能够真正帮助用户完成各种任务！🎉