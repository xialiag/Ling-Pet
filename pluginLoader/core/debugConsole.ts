/**
 * 插件调试控制台
 * 提供浏览器控制台调试插件的能力
 */

import { pluginLoader } from './pluginLoader'
import { toolManager } from './toolManager'
import { petToolManager } from './petToolManager'

/**
 * 插件调试工具
 */
export class PluginDebugConsole {
  /**
   * 列出所有已加载的插件
   */
  listPlugins() {
    const plugins = pluginLoader.getLoadedPlugins()
    console.table(plugins)
    return plugins
  }

  /**
   * 列出所有可用工具
   */
  listTools() {
    const tools = toolManager.getTools()
    console.table(tools.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      plugin: t.pluginId,
      params: t.parameters.length
    })))
    return tools
  }

  /**
   * 获取工具详情
   */
  getToolDetail(toolName: string) {
    const tool = toolManager.getTool(toolName)
    if (!tool) {
      console.error(`工具 ${toolName} 不存在`)
      return null
    }
    console.log('工具详情:', tool)
    console.log('\n参数:')
    console.table(tool.parameters)
    if (tool.examples) {
      console.log('\n示例:')
      tool.examples.forEach(ex => console.log(`  ${ex}`))
    }
    return tool
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: Record<string, any>) {
    console.log(`调用工具: ${toolName}`, args)
    const result = await toolManager.callTool(toolName, args)
    
    if (result.success) {
      console.log('✅ 成功:', result.result)
    } else {
      console.error('❌ 失败:', result.error)
    }
    
    console.log(`耗时: ${result.duration.toFixed(2)}ms`)
    return result
  }

  /**
   * 获取工具调用历史
   */
  getToolHistory(limit: number = 10) {
    const history = toolManager.getHistory(limit)
    console.table(history.map(h => ({
      tool: h.call.name,
      success: h.result.success ? '✅' : '❌',
      duration: `${h.result.duration.toFixed(2)}ms`,
      timestamp: new Date(h.call.timestamp).toLocaleTimeString()
    })))
    return history
  }

  /**
   * 获取工具统计
   */
  getToolStats() {
    const stats = toolManager.getStats()
    console.log('工具统计:', stats)
    return stats
  }

  /**
   * 获取桌宠工具提示词
   */
  getPetToolPrompt() {
    const prompt = petToolManager.generateToolPrompt()
    console.log(prompt)
    return prompt
  }

  /**
   * 获取桌宠工具列表
   */
  getPetToolList() {
    const tools = petToolManager.getToolList()
    console.table(tools)
    return tools
  }

  /**
   * 测试工具调用（模拟 LLM 调用）
   */
  async testToolCall(toolName: string, args: Record<string, any>) {
    console.log('🧪 测试工具调用')
    console.log('工具:', toolName)
    console.log('参数:', args)
    
    const result = await petToolManager.executeToolCall({
      tool: toolName,
      args
    })
    
    console.log('\n结果:')
    console.log(petToolManager.formatToolResult(result))
    
    return result
  }

  /**
   * 模拟 LLM 工具调用流程
   */
  async simulateLLMToolCall(llmResponse: string) {
    console.log('🤖 模拟 LLM 工具调用')
    console.log('LLM 响应:', llmResponse)
    
    // 提取工具调用
    const toolCall = petToolManager.extractToolCall(llmResponse)
    
    if (!toolCall) {
      console.log('❌ 未检测到工具调用')
      return null
    }
    
    console.log('\n✅ 检测到工具调用:')
    console.log('工具:', toolCall.tool)
    console.log('参数:', toolCall.args)
    
    // 执行工具
    console.log('\n⚙️ 执行工具...')
    const result = await petToolManager.executeToolCall(toolCall)
    
    console.log('\n📊 执行结果:')
    console.log(petToolManager.formatToolResult(result))
    
    return result
  }

  /**
   * 加载插件
   */
  async loadPlugin(pluginId: string) {
    console.log(`加载插件: ${pluginId}`)
    const success = await pluginLoader.loadPlugin(pluginId)
    if (success) {
      console.log('✅ 插件加载成功')
    } else {
      console.error('❌ 插件加载失败')
    }
    return success
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string) {
    console.log(`卸载插件: ${pluginId}`)
    const success = await pluginLoader.unloadPlugin(pluginId)
    if (success) {
      console.log('✅ 插件卸载成功')
    } else {
      console.error('❌ 插件卸载失败')
    }
    return success
  }

  /**
   * 重新加载插件
   */
  async reloadPlugin(pluginId: string) {
    console.log(`重新加载插件: ${pluginId}`)
    await this.unloadPlugin(pluginId)
    await new Promise(resolve => setTimeout(resolve, 100))
    return await this.loadPlugin(pluginId)
  }

  /**
   * 获取插件信息
   */
  getPluginInfo(pluginId: string) {
    const plugins = pluginLoader.getAllPlugins()
    const plugin = plugins.find(p => p.id === pluginId || p.name === pluginId)
    
    if (!plugin) {
      console.error(`插件 ${pluginId} 不存在`)
      return null
    }
    
    console.log('插件信息:', plugin)
    return plugin
  }

  /**
   * 显示帮助信息
   */
  help() {
    console.log(`
🔧 插件调试控制台

📦 插件管理:
  debug.listPlugins()                    - 列出所有插件
  debug.getPluginInfo('plugin-id')       - 获取插件信息
  debug.loadPlugin('plugin-id')          - 加载插件
  debug.unloadPlugin('plugin-id')        - 卸载插件
  debug.reloadPlugin('plugin-id')        - 重新加载插件

🛠️ 工具管理:
  debug.listTools()                      - 列出所有工具
  debug.getToolDetail('tool-name')       - 获取工具详情
  debug.callTool('tool-name', {...})     - 调用工具
  debug.getToolHistory(10)               - 获取调用历史
  debug.getToolStats()                   - 获取统计信息

🤖 桌宠工具:
  debug.getPetToolPrompt()               - 获取工具提示词
  debug.getPetToolList()                 - 获取工具列表
  debug.testToolCall('tool', {...})      - 测试工具调用
  debug.simulateLLMToolCall(response)    - 模拟 LLM 调用

💡 示例:
  // 列出所有工具
  debug.listTools()
  
  // 调用表情包搜索工具
  debug.callTool('search_local_emoji', { query: '开心', limit: 5 })
  
  // 模拟 LLM 工具调用
  debug.simulateLLMToolCall(\`
    \\\`\\\`\\\`tool
    {
      "tool": "search_local_emoji",
      "args": { "query": "开心" }
    }
    \\\`\\\`\\\`
  \`)
  
  // 重新加载插件
  debug.reloadPlugin('bilibili-emoji')
`)
  }
}

// 创建全局实例
export const debugConsole = new PluginDebugConsole()

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as any).debug = debugConsole
  console.log('🔧 插件调试控制台已就绪，输入 debug.help() 查看帮助')
}
