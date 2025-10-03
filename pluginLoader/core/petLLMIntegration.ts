/**
 * 桌宠 LLM 集成
 * 自动将工具能力注入到桌宠的对话流程中
 */

import { petToolManager } from './petToolManager'
import type { PluginContext } from '../types/api'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

/**
 * 桌宠 LLM 集成管理器
 */
export class PetLLMIntegration {
  private context: PluginContext | null = null

  /**
   * 初始化集成
   */
  initialize(context: PluginContext) {
    this.context = context
    this.setupHooks()
  }

  /**
   * 设置 Hook 来拦截 LLM 调用
   */
  private setupHooks() {
    if (!this.context) return

    // Hook 桌宠的聊天服务
    // 假设桌宠使用某个 store 或 service 来处理对话
    // 这里需要根据实际的桌宠实现来调整

    console.log('[PetLLMIntegration] Hooks setup complete')
  }

  /**
   * 注入工具提示词到系统消息
   */
  injectToolPrompt(messages: ChatMessage[]): ChatMessage[] {
    const toolPrompt = petToolManager.generateToolPrompt()
    
    if (!toolPrompt) {
      return messages
    }

    // 查找系统消息
    const systemMessageIndex = messages.findIndex(m => m.role === 'system')
    
    if (systemMessageIndex >= 0) {
      // 在现有系统消息后追加工具提示
      const newMessages = [...messages]
      newMessages[systemMessageIndex] = {
        ...newMessages[systemMessageIndex],
        content: newMessages[systemMessageIndex].content + '\n\n' + toolPrompt
      }
      return newMessages
    } else {
      // 添加新的系统消息
      return [
        {
          role: 'system',
          content: toolPrompt
        },
        ...messages
      ]
    }
  }

  /**
   * 处理 LLM 响应，检查是否包含工具调用
   */
  async processLLMResponse(
    response: string
  ): Promise<{
    finalResponse: string
    toolCalls: Array<{ tool: string; result: any }>
  }> {
    const toolCalls: Array<{ tool: string; result: any }> = []
    let currentResponse = response
    let maxIterations = 5 // 防止无限循环
    let iteration = 0

    while (iteration < maxIterations) {
      // 检查是否有工具调用
      const toolCall = petToolManager.extractToolCall(currentResponse)
      
      if (!toolCall) {
        // 没有工具调用，返回最终响应
        break
      }

      // 执行工具
      const result = await petToolManager.executeToolCall(toolCall)
      toolCalls.push({
        tool: toolCall.tool,
        result: result.result
      })

      // 格式化工具结果
      const resultText = petToolManager.formatToolResult(result)

      // 将工具结果注入回对话
      // 这里需要再次调用 LLM，让它基于工具结果生成最终回复
      // 实际实现需要根据桌宠的 LLM 调用方式来调整
      
      console.log('[PetLLMIntegration] Tool executed:', toolCall.tool, result)
      
      // 简化处理：直接返回工具结果
      currentResponse = `工具执行完成：\n${resultText}\n\n基于以上结果，${currentResponse.split('```tool')[0]}`
      break
    }

    return {
      finalResponse: currentResponse,
      toolCalls
    }
  }

  /**
   * 包装桌宠的聊天函数
   */
  wrapChatFunction(originalChat: (options: ChatOptions) => Promise<string>) {
    return async (options: ChatOptions): Promise<string> => {
      // 1. 注入工具提示词
      const messagesWithTools = this.injectToolPrompt(options.messages)

      // 2. 调用原始聊天函数
      const response = await originalChat({
        ...options,
        messages: messagesWithTools
      })

      // 3. 处理响应，检查工具调用
      const { finalResponse } = await this.processLLMResponse(response)

      return finalResponse
    }
  }

  /**
   * 获取当前可用工具的摘要
   */
  getToolsSummary(): string {
    const stats = petToolManager.getToolStats()
    
    if (stats.total === 0) {
      return '当前没有可用的工具。'
    }

    const categories = Object.entries(stats.byCategory)
      .map(([cat, count]) => `${cat}(${count})`)
      .join(', ')

    return `当前有 ${stats.total} 个可用工具，分类：${categories}`
  }
}

// 全局实例
export const petLLMIntegration = new PetLLMIntegration()
