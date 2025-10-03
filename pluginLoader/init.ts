/**
 * 插件系统初始化
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'
import { pluginLoader } from './core/pluginLoader'
import { petToolManager } from './core/petToolManager'

/**
 * 初始化插件系统
 */
export async function initializePluginSystem(app: App, router: Router): Promise<void> {
  try {
    console.log('[PluginSystem] 正在初始化...')
    
    // 初始化插件加载器
    await pluginLoader.initialize(app, router)
    
    // 暴露到全局对象，供UI组件使用
    ;(window as any).__pluginLoader = pluginLoader
    ;(window as any).__petToolManager = petToolManager
    
    // 自动加载已启用的插件
    const enabledPlugins = await getEnabledPlugins()
    if (enabledPlugins.length > 0) {
      console.log(`[PluginSystem] 加载 ${enabledPlugins.length} 个已启用的插件`)
      await pluginLoader.loadPlugins(enabledPlugins)
    }
    
    // 输出工具统计
    const stats = petToolManager.getToolStats()
    if (stats.total > 0) {
      console.log(`[PluginSystem] 已加载 ${stats.total} 个工具供桌宠使用`)
    }
    
    console.log('[PluginSystem] 初始化完成')
  } catch (error) {
    console.error('[PluginSystem] 初始化失败:', error)
  }
}

/**
 * 获取已启用的插件列表
 */
async function getEnabledPlugins(): Promise<string[]> {
  try {
    // 从Tauri Store读取已启用的插件列表
    const { load } = await import('@tauri-apps/plugin-store')
    const store = await load('plugins.json')
    const enabled = await store.get<string[]>('enabled_plugins')
    return enabled || []
  } catch (error) {
    console.warn('[PluginSystem] Failed to load enabled plugins:', error)
    return []
  }
}

/**
 * 获取桌宠工具提示词
 * 供桌宠 LLM 的系统提示词使用
 */
export function getPetToolPrompt(): string {
  return petToolManager.generateToolPrompt()
}

/**
 * 从 LLM 响应中提取工具调用
 */
export function extractToolCallFromResponse(response: string) {
  return petToolManager.extractToolCall(response)
}

/**
 * 执行工具调用
 * 供桌宠 LLM 使用
 */
export async function executePetToolCall(toolName: string, args: Record<string, any>) {
  return petToolManager.executeToolCall({ tool: toolName, args })
}

/**
 * 获取工具列表
 */
export function getPetToolList() {
  return petToolManager.getToolList()
}

/**
 * 获取工具文档
 */
export function getPetToolDocumentation(): string {
  return petToolManager.generateToolDocumentation()
}
