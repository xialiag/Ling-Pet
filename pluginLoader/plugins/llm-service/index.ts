/**
 * LLM服务插件
 * 为桌宠和其他插件提供LLM调用能力
 */

import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: 'llm-service',
  version: '1.0.0',
  description: 'LLM服务提供者',
  
  async onLoad(context: PluginContext) {
    context.debug('LLM服务插件已加载')
    
    // 获取配置
    const apiKey = context.getConfig('apiKey', '')
    const model = context.getConfig('model', 'gpt-3.5-turbo')
    const baseURL = context.getConfig('baseURL', 'https://api.openai.com/v1')
    
    if (!apiKey) {
      context.debug('⚠️ 未配置API密钥，LLM服务将无法使用')
    }
    
    // ========== 注册LLM工具 ==========
    
    // 1. 聊天补全
    context.registerTool({
      name: 'llm_chat',
      description: '与LLM进行对话',
      category: 'llm',
      parameters: [
        {
          name: 'messages',
          type: 'array',
          description: '对话消息列表',
          required: true,
          items: {
            name: 'message',
            type: 'object',
            description: '消息对象',
            properties: {
              role: {
                name: 'role',
                type: 'string',
                description: '角色：system/user/assistant',
                enum: ['system', 'user', 'assistant']
              },
              content: {
                name: 'content',
                type: 'string',
                description: '消息内容'
              }
            }
          }
        },
        {
          name: 'temperature',
          type: 'number',
          description: '温度参数(0-2)',
          required: false
        },
        {
          name: 'maxTokens',
          type: 'number',
          description: '最大token数',
          required: false
        }
      ],
      examples: [
        'llm_chat([{role: "user", content: "你好"}])',
        'llm_chat([{role: "system", content: "你是助手"}, {role: "user", content: "介绍自己"}])'
      ],
      handler: async (messages: any[], temperature?: number, maxTokens?: number) => {
        if (!apiKey) {
          throw new Error('未配置API密钥')
        }
        
        context.debug('调用LLM聊天:', { messages, temperature, maxTokens })
        
        try {
          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: temperature ?? 0.7,
              max_tokens: maxTokens ?? 1000
            })
          })
          
          if (!response.ok) {
            const error = await response.text()
            throw new Error(`LLM API错误: ${response.status} ${error}`)
          }
          
          const data = await response.json()
          
          return {
            content: data.choices[0].message.content,
            usage: data.usage,
            model: data.model
          }
        } catch (error) {
          context.debug('LLM调用失败:', error)
          throw error
        }
      }
    })
    
    // 2. 文本补全
    context.registerTool({
      name: 'llm_complete',
      description: '文本补全',
      category: 'llm',
      parameters: [
        {
          name: 'prompt',
          type: 'string',
          description: '提示文本',
          required: true
        },
        {
          name: 'maxTokens',
          type: 'number',
          description: '最大token数',
          required: false
        }
      ],
      examples: [
        'llm_complete("写一首诗：")',
        'llm_complete("解释量子力学：")'
      ],
      handler: async (prompt: string, maxTokens?: number) => {
        // 使用chat接口实现
        const result = await context.callTool('llm_chat', {
          messages: [{ role: 'user', content: prompt }],
          maxTokens
        })
        
        return result.result?.content
      }
    })
    
    // 3. 函数调用
    context.registerTool({
      name: 'llm_function_call',
      description: 'LLM函数调用（让LLM决定调用哪个工具）',
      category: 'llm',
      parameters: [
        {
          name: 'messages',
          type: 'array',
          description: '对话消息',
          required: true
        },
        {
          name: 'tools',
          type: 'array',
          description: '可用工具列表',
          required: true
        }
      ],
      examples: [
        'llm_function_call(messages, tools)'
      ],
      handler: async (messages: any[], tools: any[]) => {
        if (!apiKey) {
          throw new Error('未配置API密钥')
        }
        
        context.debug('LLM函数调用:', { messages, tools })
        
        try {
          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              tools,
              tool_choice: 'auto'
            })
          })
          
          if (!response.ok) {
            const error = await response.text()
            throw new Error(`LLM API错误: ${response.status} ${error}`)
          }
          
          const data = await response.json()
          const message = data.choices[0].message
          
          // 如果LLM决定调用工具
          if (message.tool_calls) {
            const toolCalls = message.tool_calls.map((tc: any) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments)
            }))
            
            return {
              type: 'tool_calls',
              toolCalls,
              usage: data.usage
            }
          }
          
          // 否则返回文本回复
          return {
            type: 'message',
            content: message.content,
            usage: data.usage
          }
        } catch (error) {
          context.debug('LLM函数调用失败:', error)
          throw error
        }
      }
    })
    
    // 4. 嵌入向量
    context.registerTool({
      name: 'llm_embedding',
      description: '生成文本嵌入向量',
      category: 'llm',
      parameters: [
        {
          name: 'text',
          type: 'string',
          description: '要嵌入的文本',
          required: true
        }
      ],
      examples: [
        'llm_embedding("这是一段文本")'
      ],
      handler: async (text: string) => {
        if (!apiKey) {
          throw new Error('未配置API密钥')
        }
        
        try {
          const response = await fetch(`${baseURL}/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'text-embedding-ada-002',
              input: text
            })
          })
          
          if (!response.ok) {
            const error = await response.text()
            throw new Error(`LLM API错误: ${response.status} ${error}`)
          }
          
          const data = await response.json()
          
          return {
            embedding: data.data[0].embedding,
            usage: data.usage
          }
        } catch (error) {
          context.debug('嵌入向量生成失败:', error)
          throw error
        }
      }
    })
    
    // ========== 注册RPC方法供其他插件调用 ==========
    
    context.registerRPC('chat', async (messages: any[], options?: any) => {
      const result = await context.callTool('llm_chat', {
        messages,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      })
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return result.result
    })
    
    context.registerRPC('complete', async (prompt: string, maxTokens?: number) => {
      const result = await context.callTool('llm_complete', {
        prompt,
        maxTokens
      })
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return result.result
    })
    
    // ========== 创建共享状态 ==========
    
    const llmState = context.createSharedState('llm', {
      available: !!apiKey,
      model,
      requestCount: 0,
      totalTokens: 0
    })
    
    // 监听工具调用，更新统计
    context.on('tool:called', (toolName: string, result: any) => {
      if (toolName.startsWith('llm_')) {
        llmState.requestCount++
        if (result.usage) {
          llmState.totalTokens += result.usage.total_tokens || 0
        }
      }
    })
    
    context.debug('✅ LLM服务已就绪')
    context.debug(`模型: ${model}`)
    context.debug(`API: ${baseURL}`)
    context.debug(`状态: ${apiKey ? '已配置' : '未配置API密钥'}`)
  },
  
  async onUnload(context: PluginContext) {
    context.debug('LLM服务插件已卸载')
  }
})
