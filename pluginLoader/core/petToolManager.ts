/**
 * 桌宠工具管理器
 * 专门为桌宠 LLM 提供工具调用能力
 * 
 * 功能：
 * 1. 扫描插件注册的工具
 * 2. 生成工具列表提示词
 * 3. 解析 LLM 的工具调用请求
 * 4. 执行工具并返回结果
 * 5. 管理工具调用上下文和历史
 * 6. 提供智能工具推荐
 */

import { toolManager, type ToolDefinition } from './toolManager'

export interface PetToolCall {
  tool: string
  args: Record<string, any>
  context?: string // 调用上下文
  sessionId?: string // 会话ID
}

export interface PetToolResult {
  success: boolean
  result?: any
  error?: string
  toolName: string
  duration?: number
  suggestions?: string[] // 后续建议的工具
  context?: any // 上下文信息
}

export interface ToolCallSession {
  id: string
  startTime: number
  calls: Array<{
    call: PetToolCall
    result: PetToolResult
    timestamp: number
  }>
  context: Record<string, any>
}

export interface ToolRecommendation {
  toolName: string
  reason: string
  confidence: number
  suggestedArgs?: Record<string, any>
}

/**
 * 桌宠工具管理器
 */
export class PetToolManager {
  private sessions = new Map<string, ToolCallSession>()
  private maxSessionAge = 30 * 60 * 1000 // 30分钟
  private toolUsageStats = new Map<string, { count: number; successRate: number; avgDuration: number }>()
  private toolRelations = new Map<string, Set<string>>() // 工具关联关系
  /**
   * 生成工具列表提示词
   * 用于注入到桌宠 LLM 的系统提示词中
   */
  generateToolPrompt(): string {
    const tools = toolManager.getTools()

    if (tools.length === 0) {
      return ''
    }

    const toolDescriptions = tools.map(tool => {
      const params = tool.parameters.map(p => {
        const required = p.required ? '(必需)' : '(可选)'
        const enumInfo = p.enum ? ` 可选值: ${p.enum.join(', ')}` : ''
        return `  - ${p.name} (${p.type}) ${required}: ${p.description}${enumInfo}`
      }).join('\n')

      const examples = tool.examples && tool.examples.length > 0
        ? `\n  示例: ${tool.examples.join(', ')}`
        : ''

      return `
### ${tool.name}
${tool.description}
${tool.category ? `分类: ${tool.category}` : ''}
参数:
${params}${examples}`
    }).join('\n')

    return `
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

${toolDescriptions}

## 工具使用规则

1. 当用户的请求需要使用工具时，先输出你的思考过程
2. 然后使用 \`\`\`tool 代码块调用工具
3. 等待工具执行结果后，再给出最终回复
4. 一次只能调用一个工具
5. 如果需要多个工具，请分步骤调用

## 示例对话

用户: 帮我搜索一个开心的表情包
助手: 好的，我来帮你搜索开心的表情包。

\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
\`\`\`

[等待工具结果...]

助手: 我找到了 5 个开心的表情包：[列出结果]
`
  }

  /**
   * 从 LLM 回复中提取工具调用
   */
  extractToolCall(llmResponse: string): PetToolCall | null {
    // 匹配 ```tool ... ``` 代码块
    const toolBlockRegex = /```tool\s*\n([\s\S]*?)\n```/
    const match = llmResponse.match(toolBlockRegex)

    if (!match) {
      return null
    }

    try {
      const toolCall = JSON.parse(match[1])

      if (!toolCall.tool || typeof toolCall.tool !== 'string') {
        throw new Error('Invalid tool call: missing tool name')
      }

      return {
        tool: toolCall.tool,
        args: toolCall.args || {}
      }
    } catch (error) {
      console.error('[PetToolManager] Failed to parse tool call:', error)
      return null
    }
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(toolCall: PetToolCall): Promise<PetToolResult> {
    try {
      console.log(`[PetToolManager] Executing tool: ${toolCall.tool}`, toolCall.args)

      const result = await toolManager.callTool(toolCall.tool, toolCall.args)

      if (result.success) {
        return {
          success: true,
          result: result.result,
          toolName: toolCall.tool
        }
      } else {
        return {
          success: false,
          error: result.error,
          toolName: toolCall.tool
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: toolCall.tool
      }
    }
  }

  /**
   * 格式化工具结果为文本
   * 用于注入回 LLM 的上下文
   */
  formatToolResult(result: PetToolResult): string {
    if (result.success) {
      return `
[工具执行结果]
工具: ${result.toolName}
状态: 成功
结果: ${JSON.stringify(result.result, null, 2)}
`
    } else {
      return `
[工具执行结果]
工具: ${result.toolName}
状态: 失败
错误: ${result.error}
`
    }
  }

  /**
   * 获取工具统计信息
   */
  getToolStats() {
    const tools = toolManager.getTools()
    const byCategory = new Map<string, number>()
    const byPlugin = new Map<string, number>()

    tools.forEach(tool => {
      if (tool.category) {
        byCategory.set(tool.category, (byCategory.get(tool.category) || 0) + 1)
      }
      byPlugin.set(tool.pluginId, (byPlugin.get(tool.pluginId) || 0) + 1)
    })

    return {
      total: tools.length,
      byCategory: Object.fromEntries(byCategory),
      byPlugin: Object.fromEntries(byPlugin),
      tools: tools.map(t => ({
        name: t.name,
        category: t.category,
        plugin: t.pluginId
      }))
    }
  }

  /**
   * 获取简化的工具列表（用于 UI 显示）
   */
  getToolList(): Array<{
    name: string
    description: string
    category?: string
    plugin: string
    paramCount: number
  }> {
    return toolManager.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      plugin: tool.pluginId,
      paramCount: tool.parameters.length
    }))
  }

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName: string): boolean {
    return toolManager.getTool(toolName) !== undefined
  }

  /**
   * 获取工具详情
   */
  getToolDetail(toolName: string): ToolDefinition | undefined {
    return toolManager.getTool(toolName)
  }

  /**
   * 生成 Markdown 格式的工具文档
   */
  generateToolDocumentation(): string {
    const tools = toolManager.getTools()

    if (tools.length === 0) {
      return '# 工具列表\n\n暂无可用工具。'
    }

    const byCategory = new Map<string, ToolDefinition[]>()

    tools.forEach(tool => {
      const category = tool.category || '其他'
      if (!byCategory.has(category)) {
        byCategory.set(category, [])
      }
      byCategory.get(category)!.push(tool)
    })

    let doc = '# 可用工具列表\n\n'
    doc += `共 ${tools.length} 个工具\n\n`

    byCategory.forEach((tools, category) => {
      doc += `## ${category}\n\n`

      tools.forEach(tool => {
        doc += `### ${tool.name}\n\n`
        doc += `**描述**: ${tool.description}\n\n`
        doc += `**插件**: ${tool.pluginId}\n\n`

        if (tool.parameters.length > 0) {
          doc += '**参数**:\n\n'
          tool.parameters.forEach(p => {
            const required = p.required ? '**必需**' : '可选'
            doc += `- \`${p.name}\` (${p.type}) - ${required}: ${p.description}\n`
            if (p.enum) {
              doc += `  - 可选值: ${p.enum.map(v => `\`${v}\``).join(', ')}\n`
            }
          })
          doc += '\n'
        }

        if (tool.examples && tool.examples.length > 0) {
          doc += '**示例**:\n\n'
          tool.examples.forEach(ex => {
            doc += `\`\`\`\n${ex}\n\`\`\`\n\n`
          })
        }

        doc += '---\n\n'
      })
    })

    return doc
  }
}

// 全局实例
export const petToolManager = new PetToolManager()
