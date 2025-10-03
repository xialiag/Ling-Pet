/**
 * 插件加载器使用示例
 */

import { EnhancedPluginLoader } from './core/enhancedPluginLoader';
import { RuntimeInjection } from './core/runtimeInjection';

/**
 * 主程序中初始化插件系统
 */
async function initializePluginSystem() {
  // 创建插件加载器
  const pluginLoader = new EnhancedPluginLoader();

  // 监听插件事件
  pluginLoader.on('plugin-loaded', (pluginId: string) => {
    console.log(`Plugin loaded: ${pluginId}`);
  });

  pluginLoader.on('plugin-unloaded', (pluginId: string) => {
    console.log(`Plugin unloaded: ${pluginId}`);
  });

  pluginLoader.on('plugin-reloaded', (pluginId: string) => {
    console.log(`Plugin reloaded: ${pluginId}`);
  });

  pluginLoader.on('component-registered', (pluginId: string, name: string, component: any) => {
    console.log(`Component registered: ${pluginId}/${name}`);
    // 在这里可以将组件注册到Vue等框架
  });

  pluginLoader.on('notification', (pluginId: string, message: string) => {
    console.log(`[${pluginId}] ${message}`);
    // 显示通知
  });

  // 初始化插件系统
  await pluginLoader.initialize();

  return pluginLoader;
}

/**
 * 在Electron渲染进程中注入插件
 */
async function injectPluginsToRenderer(window: any, pluginLoader: EnhancedPluginLoader) {
  const runtimeInjection = new RuntimeInjection();
  
  // 获取所有已加载的插件
  const plugins = Array.from(pluginLoader.getAllPlugins().keys());
  
  // 注入所有插件到渲染进程
  await runtimeInjection.injectAllPlugins(window, plugins);
}

/**
 * 手动加载插件
 */
async function loadPluginManually(pluginLoader: EnhancedPluginLoader, pluginId: string) {
  try {
    await pluginLoader.loadPlugin(pluginId);
    console.log(`Plugin ${pluginId} loaded successfully`);
  } catch (error) {
    console.error(`Failed to load plugin ${pluginId}:`, error);
  }
}

/**
 * 卸载插件
 */
async function unloadPlugin(pluginLoader: EnhancedPluginLoader, pluginId: string) {
  try {
    await pluginLoader.unloadPlugin(pluginId);
    console.log(`Plugin ${pluginId} unloaded successfully`);
  } catch (error) {
    console.error(`Failed to unload plugin ${pluginId}:`, error);
  }
}

/**
 * 获取插件信息
 */
function getPluginInfo(pluginLoader: EnhancedPluginLoader, pluginId: string) {
  const metadata = pluginLoader.getPluginMetadata(pluginId);
  const plugin = pluginLoader.getPlugin(pluginId);
  
  return {
    metadata,
    loaded: !!plugin,
    plugin
  };
}

/**
 * 调用插件的钩子
 */
async function triggerHook(pluginLoader: EnhancedPluginLoader, hookName: string, context: any) {
  const hookEngine = pluginLoader.getHookEngine();
  return await hookEngine.executeHook(hookName, context);
}

/**
 * 调用插件工具
 */
async function callPluginTool(pluginLoader: EnhancedPluginLoader, toolName: string, params: any) {
  const toolManager = pluginLoader.getToolManager();
  return await toolManager.executeTool(toolName, params);
}

/**
 * 清理插件系统
 */
async function cleanupPluginSystem(pluginLoader: EnhancedPluginLoader) {
  await pluginLoader.cleanup();
  console.log('Plugin system cleaned up');
}

// 导出示例函数
export {
  initializePluginSystem,
  injectPluginsToRenderer,
  loadPluginManually,
  unloadPlugin,
  getPluginInfo,
  triggerHook,
  callPluginTool,
  cleanupPluginSystem
};

// 完整使用示例
async function main() {
  // 1. 初始化插件系统
  const pluginLoader = await initializePluginSystem();

  // 2. 获取所有插件信息
  const allPlugins = pluginLoader.getAllMetadata();
  console.log('Loaded plugins:', Array.from(allPlugins.keys()));

  // 3. 触发钩子
  const result = await triggerHook(pluginLoader, 'message.send', {
    message: 'Hello, World!'
  });
  console.log('Hook result:', result);

  // 4. 调用工具
  try {
    const toolResult = await callPluginTool(pluginLoader, 'exampleTool', {
      input: 'test data'
    });
    console.log('Tool result:', toolResult);
  } catch (error) {
    console.error('Tool call failed:', error);
  }

  // 5. 在应用退出时清理
  process.on('SIGINT', async () => {
    await cleanupPluginSystem(pluginLoader);
    process.exit(0);
  });
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}
