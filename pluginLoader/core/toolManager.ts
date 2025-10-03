/**
 * LLM工具管理器
 * 允许插件注册工具供LLM调用
 */

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  enum?: string[]
  properties?: Record<string, ToolParameter>
  items?: ToolParameter
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  handler: (...args: any[]) => Promise<any> | any
  pluginId: string
  category?: string
  examples?: string[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
  timestamp: number
}

export interface ToolResult {
  id: string
  success: boolean
  result?: any
  error?: string
  duration: number
}

/**
 * 工具管理器
 */
export class ToolManager {
  private tools = new Map<string, ToolDefinition>()
  private toolHistory: Array<{ call: ToolCall; result: ToolResult }> = []
  private maxHistorySize = 100

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): () => void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolManager] Tool ${tool.name} already exists, overwriting`)
    }

    this.tools.set(tool.name, tool)
    console.log(`[ToolManager] Tool registered: ${tool.name} by ${tool.pluginId}`)

    // 返回取消注册函数
    return () => {
      this.tools.delete(tool.name)
      console.log(`[ToolManager] Tool unregistered: ${tool.name}`)
    }
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        id: this.generateId(),
        success: false,
        error: `Tool ${name} not found`,
        duration: 0
      }
    }

    const call: ToolCall = {
      id: this.generateId(),
      name,
      arguments: args,
      timestamp: Date.now()
    }

    const startTime = performance.now()

    try {
      console.log(`[ToolManager] Calling tool: ${name}`, args)

      // 验证参数
      const validationError = this.validateArguments(tool, args)
      if (validationError) {
        throw new Error(validationError)
      }

      // 执行工具
      const result = await tool.handler(...this.extractArgs(tool, args))

      const duration = performance.now() - startTime

      const toolResult: ToolResult = {
        id: call.id,
        success: true,
        result,
        duration
      }

      // 记录历史
      this.addToHistory(call, toolResult)

      console.log(`[ToolManager] Tool ${name} completed in ${duration.toFixed(2)}ms`)

      return toolResult
    } catch (error) {
      const duration = performance.now() - startTime

      const toolResult: ToolResult = {
        id: call.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      }

      // 记录历史
      this.addToHistory(call, toolResult)

      console.error(`[ToolManager] Tool ${name} failed:`, error)

      return toolResult
    }
  }

  /**
   * 获取所有工具
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 获取工具定义
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取工具的OpenAI格式定义
   */
  getToolsForLLM(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.parametersToSchema(tool.parameters),
          required: tool.parameters
            .filter(p => p.required)
            .map(p => p.name)
        }
      }
    }))
  }

  /**
   * 获取工具历史
   */
  getHistory(limit?: number): Array<{ call: ToolCall; result: ToolResult }> {
    if (limit) {
      return this.toolHistory.slice(-limit)
    }
    return [...this.toolHistory]
  }

  /**
   * 清理插件的所有工具
   */
  cleanupPlugin(pluginId: string): void {
    const toolsToRemove: string[] = []

    this.tools.forEach((tool, name) => {
      if (tool.pluginId === pluginId) {
        toolsToRemove.push(name)
      }
    })

    toolsToRemove.forEach(name => this.tools.delete(name))

    if (toolsToRemove.length > 0) {
      console.log(`[ToolManager] Cleaned up ${toolsToRemove.length} tools for plugin ${pluginId}`)
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const byPlugin = new Map<string, number>()
    const byCategory = new Map<string, number>()

    this.tools.forEach(tool => {
      byPlugin.set(tool.pluginId, (byPlugin.get(tool.pluginId) || 0) + 1)
      if (tool.category) {
        byCategory.set(tool.category, (byCategory.get(tool.category) || 0) + 1)
      }
    })

    return {
      totalTools: this.tools.size,
      byPlugin: Object.fromEntries(byPlugin),
      byCategory: Object.fromEntries(byCategory),
      historySize: this.toolHistory.length
    }
  }

  /**
   * 验证参数
   */
  private validateArguments(tool: ToolDefinition, args: Record<string, any>): string | null {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in args)) {
        return `Missing required parameter: ${param.name}`
      }

      if (param.name in args) {
        const value = args[param.name]
        const actualType = Array.isArray(value) ? 'array' : typeof value

        if (actualType !== param.type && value !== null && value !== undefined) {
          return `Parameter ${param.name} should be ${param.type}, got ${actualType}`
        }

        if (param.enum && !param.enum.includes(value)) {
          return `Parameter ${param.name} must be one of: ${param.enum.join(', ')}`
        }
      }
    }

    return null
  }

  /**
   * 提取参数数组
   */
  private extractArgs(tool: ToolDefinition, args: Record<string, any>): any[] {
    return tool.parameters.map(param => args[param.name])
  }

  /**
   * 转换参数为JSON Schema
   */
  private parametersToSchema(parameters: ToolParameter[]): Record<string, any> {
    const schema: Record<string, any> = {}

    parameters.forEach(param => {
      schema[param.name] = {
        type: param.type,
        description: param.description
      }

      if (param.enum) {
        schema[param.name].enum = param.enum
      }

      if (param.properties) {
        schema[param.name].properties = this.parametersToSchema(
          Object.values(param.properties)
        )
      }

      if (param.items) {
        schema[param.name].items = {
          type: param.items.type,
          description: param.items.description
        }
      }
    })

    return schema
  }

  /**
   * 添加到历史
   */
  private addToHistory(call: ToolCall, result: ToolResult): void {
    this.toolHistory.push({ call, result })

    if (this.toolHistory.length > this.maxHistorySize) {
      this.toolHistory.shift()
    }
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 全局实例
export const toolManager = new ToolManager()
