/**
 * B站表情包插件注册脚本 v3.0
 * 用于将插件注册到主程序
 * 
 * 功能：
 * - 加载和卸载插件
 * - 提供插件状态信息
 * - 支持命令行直接运行
 */

import { pluginLoader } from '../../core/pluginLoader'

/**
 * 注册插件
 * @returns 插件信息
 */
export async function registerBilibiliEmojiPlugin() {
  try {
    console.log('[BilibiliEmoji] 正在注册插件...')
    
    // 加载插件
    const success = await pluginLoader.loadPlugin('bilibili-emoji')
    
    if (success) {
      console.log('[BilibiliEmoji] ✅ 插件注册成功')
      
      // 返回插件信息
      return {
        name: 'bilibili-emoji',
        version: '3.0.0',
        status: 'loaded',
        features: [
          'Normal装扮下载',
          'DLC装扮下载',
          '智能表情包提取',
          'LLM工具集成'
        ]
      }
    } else {
      throw new Error('插件加载失败')
    }
  } catch (error) {
    console.error('[BilibiliEmoji] ❌ 插件注册失败:', error)
    throw error
  }
}

/**
 * 卸载插件
 * @returns 是否成功卸载
 */
export async function unregisterBilibiliEmojiPlugin() {
  try {
    console.log('[BilibiliEmoji] 正在卸载插件...')
    
    const success = await pluginLoader.unloadPlugin('bilibili-emoji')
    
    if (success) {
      console.log('[BilibiliEmoji] ✅ 插件卸载成功')
      return true
    } else {
      throw new Error('插件卸载失败')
    }
  } catch (error) {
    console.error('[BilibiliEmoji] ❌ 插件卸载失败:', error)
    throw error
  }
}

/**
 * 获取插件状态
 * @returns 插件是否已加载
 */
export function isPluginLoaded(): boolean {
  const loadedPlugins = pluginLoader.getLoadedPlugins()
  return loadedPlugins.some(plugin => plugin.name === 'bilibili-emoji')
}

// 如果直接运行此脚本，则自动注册
if (require.main === module) {
  registerBilibiliEmojiPlugin()
    .then((info) => {
      console.log('✅ 插件注册完成:', info)
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 插件注册失败:', error)
      process.exit(1)
    })
}
