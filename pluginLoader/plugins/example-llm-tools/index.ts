/**
 * LLM工具使用示例
 * 演示如何注册工具供LLM调用，以及如何调用LLM
 */

import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: 'example-llm-tools',
  version: '1.0.0',
  
  async onLoad(context: PluginContext) {
    context.debug('LLM工具示例插件已加载')
    
    // ========== 1. 注册工具供LLM调用 ==========
    
    // 天气查询工具
    context.registerTool({
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      category: 'utility',
      parameters: [
        {
          name: 'city',
          type: 'string',
          description: '城市名称',
          required: true
        },
        {
          name: 'unit',
          type: 'string',
          description: '温度单位',
          required: false,
          enum: ['celsius', 'fahrenheit']
        }
      ],
      examples: [
        'get_weather("北京")',
        'get_weather("上海", "celsius")'
      ],
      handler: async (city: string, unit: string = 'celsius') => {
        context.debug(`查询天气: ${city}, ${unit}`)
        
        // 模拟天气数据
        return {
          city,
          temperature: unit === 'celsius' ? 22 : 72,
          unit,
          condition: '晴天',
          humidity: 65,
          windSpeed: 12
        }
      }
    })
    
    // 时间查询工具
    context.registerTool({
      name: 'get_current_time',
      description: '获取当前时间',
      category: 'utility',
      parameters: [
        {
          name: 'timezone',
          type: 'string',
          description: '时区',
          required: false
        }
      ],
      examples: [
        'get_current_time()',
        'get_current_time("Asia/Shanghai")'
      ],
      handler: async (timezone?: string) => {
        const now = new Date()
        return {
          timestamp: now.getTime(),
          datetime: now.toISOString(),
          timezone: timezone || 'local',
          formatted: now.toLocaleString('zh-CN')
        }
      }
    })
    
    // 计算器工具
    context.registerTool({
      name: 'calculate',
      description: '执行数学计算',
      category: 'utility',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: '数学表达式',
          required: true
        }
      ],
      examples: [
        'calculate("2 + 2")',
        'calculate("Math.sqrt(16)")'
      ],
      handler: async (expression: string) => {
        try {
          // 安全的计算（实际应用中应该使用更安全的方法）
          const result = eval(expression)
          return {
            expression,
            result,
            type: typeof result
          }
        } catch (error) {
          throw new Error(`计算错误: ${error}`)
        }
      }
    })
    
    // 搜索工具
    context.registerTool({
      name: 'search',
      description: '搜索信息',
      category: 'utility',
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
          description: '结果数量',
          required: false
        }
      ],
      examples: [
        'search("Vue.js教程")',
        'search("TypeScript", 5)'
      ],
      handler: async (query: string, limit: number = 10) => {
        context.debug(`搜索: ${query}, 限制: ${limit}`)
        
        // 模拟搜索结果
        return {
          query,
          results: [
            { title: `${query} - 结果1`, url: 'https://example.com/1' },
            { title: `${query} - 结果2`, url: 'https://example.com/2' },
            { title: `${query} - 结果3`, url: 'https://example.com/3' }
          ].slice(0, limit),
          total: 100
        }
      }
    })
    
    // ========== 2. 演示如何调用LLM ==========
    
    // 延迟执行，确保llm-service已加载
    setTimeout(async () => {
      try {
        // 获取所有可用工具
        const tools = context.getAvailableTools()
        context.debug('可用工具:', tools.map(t => t.name))
        
        // 调用LLM聊天
        const chatResult = await context.callTool('llm_chat', {
          messages: [
            { role: 'system', content: '你是一个有用的助手' },
            { role: 'user', content: '你好！' }
          ]
        })
        
        if (chatResult.success) {
          context.debug('LLM回复:', chatResult.result.content)
        }
        
        // 使用RPC调用（更简洁）
        const response = await context.callRPC('llm-service', 'chat', [
          { role: 'user', content: '介绍一下自己' }
        ])
        
        context.debug('LLM回复（RPC）:', response.content)
        
      } catch (error) {
        context.debug('LLM调用失败:', error)
      }
    }, 2000)
    
    // ========== 3. 演示LLM函数调用 ==========
    
    // 创建一个助手，可以调用工具
    const createAssistant = async (userMessage: string) => {
      try {
        // 获取所有工具定义
        const availableTools = context.getAvailableTools()
          .filter(t => t.category === 'utility')
          .map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: {
                type: 'object',
                properties: t.parameters.reduce((acc, p) => {
                  acc[p.name] = {
                    type: p.type,
                    description: p.description,
                    enum: p.enum
                  }
                  return acc
                }, {} as any),
                required: t.parameters.filter(p => p.required).map(p => p.name)
              }
            }
          }))
        
        // 调用LLM，让它决定是否需要调用工具
        const result = await context.callTool('llm_function_call', {
          messages: [
            { role: 'system', content: '你是一个助手，可以使用工具来帮助用户' },
            { role: 'user', content: userMessage }
          ],
          tools: availableTools
        })
        
        if (result.success && result.result.type === 'tool_calls') {
          context.debug('LLM决定调用工具:', result.result.toolCalls)
          
          // 执行工具调用
          const toolResults = []
          for (const toolCall of result.result.toolCalls) {
            const toolResult = await context.callTool(toolCall.name, toolCall.arguments)
            toolResults.push({
              toolCall,
              result: toolResult
            })
          }
          
          return {
            type: 'tool_calls',
            toolCalls: result.result.toolCalls,
            toolResults
          }
        } else {
          return {
            type: 'message',
            content: result.result.content
          }
        }
      } catch (error) {
        context.debug('助手执行失败:', error)
        throw error
      }
    }
    
    // 注册助手为RPC方法
    context.registerRPC('assistant', createAssistant)
    
    // ========== 4. 测试助手 ==========
    
    setTimeout(async () => {
      try {
        // 测试1：需要调用工具的问题
        const result1 = await context.callRPC('example-llm-tools', 'assistant', '北京的天气怎么样？')
        context.debug('助手回复1:', result1)
        
        // 测试2：不需要调用工具的问题
        const result2 = await context.callRPC('example-llm-tools', 'assistant', '你好，介绍一下自己')
        context.debug('助手回复2:', result2)
      } catch (error) {
        context.debug('助手测试失败:', error)
      }
    }, 3000)
    
    context.debug('✅ LLM工具示例已就绪')
  },
  
  async onUnload(context: PluginContext) {
    context.debug('LLM工具示例插件已卸载')
  }
})
