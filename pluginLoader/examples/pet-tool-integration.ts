/**
 * 桌宠工具集成示例
 * 展示如何在桌宠 LLM 中集成工具调用能力
 */

import {
  getPetToolPrompt,
  extractToolCallFromResponse,
  executePetToolCall
} from '../init'

// ========== 示例 1: 基础集成 ==========

/**
 * 简单的对话处理函数
 */
async function handleUserMessage(userMessage: string): Promise<string> {
  // 1. 构建系统提示词（包含工具列表）
  const systemPrompt = `你是一个可爱的桌宠助手，名叫小灵。

你的特点：
- 活泼可爱，喜欢用表情包
- 乐于助人，善于使用工具
- 回复简洁明了

${getPetToolPrompt()}`

  // 2. 构建消息列表
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]

  // 3. 调用 LLM（这里需要替换为实际的 LLM 调用）
  const llmResponse = await callYourLLM(messages)

  // 4. 检查是否有工具调用
  const toolCall = extractToolCallFromResponse(llmResponse)

  if (toolCall) {
    // 5. 执行工具
    const toolResult = await executePetToolCall(toolCall.tool, toolCall.args)

    if (toolResult.success) {
      // 6. 将结果注入回对话
      messages.push({ role: 'assistant', content: llmResponse })
      messages.push({
        role: 'system',
        content: `[工具执行结果]\n工具: ${toolResult.toolName}\n结果: ${JSON.stringify(toolResult.result, null, 2)}`
      })

      // 7. 让 LLM 基于结果生成最终回复
      const finalResponse = await callYourLLM(messages)
      return finalResponse
    } else {
      // 工具执行失败
      return `抱歉，工具执行失败了：${toolResult.error}`
    }
  }

  // 没有工具调用，直接返回
  return llmResponse
}

// ========== 示例 2: 完整的对话管理 ==========

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

class PetChatManager {
  private conversationHistory: Message[] = []
  private maxHistoryLength = 20

  constructor() {
    // 初始化系统提示词
    this.conversationHistory.push({
      role: 'system',
      content: this.buildSystemPrompt()
    })
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    return `你是一个可爱的桌宠助手，名叫小灵。

你的特点：
- 活泼可爱，喜欢用表情包
- 乐于助人，善于使用工具
- 回复简洁明了

${getPetToolPrompt()}`
  }

  /**
   * 处理用户消息
   */
  async chat(userMessage: string): Promise<string> {
    // 添加用户消息
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    })

    // 限制历史长度
    this.trimHistory()

    // 调用 LLM
    let response = await this.callLLM()

    // 检查工具调用
    const toolCall = extractToolCallFromResponse(response)

    if (toolCall) {
      // 执行工具
      const toolResult = await executePetToolCall(toolCall.tool, toolCall.args)

      // 添加助手响应
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      })

      if (toolResult.success) {
        // 添加工具结果
        this.conversationHistory.push({
          role: 'system',
          content: `[工具执行结果]\n工具: ${toolResult.toolName}\n结果: ${JSON.stringify(toolResult.result, null, 2)}`
        })

        // 再次调用 LLM 生成最终回复
        response = await this.callLLM()
      } else {
        // 工具失败，让 LLM 知道
        this.conversationHistory.push({
          role: 'system',
          content: `[工具执行失败]\n工具: ${toolResult.toolName}\n错误: ${toolResult.error}`
        })

        response = await this.callLLM()
      }
    }

    // 添加最终响应
    this.conversationHistory.push({
      role: 'assistant',
      content: response
    })

    return response
  }

  /**
   * 调用 LLM
   */
  private async callLLM(): Promise<string> {
    // 这里需要替换为实际的 LLM 调用
    return callYourLLM(this.conversationHistory)
  }

  /**
   * 限制历史长度
   */
  private trimHistory() {
    // 保留系统提示词
    const systemPrompt = this.conversationHistory[0]

    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = [
        systemPrompt,
        ...this.conversationHistory.slice(-this.maxHistoryLength + 1)
      ]
    }
  }

  /**
   * 清空对话历史
   */
  clearHistory() {
    this.conversationHistory = [
      {
        role: 'system',
        content: this.buildSystemPrompt()
      }
    ]
  }

  /**
   * 获取对话历史
   */
  getHistory(): Message[] {
    return [...this.conversationHistory]
  }
}

// ========== 示例 3: 在 Vue 组件中使用 ==========

/**
 * Vue 组件示例（伪代码）
 * 实际使用时需要根据 Vue 版本调整
 */
export function createPetChatComponent() {
  const chatManager = new PetChatManager()
  const userInput = ''
  const messages: Array<{ role: string; content: string }> = []
  let isProcessing = false

  async function sendMessage() {
    if (!userInput.trim() || isProcessing) return

    const userMessage = userInput
    // userInput = ''

    // 显示用户消息
    messages.push({
      role: 'user',
      content: userMessage
    })

    isProcessing = true

    try {
      // 处理消息
      const response = await chatManager.chat(userMessage)

      // 显示助手回复
      messages.push({
        role: 'assistant',
        content: response
      })
    } catch (error) {
      console.error('Chat error:', error)
      messages.push({
        role: 'assistant',
        content: '抱歉，出现了一些问题...'
      })
    } finally {
      isProcessing = false
    }
  }

  function clearChat() {
    chatManager.clearHistory()
    messages.length = 0
  }

  return {
    chatManager,
    userInput,
    messages,
    isProcessing,
    sendMessage,
    clearChat
  }
}

// ========== 示例 4: 工具调用监控 ==========

/**
 * 监控工具调用
 */
class ToolCallMonitor {
  private calls: Array<{
    timestamp: number
    tool: string
    args: any
    result: any
    success: boolean
    duration: number
  }> = []

  /**
   * 记录工具调用
   */
  async monitorToolCall(toolName: string, args: Record<string, any>) {
    const startTime = Date.now()

    try {
      const result = await executePetToolCall(toolName, args)
      const duration = Date.now() - startTime

      this.calls.push({
        timestamp: startTime,
        tool: toolName,
        args,
        result: result.result,
        success: result.success,
        duration
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      this.calls.push({
        timestamp: startTime,
        tool: toolName,
        args,
        result: null,
        success: false,
        duration
      })

      throw error
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const totalCalls = this.calls.length
    const successCalls = this.calls.filter(c => c.success).length
    const failedCalls = totalCalls - successCalls
    const avgDuration = this.calls.reduce((sum, c) => sum + c.duration, 0) / totalCalls

    const byTool = new Map<string, number>()
    this.calls.forEach(c => {
      byTool.set(c.tool, (byTool.get(c.tool) || 0) + 1)
    })

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate: (successCalls / totalCalls * 100).toFixed(2) + '%',
      avgDuration: avgDuration.toFixed(2) + 'ms',
      byTool: Object.fromEntries(byTool)
    }
  }

  /**
   * 获取最近的调用
   */
  getRecentCalls(limit: number = 10) {
    return this.calls.slice(-limit)
  }
}

// ========== 辅助函数 ==========

/**
 * 模拟 LLM 调用（需要替换为实际实现）
 */
async function callYourLLM(messages: Message[]): Promise<string> {
  // 这里应该调用实际的 LLM API
  // 例如：OpenAI、Claude、本地模型等
  
  console.log('Calling LLM with messages:', messages)
  
  // 模拟响应
  return '这是一个模拟的 LLM 响应'
}

// ========== 导出 ==========

export {
  handleUserMessage,
  PetChatManager,
  ToolCallMonitor
}
