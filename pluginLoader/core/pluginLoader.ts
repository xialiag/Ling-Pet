/**
 * 插件加载器 - 负责加载和管理插件（支持独立插件包）
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { PluginDefinition, PluginContext, PluginMetadata } from '../types/api'
import { HookEngine } from './hookEngine'
import { PluginEventBus, safeExecute } from './pluginApi'
import { invoke } from '@tauri-apps/api/core'
import { load as loadTauriStore } from '@tauri-apps/plugin-store'
import { packageManager, type PluginManifest } from './packageManager'

/**
 * 插件加载器
 */
export class PluginLoader {
  private app: App | null = null
  private router: Router | null = null
  private hookEngine = new HookEngine()
  private eventBus = new PluginEventBus()
  private loadedPlugins = new Map<string, PluginDefinition>()
  private pluginContexts = new Map<string, PluginContext>()
  private pluginStore: any = null
  
  /**
   * 初始化插件系统
   */
  async initialize(app: App, router: Router): Promise<void> {
    this.app = app
    this.router = router
    
    // 初始化Hook引擎
    this.hookEngine.initialize(app)
    
    // 初始化插件包管理器
    await packageManager.initialize()
    
    // 初始化插件配置存储
    try {
      this.pluginStore = await loadTauriStore('plugins.json')
    } catch (error) {
      console.warn('[PluginLoader] Failed to load plugin store:', error)
    }
    
    console.log('[PluginLoader] Initialized')
  }
  
  /**
   * 加载插件（支持独立插件包）
   */
  async loadPlugin(pluginId: string): Promise<boolean> {
    if (this.loadedPlugins.has(pluginId)) {
      console.warn(`[PluginLoader] Plugin ${pluginId} already loaded`)
      return false
    }
    
    try {
      console.log(`[PluginLoader] Loading plugin: ${pluginId}`)
      
      // 获取插件信息
      const installedPlugin = packageManager.getPlugin(pluginId)
      if (!installedPlugin) {
        throw new Error(`Plugin ${pluginId} not installed`)
      }
      
      const _manifest = installedPlugin.manifest
      
      // 检查权限
      if (!this.checkPermissions(_manifest)) {
        throw new Error(`Plugin ${pluginId} has insufficient permissions`)
      }
      
      // 检查依赖
      if (_manifest.dependencies) {
        for (const [dep, version] of Object.entries(_manifest.dependencies)) {
          if (!this.loadedPlugins.has(dep)) {
            throw new Error(`Missing dependency: ${dep}@${version}`)
          }
        }
      }
      
      // 加载Rust后端（如果有）
      if (_manifest.backend?.enabled) {
        await packageManager.loadBackend(pluginId)
      }
      
      // 读取插件入口文件
      const entryCode = await packageManager.readPluginFile(
        pluginId,
        _manifest.entry
      )
      
      // 动态执行插件代码
      const pluginDefinition = await this.executePluginCode(entryCode, pluginId)
      
      if (!pluginDefinition || !pluginDefinition.name) {
        throw new Error(`Invalid plugin definition for ${pluginId}`)
      }
      
      // 创建插件上下文
      const context = this.createPluginContext(pluginDefinition, _manifest)
      this.pluginContexts.set(pluginId, context)
      
      // 执行插件加载
      await safeExecute(
        () => pluginDefinition.onLoad(context),
        (error) => {
          console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error)
          throw error
        }
      )
      
      this.loadedPlugins.set(pluginId, pluginDefinition)
      packageManager.setPluginLoaded(pluginId, true)
      
      console.log(`[PluginLoader] Plugin ${pluginId} loaded successfully`)
      
      // 触发插件加载事件
      this.eventBus.emit('plugin:loaded', pluginId, pluginDefinition)
      
      return true
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error)
      return false
    }
  }
  
  /**
   * 动态执行插件代码
   */
  private async executePluginCode(code: string, pluginId: string): Promise<PluginDefinition> {
    try {
      // 简化实现：使用 eval 执行代码
      // 注意：这里假设插件代码已经是编译后的 ES5/ES6 代码
      const moduleExports: any = {}
      const module = { exports: moduleExports, default: null }
      
      // 创建执行上下文
      const contextCode = `
        (function(module, exports) {
          ${code}
          return module.exports.default || module.exports;
        })
      `
      
      // 执行代码
      const func = eval(contextCode)
      const result = func(module, moduleExports)
      
      return result
    } catch (error) {
      console.error(`[PluginLoader] Failed to execute plugin code for ${pluginId}:`, error)
      throw error
    }
  }
  
  /**
   * 检查插件权限
   */
  private checkPermissions(_manifest: PluginManifest): boolean {
    // TODO: 实现权限检查逻辑
    // 可以弹出对话框让用户确认权限
    return true
  }
  
  /**
   * 卸载插件（支持热卸载）
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId)
    if (!plugin) {
      console.warn(`[PluginLoader] Plugin ${pluginId} not loaded`)
      return false
    }
    
    try {
      const context = this.pluginContexts.get(pluginId)
      if (plugin.onUnload && context) {
        await safeExecute(() => plugin.onUnload!(context), (error) => {
          console.error(`[PluginLoader] Error during unload of ${pluginId}:`, error)
        })
      }
      
      // 卸载Rust后端
      const installedPlugin = packageManager.getPlugin(pluginId)
      if (installedPlugin?.manifest.backend?.enabled) {
        await packageManager.unloadBackend(pluginId)
      }
      
      this.loadedPlugins.delete(pluginId)
      this.pluginContexts.delete(pluginId)
      packageManager.setPluginLoaded(pluginId, false)
      
      console.log(`[PluginLoader] Plugin ${pluginId} unloaded`)
      this.eventBus.emit('plugin:unloaded', pluginId)
      
      return true
    } catch (error) {
      console.error(`[PluginLoader] Failed to unload plugin ${pluginId}:`, error)
      return false
    }
  }
  
  /**
   * 批量加载插件
   */
  async loadPlugins(pluginNames: string[]): Promise<void> {
    for (const name of pluginNames) {
      await this.loadPlugin(name)
    }
  }
  
  /**
   * 获取已加载的插件列表
   */
  getLoadedPlugins(): PluginMetadata[] {
    return Array.from(this.loadedPlugins.entries()).map(([_name, plugin]) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: true,
      loaded: true
    }))
  }
  
  /**
   * 获取所有插件信息（包括配置Schema）
   */
  getPlugins(): any[] {
    return Array.from(this.loadedPlugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: true,
      loaded: true,
      configSchema: plugin.configSchema
    }))
  }
  
  /**
   * 通知插件配置已更改
   */
  notifyConfigChange(pluginName: string, key: string, value: any): void {
    this.eventBus.emit('plugin:config:changed', pluginName, key, value)
  }
  
  /**
   * 启用插件
   */
  async enablePlugin(pluginName: string): Promise<boolean> {
    if (this.loadedPlugins.has(pluginName)) {
      return true // 已加载
    }
    return this.loadPlugin(pluginName)
  }
  
  /**
   * 禁用插件
   */
  async disablePlugin(pluginName: string): Promise<boolean> {
    return this.unloadPlugin(pluginName)
  }
  
  /**
   * 安装插件
   */
  async installPlugin(zipPath: string): Promise<boolean> {
    return packageManager.installPlugin(zipPath)
  }
  
  /**
   * 完全卸载插件（删除文件）
   */
  async removePlugin(pluginId: string): Promise<boolean> {
    // 先卸载
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId)
    }
    
    // 删除文件
    return packageManager.uninstallPlugin(pluginId)
  }
  
  /**
   * 获取所有已安装的插件
   */
  getAllPlugins(): any[] {
    const installed = packageManager.getInstalledPlugins()
    return installed.map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      author: p.manifest.author,
      enabled: p.enabled,
      loaded: p.loaded,
      configSchema: p.manifest.config
    }))
  }
  
  /**
   * 创建插件上下文
   */
  private createPluginContext(plugin: PluginDefinition, _manifest?: PluginManifest): PluginContext {
    if (!this.app || !this.router) {
      throw new Error('PluginLoader not initialized')
    }
    
    const app = this.app
    const router = this.router
    const hookEngine = this.hookEngine
    const pluginStore = this.pluginStore!
    
    const context: PluginContext = {
      app,
      router,
      
      getStore: (name: string) => {
        return (app.config.globalProperties.$pinia as any)?.state.value[name]
      },
      
      hookComponent: (componentName, hooks) => {
        return hookEngine.componentHooks.registerHook(componentName, hooks)
      },
      
      hookStore: (storeName, hooks) => {
        const unhook = hookEngine.storeHooks.registerHook(storeName, hooks)
        
        // 立即应用到已存在的store
        try {
          const store = (app.config.globalProperties.$pinia as any)?.state.value[storeName]
          if (store) {
            hookEngine.storeHooks.applyToStore(store, storeName)
          }
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to apply store hook:`, error)
        }
        
        return unhook
      },
      
      hookService: (servicePath, functionName, hooks) => {
        return hookEngine.serviceHooks.registerHook(servicePath, functionName, hooks)
      },
      
      injectComponent: (target, component, options) => {
        // 实现组件注入逻辑
        console.log(`[Plugin ${plugin.name}] Injecting component to ${target}`)
        
        // 注册注入的组件到全局
        const injectionId = `${plugin.name}-${target}-${Date.now()}`
        app.component(injectionId, component)
        
        // 使用teleport或动态渲染实现注入
        // 这里提供一个简化的实现，实际使用时可以通过hookComponent来实现更复杂的注入
        const injectionInfo = {
          id: injectionId,
          target,
          component,
          options: options || {}
        }
        
        // 存储注入信息供目标组件使用
        if (!(window as any).__pluginInjections) {
          ;(window as any).__pluginInjections = []
        }
        ;(window as any).__pluginInjections.push(injectionInfo)
        
        console.log(`[Plugin ${plugin.name}] Component injected: ${injectionId}`)
        
        // 返回取消注入函数
        return () => {
          const injections = (window as any).__pluginInjections as any[]
          const index = injections.findIndex(i => i.id === injectionId)
          if (index !== -1) {
            injections.splice(index, 1)
          }
          console.log(`[Plugin ${plugin.name}] Component injection removed: ${injectionId}`)
        }
      },
      
      wrapComponent: (componentName, wrapper) => {
        // 实现组件包装逻辑
        console.log(`[Plugin ${plugin.name}] Wrapping component ${componentName}`)
        
        // 获取原始组件
        const originalComponent = app.component(componentName)
        if (!originalComponent) {
          console.warn(`[Plugin ${plugin.name}] Component ${componentName} not found`)
          return () => {}
        }
        
        // 创建包装后的组件
        const wrappedComponent = wrapper(originalComponent, context)
        
        // 重新注册组件
        app.component(componentName, wrappedComponent)
        
        console.log(`[Plugin ${plugin.name}] Component wrapped: ${componentName}`)
        
        // 返回恢复函数
        return () => {
          app.component(componentName, originalComponent)
          console.log(`[Plugin ${plugin.name}] Component unwrapped: ${componentName}`)
        }
      },
      
      addRoute: (route) => {
        router.addRoute(route)
        console.log(`[Plugin ${plugin.name}] Added route: ${route.path}`)
      },
      
      debug: (...args) => {
        console.log(`[Plugin ${plugin.name}]`, ...args)
      },
      
      getConfig: <T = any>(key: string, defaultValue?: T): T => {
        const configKey = `${plugin.name}.${key}`
        if (!pluginStore) return defaultValue as T
        
        // 同步获取配置（简化实现）
        try {
          const value = (pluginStore as any).get(configKey)
          return value ?? defaultValue as T
        } catch {
          return defaultValue as T
        }
      },
      
      setConfig: async (key: string, value: any): Promise<void> => {
        const configKey = `${plugin.name}.${key}`
        await pluginStore.set(configKey, value)
        await pluginStore.save()
      },
      
      invokeTauri: async <T = any>(command: string, args?: Record<string, any>): Promise<T> => {
        return invoke<T>(command, args)
      }
    }
    
    return context
  }
  
  /**
   * 获取事件总线
   */
  getEventBus(): PluginEventBus {
    return this.eventBus
  }
  
  /**
   * 获取Hook引擎
   */
  getHookEngine(): HookEngine {
    return this.hookEngine
  }
}

// 全局插件加载器实例
export const pluginLoader = new PluginLoader()
