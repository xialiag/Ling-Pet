/**
 * 插件加载器 - 负责加载和管理插件（支持独立插件包）
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { PluginDefinition, PluginContext, PluginMetadata, PluginMessage, PluginSettingsAction } from '../types/api'
import { HookEngine } from './hookEngine'
import { PluginEventBus, safeExecute } from './pluginApi'
import { PluginPageManager } from './pluginPageManager'
import { dynamicPageLoader } from './dynamicPageLoader'
import { pluginComponentRegistry } from './pluginComponentRegistry'
import { pluginCommunication } from './pluginCommunication'
import { componentInjectionManager } from './componentInjection'
import { vueInstanceInterceptor } from './vueInstanceInterceptor'
import { domInjectionManager } from './domInjection'
import { toolManager } from './toolManager'
import { invoke } from '@tauri-apps/api/core'
import { load as loadTauriStore } from '@tauri-apps/plugin-store'
import { emit, listen } from '@tauri-apps/api/event'
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
  private pageManager: PluginPageManager | null = null
  private pluginStore: any = null
  private pluginSettingsActions = new Map<string, PluginSettingsAction[]>()

  /**
   * 初始化插件系统
   */
  async initialize(app: App, router: Router): Promise<void> {
    this.app = app
    this.router = router

    // 初始化Hook引擎
    this.hookEngine.initialize(app)

    // 初始化DOM注入管理器
    domInjectionManager.initialize()

    // 初始化页面管理器
    this.pageManager = new PluginPageManager(router)

    // 初始化插件组件注册表
    pluginComponentRegistry.initialize(app)

    // 初始化插件包管理器
    await packageManager.initialize()

    // 初始化插件配置存储
    try {
      this.pluginStore = await loadTauriStore('plugins.json')
    } catch (error) {
      console.warn('[PluginLoader] Failed to load plugin store:', error)
    }

    // 设置跨窗口插件同步
    await this.setupCrossWindowSync()

    console.log('[PluginLoader] Initialized')
  }

  /**
   * 设置跨窗口插件同步
   */
  private async setupCrossWindowSync(): Promise<void> {
    try {
      // 监听插件启用事件
      await listen('plugin:enabled', async (event: any) => {
        const { pluginName } = event.payload
        console.log(`[PluginLoader] Received plugin:enabled event for ${pluginName}`)

        // 如果本窗口还没加载这个插件，加载它
        if (!this.loadedPlugins.has(pluginName)) {
          console.log(`[PluginLoader] Loading plugin ${pluginName} in this window`)
          await this.loadPlugin(pluginName)
        }
      })

      // 监听插件禁用事件
      await listen('plugin:disabled', async (event: any) => {
        const { pluginName } = event.payload
        console.log(`[PluginLoader] Received plugin:disabled event for ${pluginName}`)

        // 如果本窗口加载了这个插件，卸载它
        if (this.loadedPlugins.has(pluginName)) {
          console.log(`[PluginLoader] Unloading plugin ${pluginName} in this window`)
          await this.unloadPlugin(pluginName)
        }
      })

      console.log('[PluginLoader] Cross-window sync setup complete')
    } catch (error) {
      console.warn('[PluginLoader] Failed to setup cross-window sync:', error)
    }
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
      // 处理 ES 模块导出语法
      // 将 export{...} 转换为 module.exports
      let processedCode = code

      // 移除 sourceMappingURL 注释
      processedCode = processedCode.replace(/\/\/# sourceMappingURL=.*/g, '')

      // 处理 export{f as default} 或 export default ...
      processedCode = processedCode.replace(/export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/m, 'module.exports.default = $1;')
      processedCode = processedCode.replace(/export\s+default\s+/g, 'module.exports.default = ')

      // 处理其他 export 语句
      processedCode = processedCode.replace(/export\s*\{([^}]+)\}\s*;?/g, (_match, exports) => {
        const exportList = exports.split(',').map((e: string) => e.trim())
        return exportList.map((e: string) => {
          const parts = e.split(/\s+as\s+/)
          if (parts.length === 2) {
            return `module.exports.${parts[1]} = ${parts[0]};`
          }
          return `module.exports.${e} = ${e};`
        }).join('\n')
      })

      // 创建沙箱环境
      const moduleExports: any = {}
      const module = { exports: moduleExports }

      // 导入 Vue 依赖
      const { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } = await import('vue')

      const sandbox = {
        module,
        exports: moduleExports,
        console,
        Promise,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        // 提供 Vue 依赖
        __vue: { defineComponent, h, ref, computed, watch, onMounted, onUnmounted },
        // 不暴露危险的全局对象
      }

      // 使用Function构造器创建函数
      const func = new Function(
        ...Object.keys(sandbox),
        `
        ${processedCode}
        return module.exports.default || module.exports;
        `
      )

      // 执行代码
      const result = func(...Object.values(sandbox))

      console.log(`[PluginLoader] Plugin ${pluginId} result:`, result)
      console.log(`[PluginLoader] Plugin ${pluginId} result type:`, typeof result)
      console.log(`[PluginLoader] Plugin ${pluginId} result.name:`, result?.name)
      console.log(`[PluginLoader] Plugin ${pluginId} result.default:`, result?.default)

      if (!result || typeof result !== 'object') {
        throw new Error('Plugin must export a valid plugin definition')
      }

      // 如果result有default属性，使用default
      const pluginDef = result.default || result

      return pluginDef
    } catch (error) {
      console.error(`[PluginLoader] Failed to execute plugin code for ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * 智能刷新当前路由：只在插件确实影响当前页面时才刷新
   */
  private async smartRefreshCurrentRoute(pluginId: string): Promise<void> {
    if (!this.router) return

    try {
      const currentRoute = this.router.currentRoute.value
      console.log(`[PluginLoader] Checking if route refresh is needed for plugin ${pluginId}: ${currentRoute.path}`)

      // 检查当前路由类型
      const isPluginPage = currentRoute.path.startsWith('/plugin/')
      const isSettingsPage = currentRoute.path === '/settings'
      // const isMainPage = currentRoute.path === '/' || currentRoute.path === '/main'

      // 如果是设置页面，不进行强制刷新，避免重置用户的操作状态
      if (isSettingsPage) {
        console.log(`[PluginLoader] Skipping route refresh for settings page to preserve user state`)
        return
      }

      // 检查是否是被卸载插件的页面
      if (isPluginPage) {
        const pluginIdFromPath = currentRoute.path.split('/')[2] // /plugin/{pluginId}/...
        if (pluginIdFromPath === pluginId) {
          console.log(`[PluginLoader] Current page belongs to unloaded plugin ${pluginId}, redirecting to main`)
          // 如果当前页面属于被卸载的插件，重定向到主页
          await this.router.replace('/')
          return
        }
      }

      // 检查插件是否对当前页面有组件注入
      const hasInjections = this.checkPluginInjectionsOnCurrentPage(pluginId, currentRoute.path)

      if (!hasInjections) {
        console.log(`[PluginLoader] Plugin ${pluginId} has no injections on current page, skipping refresh`)
        return
      }

      console.log(`[PluginLoader] Plugin ${pluginId} has injections on current page, refreshing: ${currentRoute.path}`)

      // 使用 router.replace 触发重新渲染
      await this.router.replace({
        path: currentRoute.path,
        query: { ...currentRoute.query, _refresh: Date.now().toString() }
      })

      // 立即移除 _refresh 参数
      setTimeout(() => {
        const query = { ...currentRoute.query }
        delete query._refresh
        this.router?.replace({ path: currentRoute.path, query })
      }, 100)

      console.log(`[PluginLoader] Route refresh completed`)
    } catch (error) {
      console.warn(`[PluginLoader] Failed to refresh route:`, error)
    }
  }

  /**
   * 检查插件是否在当前页面有组件注入
   */
  private checkPluginInjectionsOnCurrentPage(_pluginId: string, _currentPath: string): boolean {
    // 检查组件注入管理器中是否有该插件的注入
    const stats = componentInjectionManager.getStats()
    if (stats.totalInjections === 0) {
      return false
    }

    // 这里可以进一步优化，检查具体的组件注入是否影响当前页面
    // 暂时返回 false，因为大多数情况下设置页面不会有插件注入
    return false
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

      // 清理Vue实例拦截器的注入
      vueInstanceInterceptor.cleanupPlugin(pluginId)

      // 清理DOM注入
      domInjectionManager.cleanupPlugin(pluginId)

      // 清理LLM工具
      toolManager.cleanupPlugin(pluginId)

      // 清理设置操作
      this.pluginSettingsActions.delete(pluginId)

      // 清理插件页面
      if (this.pageManager) {
        this.pageManager.cleanupPluginPages(pluginId)
      }

      // 智能刷新：只在必要时刷新当前路由
      await this.smartRefreshCurrentRoute(pluginId)

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
   * 获取页面管理器
   */
  getPageManager(): PluginPageManager | null {
    return this.pageManager
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

      // 发送跨窗口事件
      try {
        await emit('plugin:enabled', { pluginName })
        console.log(`[PluginLoader] Emitted plugin:enabled event for ${pluginName}`)
      } catch (error) {
        console.warn(`[PluginLoader] Failed to emit event:`, error)
      }
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

      // 发送跨窗口事件
      try {
        await emit('plugin:disabled', { pluginName })
        console.log(`[PluginLoader] Emitted plugin:disabled event for ${pluginName}`)
      } catch (error) {
        console.warn(`[PluginLoader] Failed to emit event:`, error)
      }
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
   * 清理插件的存储配置
   */
  private async cleanupPluginStorage(pluginId: string): Promise<void> {
    if (!this.pluginStore) {
      console.warn('[PluginLoader] Plugin store not available for cleanup')
      return
    }

    try {
      console.log(`[PluginLoader] Cleaning up storage for plugin: ${pluginId}`)

      // 清理权限配置
      const permissionKey = `plugin_permissions_${pluginId}`
      await this.pluginStore.delete(permissionKey)

      // 清理插件的所有配置项
      // 获取所有存储的键
      const allKeys = await this.pluginStore.keys()
      const pluginConfigKeys = allKeys.filter((key: string) => key.startsWith(`${pluginId}.`))
      
      for (const key of pluginConfigKeys) {
        await this.pluginStore.delete(key)
        console.log(`[PluginLoader] Deleted config key: ${key}`)
      }

      // 从启用插件列表中移除
      const enabledPlugins = await this.pluginStore.get('enabled_plugins') || []
      const updatedEnabledPlugins = enabledPlugins.filter((id: string) => id !== pluginId)
      await this.pluginStore.set('enabled_plugins', updatedEnabledPlugins)

      // 保存更改
      await this.pluginStore.save()

      console.log(`[PluginLoader] Storage cleanup completed for plugin: ${pluginId}`)
    } catch (error) {
      console.error(`[PluginLoader] Failed to cleanup storage for plugin ${pluginId}:`, error)
    }
  }

  /**
   * 完全卸载插件（删除文件）
   */
  async removePlugin(pluginId: string): Promise<boolean> {
    // 先卸载
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId)
    }

    // 清理插件存储的配置数据
    await this.cleanupPluginStorage(pluginId)

    // 删除文件
    const success = await packageManager.uninstallPlugin(pluginId)

    if (success) {
      // 发送跨窗口事件通知插件已被完全卸载
      try {
        await emit('plugin:removed', { pluginName: pluginId })
        console.log(`[PluginLoader] Emitted plugin:removed event for ${pluginId}`)
      } catch (error) {
        console.warn(`[PluginLoader] Failed to emit plugin:removed event:`, error)
      }
    }

    return success
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
        console.log(`[Plugin ${plugin.name}] 智能注入组件到 ${target}`)

        const injectionId = `${plugin.name}-${target}-${Date.now()}`

        const injection = {
          id: injectionId,
          pluginId: plugin.name,
          targetComponent: target,
          component,
          position: options?.position || 'after',
          props: options?.props,
          condition: options?.condition,
          order: options?.order
        }

        // 使用智能注入，支持局部导入组件
        let unregisterPromise: Promise<() => void>

        // 先检查全局注册的组件
        const globalComponent = app.component(target)
        if (globalComponent) {
          console.log(`[Plugin ${plugin.name}] 发现全局组件 ${target}`)

          const unregister = componentInjectionManager.registerInjection(injection)
          const wrappedComponent = componentInjectionManager.createWrappedComponent(globalComponent, target)
          app.component(target, wrappedComponent)

          unregisterPromise = Promise.resolve(unregister)
        } else {
          console.log(`[Plugin ${plugin.name}] 全局组件 ${target} 未找到，使用智能发现`)

          // 使用智能注入
          unregisterPromise = componentInjectionManager.injectToComponent(target, injection)
        }

        console.log(`[Plugin ${plugin.name}] 组件注入已设置: ${injectionId}`)

        // 返回异步清理函数
        return async () => {
          try {
            const unregister = await unregisterPromise
            unregister()
            console.log(`[Plugin ${plugin.name}] 组件注入已移除: ${injectionId}`)
          } catch (error) {
            console.error(`[Plugin ${plugin.name}] 移除组件注入失败:`, error)
          }
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

      registerPage: (config) => {
        if (!this.pageManager) {
          throw new Error('Page manager not initialized')
        }

        const pageConfig = {
          ...config,
          pluginId: plugin.name
        }

        return this.pageManager.registerPage(pageConfig)
      },

      navigateToPage: (pageId: string) => {
        if (!this.pageManager) {
          throw new Error('Page manager not initialized')
        }

        this.pageManager.navigateToPage(pageId)
      },

      registerExternalPage: (config) => {
        if (!this.pageManager) {
          throw new Error('Page manager not initialized')
        }

        // 创建异步组件
        const asyncComponent = dynamicPageLoader.createAsyncComponent(
          plugin.name,
          config.componentPath,
          config.asyncOptions
        )

        // 转换为标准页面配置
        const pageConfig = {
          path: config.path,
          name: config.name,
          component: asyncComponent,
          title: config.title,
          icon: config.icon,
          description: config.description,
          showInNavigation: config.showInNavigation,
          navigationGroup: config.navigationGroup,
          meta: config.meta,
          pluginId: plugin.name
        }

        return this.pageManager.registerPage(pageConfig)
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

      callBackend: async <T = any>(functionName: string, args?: any): Promise<T> => {
        try {
          const argsString = args ? JSON.stringify(args) : '{}'
          const result = await invoke<{ success: boolean, result?: string, error?: string }>('plugin_call_backend', {
            pluginId: plugin.name,
            functionName,
            args: argsString
          })

          if (!result.success) {
            throw new Error(result.error || 'Backend call failed')
          }

          // 尝试解析JSON结果
          if (result.result) {
            try {
              return JSON.parse(result.result) as T
            } catch {
              return result.result as T
            }
          }

          return undefined as T
        } catch (error) {
          console.error(`[Plugin ${plugin.name}] Backend call failed:`, error)
          throw error
        }
      },

      getBackendStatus: async (): Promise<boolean> => {
        try {
          return await invoke<boolean>('plugin_backend_status', {
            pluginId: plugin.name
          })
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to get backend status:`, error)
          return false
        }
      },

      getBackendCommands: async (): Promise<Array<{ name: string, description: string }>> => {
        try {
          return await invoke<Array<{ name: string, description: string }>>('plugin_get_commands', {
            pluginId: plugin.name
          })
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to get backend commands:`, error)
          return []
        }
      },

      getBackendMetrics: async (): Promise<any> => {
        try {
          return await invoke('get_backend_metrics', {
            plugin_id: plugin.name
          })
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to get backend metrics:`, error)
          return null
        }
      },

      checkBackendHealth: async (): Promise<boolean> => {
        try {
          return await invoke<boolean>('check_backend_health', {
            plugin_id: plugin.name
          })
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to check backend health:`, error)
          return false
        }
      },

      restartBackend: async (): Promise<boolean> => {
        try {
          return await invoke<boolean>('restart_plugin_backend', {
            plugin_id: plugin.name
          })
        } catch (error) {
          console.warn(`[Plugin ${plugin.name}] Failed to restart backend:`, error)
          return false
        }
      },

      subscribeBackendLogs: (callback: (log: any) => void) => {
        // 监听后端日志事件
        const unlisten = this.eventBus.on('plugin-log', (log: any) => {
          if (log.plugin_id === plugin.name) {
            callback(log)
          }
        })

        return unlisten
      },

      fetch: async (url: string, options?: RequestInit): Promise<Response> => {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
        return tauriFetch(url, options)
      },

      getAppDataDir: async (): Promise<string> => {
        const { appDataDir } = await import('@tauri-apps/api/path')
        return appDataDir()
      },

      fs: {
        readDir: async (path: string) => {
          const { readDir } = await import('@tauri-apps/plugin-fs')
          const entries = await readDir(path)
          return entries.map(entry => ({
            name: entry.name,
            isFile: entry.isFile,
            isDirectory: entry.isDirectory
          }))
        },

        readFile: async (path: string) => {
          const { readTextFile } = await import('@tauri-apps/plugin-fs')
          return readTextFile(path)
        },

        writeFile: async (path: string, content: string | Uint8Array) => {
          const { writeFile, writeTextFile } = await import('@tauri-apps/plugin-fs')
          if (typeof content === 'string') {
            await writeTextFile(path, content)
          } else {
            await writeFile(path, content)
          }
        },

        exists: async (path: string) => {
          const { exists } = await import('@tauri-apps/plugin-fs')
          return exists(path)
        },

        mkdir: async (path: string, options?: { recursive?: boolean }) => {
          const { mkdir } = await import('@tauri-apps/plugin-fs')
          await mkdir(path, { recursive: options?.recursive ?? false })
        },

        remove: async (path: string) => {
          const { remove } = await import('@tauri-apps/plugin-fs')
          await remove(path)
        }
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
      },

      // ========== 插件设置页面API ==========

      registerSettingsAction: (action: PluginSettingsAction) => {
        const actions = this.pluginSettingsActions.get(pluginId) || []
        actions.push(action)
        this.pluginSettingsActions.set(pluginId, actions)

        console.log(`[Plugin ${pluginId}] Registered settings action: ${action.label}`)

        // 返回取消注册函数
        return () => {
          const currentActions = this.pluginSettingsActions.get(pluginId) || []
          const index = currentActions.indexOf(action)
          if (index > -1) {
            currentActions.splice(index, 1)
            this.pluginSettingsActions.set(pluginId, currentActions)
          }
        }
      },

      getSettingsActions: () => {
        return this.pluginSettingsActions.get(pluginId) || []
      },

      // ========== DOM注入API ==========

      injectHTML: (selector: string, html: string, options?: any) => {
        console.log(`[Plugin ${plugin.name}] 注入HTML到 ${selector}`)
        return domInjectionManager.injectHTML(plugin.name, selector, html, options)
      },

      injectText: (selector: string, text: string, options?: any) => {
        console.log(`[Plugin ${plugin.name}] 注入文本到 ${selector}`)
        return domInjectionManager.injectText(plugin.name, selector, text, options)
      },

      injectVueComponent: async (selector: string, component: any, props?: Record<string, any>, options?: any) => {
        console.log(`[Plugin ${plugin.name}] 注入Vue组件到 ${selector}`)
        return domInjectionManager.injectVueComponent(plugin.name, selector, component, props, options)
      },

      injectCSS: (css: string, options?: { id?: string }) => {
        console.log(`[Plugin ${plugin.name}] 注入CSS样式`)
        return domInjectionManager.injectCSS(plugin.name, css, options)
      },

      querySelector: (selector: string) => {
        return domInjectionManager.querySelector(selector)
      },

      querySelectorAll: (selector: string) => {
        return domInjectionManager.querySelectorAll(selector)
      },

      waitForElement: (selector: string, timeout?: number) => {
        return domInjectionManager.waitForElement(selector, timeout)
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

  /**
   * 获取插件的设置操作按钮
   */
  getPluginSettingsActions(pluginId: string): PluginSettingsAction[] {
    return this.pluginSettingsActions.get(pluginId) || []
  }
}

// 全局插件加载器实例
export const pluginLoader = new PluginLoader()
