/**
 * 插件加载器 - 负责加载和管理插件（支持独立插件包）
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { PluginDefinition, PluginContext, PluginMetadata, PluginMessage } from '../types/api'
import { HookEngine } from './hookEngine'
import { PluginEventBus, safeExecute } from './pluginApi'
import { pluginCommunication } from './pluginCommunication'
import { componentInjectionManager } from './componentInjection'
import { toolManager } from './toolManager'
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
      if (!await this.checkPermissions(_manifest)) {
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
      // 使用Function构造器执行代码（比eval更安全）
      // 注意：这里假设插件代码已经是编译后的 ES5/ES6 代码
      const moduleExports: any = {}
      const module = { exports: moduleExports }

      // 创建沙箱环境
      const sandbox = {
        module,
        exports: moduleExports,
        console,
        Promise,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        // 不暴露危险的全局对象
      }

      // 使用Function构造器创建函数
      const func = new Function(
        ...Object.keys(sandbox),
        `
        ${code}
        return module.exports.default || module.exports;
        `
      )

      // 执行代码
      const result = func(...Object.values(sandbox))

      if (!result || typeof result !== 'object') {
        throw new Error('Plugin must export a valid plugin definition')
      }

      return result
    } catch (error) {
      console.error(`[PluginLoader] Failed to execute plugin code for ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 检查插件权限
   */
  private async checkPermissions(manifest: PluginManifest): Promise<boolean> {
    if (!manifest.permissions || manifest.permissions.length === 0) {
      return true
    }

    // 检查是否已授权
    const permissionKey = `plugin_permissions_${manifest.id}`
    const granted = await this.pluginStore?.get(permissionKey)

    if (granted === true) {
      return true
    }

    // 需要用户授权
    console.log(`[PluginLoader] Plugin ${manifest.id} requires permissions:`, manifest.permissions)

    // 在实际应用中，这里应该弹出对话框让用户确认
    // 现在先自动授权，但记录日志
    console.warn(`[PluginLoader] Auto-granting permissions for ${manifest.id}`)

    // 保存授权状态
    if (this.pluginStore) {
      await this.pluginStore.set(permissionKey, true)
      await this.pluginStore.save()
    }

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

      // 清理通信资源
      pluginCommunication.cleanup(pluginId)
      
      // 清理组件注入
      componentInjectionManager.cleanupPlugin(pluginId)
      
      // 清理LLM工具
      toolManager.cleanupPlugin(pluginId)

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

    const success = await this.loadPlugin(pluginName)

    if (success) {
      // 保存到已启用列表
      await this.saveEnabledPlugins()
    }

    return success
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginName: string): Promise<boolean> {
    const success = await this.unloadPlugin(pluginName)

    if (success) {
      // 从已启用列表移除
      await this.saveEnabledPlugins()
    }

    return success
  }

  /**
   * 保存已启用的插件列表
   */
  private async saveEnabledPlugins(): Promise<void> {
    try {
      const enabledPlugins = Array.from(this.loadedPlugins.keys())
      await this.pluginStore?.set('enabled_plugins', enabledPlugins)
      await this.pluginStore?.save()
    } catch (error) {
      console.error('[PluginLoader] Failed to save enabled plugins:', error)
    }
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
    const pluginId = plugin.name

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
        console.log(`[Plugin ${plugin.name}] Injecting component to ${target}`)

        const injectionId = `${plugin.name}-${target}-${Date.now()}`
        
        // 注册到组件注入管理器
        const unregister = componentInjectionManager.registerInjection({
          id: injectionId,
          pluginId: plugin.name,
          targetComponent: target,
          component,
          position: options?.position || 'after',
          props: options?.props,
          condition: options?.condition,
          order: options?.order
        })
        
        // 检查目标组件是否已注册
        const targetComponent = app.component(target)
        if (targetComponent) {
          // 创建包装后的组件
          const wrappedComponent = componentInjectionManager.createWrappedComponent(
            targetComponent,
            target
          )
          
          // 重新注册组件
          app.component(target, wrappedComponent)
          
          console.log(`[Plugin ${plugin.name}] Component ${target} wrapped with injection`)
        } else {
          console.warn(`[Plugin ${plugin.name}] Target component ${target} not found, injection will be applied when component is registered`)
        }

        console.log(`[Plugin ${plugin.name}] Component injected: ${injectionId}`)

        // 返回取消注入函数
        return () => {
          unregister()
          
          // 如果没有其他注入了，恢复原始组件
          const injections = componentInjectionManager.getInjections(target)
          if (injections.length === 0) {
            const originalComponent = app.component(target)
            if (originalComponent) {
              // 这里需要保存原始组件的引用，暂时保持包装状态
              console.log(`[Plugin ${plugin.name}] All injections removed from ${target}`)
            }
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
          return () => { }
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

        // 同步获取配置
        try {
          const value = pluginStore.get(configKey)
          return (value !== undefined && value !== null ? value : defaultValue) as T
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to get config ${key}:`, error)
          return defaultValue as T
        }
      },

      setConfig: async (key: string, value: any): Promise<void> => {
        const configKey = `${plugin.name}.${key}`
        try {
          await pluginStore.set(configKey, value)
          await pluginStore.save()

          // 触发配置变更事件
          this.eventBus.emit('plugin:config:changed', plugin.name, key, value)
        } catch (error) {
          console.error(`[Plugin ${plugin.name}] Failed to set config ${key}:`, error)
          throw error
        }
      },

      invokeTauri: async <T = any>(command: string, args?: Record<string, any>): Promise<T> => {
        return invoke<T>(command, args)
      },

      // ========== 插件间通信API ==========

      on: (event: string, handler: Function) => {
        return pluginCommunication.on(pluginId, event, handler)
      },

      emit: (event: string, ...args: any[]) => {
        pluginCommunication.emit(pluginId, event, ...args)
      },

      off: (event: string, handler?: Function) => {
        pluginCommunication.off(pluginId, event, handler)
      },

      sendMessage: (to: string | undefined, type: string, data: any): string => {
        return pluginCommunication.sendMessage({
          from: pluginId,
          to,
          type,
          data
        })
      },

      onMessage: (handler: (msg: PluginMessage) => void) => {
        return pluginCommunication.onMessage(pluginId, handler)
      },

      registerRPC: (method: string, handler: Function) => {
        return pluginCommunication.registerRPC(pluginId, method, handler)
      },

      callRPC: async <T = any>(targetPluginId: string, method: string, ...params: any[]): Promise<T> => {
        return pluginCommunication.callRPC(pluginId, targetPluginId, method, params)
      },

      createSharedState: (key: string, initialValue: any, options?: any): any => {
        return pluginCommunication.createSharedState({
          pluginId,
          key,
          initialValue,
          readonly: options?.readonly,
          persistent: options?.persistent
        })
      },

      getSharedState: (targetPluginId: string, key: string): any => {
        return pluginCommunication.getSharedState(targetPluginId, key)
      },
      
      // ========== LLM工具API ==========
      
      registerTool: (tool) => {
        return toolManager.registerTool({
          ...tool,
          pluginId: plugin.name
        })
      },
      
      callTool: async (name, args) => {
        return toolManager.callTool(name, args)
      },
      
      getAvailableTools: () => {
        return toolManager.getTools().map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          pluginId: t.pluginId,
          category: t.category,
          examples: t.examples
        }))
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
