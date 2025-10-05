/**
 * 插件页面管理器
 * 负责管理插件注册的页面路由和导航
 */

import type { Router, RouteRecordRaw } from 'vue-router'
import type { Component } from 'vue'
import type { PluginPageConfig as BasePluginPageConfig } from '../types/api'

export interface PluginPageConfig extends BasePluginPageConfig {
  /** 插件ID */
  pluginId: string
}

export interface PluginNavigationItem {
  id: string
  pluginId: string
  title: string
  path: string
  icon?: string
  description?: string
  group?: string
  order?: number
}

export class PluginPageManager {
  private router: Router
  private registeredPages = new Map<string, PluginPageConfig>()
  private navigationItems: PluginNavigationItem[] = []
  private navigationChangeCallbacks = new Set<(items: PluginNavigationItem[]) => void>()

  constructor(router: Router) {
    this.router = router
  }

  /**
   * 注册插件页面
   */
  registerPage(config: PluginPageConfig): () => void {
    const pageId = `${config.pluginId}-${config.name || config.path.replace(/[^a-zA-Z0-9]/g, '-')}`

    // 确保路径以插件ID为前缀，避免冲突
    const fullPath = config.path.startsWith('/')
      ? `/plugin/${config.pluginId}${config.path}`
      : `/plugin/${config.pluginId}/${config.path}`

    // 创建包装后的组件
    const wrappedComponent = this.createWrappedComponent(config)

    const routeConfig: RouteRecordRaw = {
      path: fullPath,
      name: config.name || pageId,
      component: wrappedComponent,
      meta: {
        ...config.meta,
        pluginId: config.pluginId,
        pluginPage: true,
        title: config.title,
        icon: config.icon,
        description: config.description,
        containerConfig: config.container
      }
    }

    // 添加路由
    this.router.addRoute(routeConfig)

    // 保存页面配置
    const pageConfig: PluginPageConfig = {
      ...config,
      path: fullPath
    }
    this.registeredPages.set(pageId, pageConfig)

    // 添加到导航（如果需要）
    if (config.showInNavigation !== false) {
      const navItem: PluginNavigationItem = {
        id: pageId,
        pluginId: config.pluginId,
        title: config.title || config.name || config.path,
        path: fullPath,
        icon: config.icon,
        description: config.description,
        group: config.navigationGroup || 'plugins'
      }

      this.navigationItems.push(navItem)
      this.notifyNavigationChange()
    }

    console.log(`[PluginPageManager] Registered page: ${fullPath} for plugin ${config.pluginId}`)

    // 返回清理函数
    return () => {
      this.unregisterPage(pageId)
    }
  }

  /**
   * 注销插件页面
   */
  private unregisterPage(pageId: string): void {
    const config = this.registeredPages.get(pageId)
    if (!config) return

    // 移除路由（Vue Router 3.x 不支持动态移除，但我们可以标记为无效）
    // 在实际应用中，路由会在插件卸载时自动失效

    // 移除页面配置
    this.registeredPages.delete(pageId)

    // 移除导航项
    const navIndex = this.navigationItems.findIndex(item => item.id === pageId)
    if (navIndex !== -1) {
      this.navigationItems.splice(navIndex, 1)
      this.notifyNavigationChange()
    }

    console.log(`[PluginPageManager] Unregistered page: ${pageId}`)
  }

  /**
   * 获取插件页面列表
   */
  getPluginPages(pluginId?: string): PluginPageConfig[] {
    const pages = Array.from(this.registeredPages.values())
    return pluginId ? pages.filter(page => page.pluginId === pluginId) : pages
  }

  /**
   * 获取导航项列表
   */
  getNavigationItems(group?: string): PluginNavigationItem[] {
    let items = [...this.navigationItems]
    if (group) {
      items = items.filter(item => item.group === group)
    }
    return items.sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  /**
   * 监听导航变化
   */
  onNavigationChange(callback: (items: PluginNavigationItem[]) => void): () => void {
    this.navigationChangeCallbacks.add(callback)

    // 立即调用一次
    callback(this.navigationItems)

    // 返回取消监听函数
    return () => {
      this.navigationChangeCallbacks.delete(callback)
    }
  }

  /**
   * 通知导航变化
   */
  private notifyNavigationChange(): void {
    this.navigationChangeCallbacks.forEach(callback => {
      try {
        callback([...this.navigationItems])
      } catch (error) {
        console.error('[PluginPageManager] Navigation change callback error:', error)
      }
    })
  }

  /**
   * 清理插件的所有页面
   */
  cleanupPluginPages(pluginId: string): void {
    const pagesToRemove = Array.from(this.registeredPages.entries())
      .filter(([_, config]) => config.pluginId === pluginId)
      .map(([pageId]) => pageId)

    pagesToRemove.forEach(pageId => {
      this.unregisterPage(pageId)
    })

    console.log(`[PluginPageManager] Cleaned up ${pagesToRemove.length} pages for plugin ${pluginId}`)
  }

  /**
   * 检查页面是否存在
   */
  hasPage(path: string): boolean {
    return Array.from(this.registeredPages.values()).some(config => config.path === path)
  }

  /**
   * 根据路径获取页面配置
   */
  getPageByPath(path: string): PluginPageConfig | undefined {
    return Array.from(this.registeredPages.values()).find(config => config.path === path)
  }

  /**
   * 创建包装后的组件
   */
  private createWrappedComponent(config: PluginPageConfig): Component {
    const { component: OriginalComponent, container, title, icon, pluginId } = config

    // 如果明确设置不使用任何包装器，直接返回原组件
    if (container?.useDefault === false && !container?.customContainer) {
      return OriginalComponent
    }

    // 动态导入页面包装器
    const PluginPageWrapper = () => import('../components/PluginPageWrapper.vue')

    // 创建包装组件
    return {
      name: `WrappedPluginPage_${pluginId}`,
      components: {
        PluginPageWrapper: () => PluginPageWrapper,
        OriginalComponent
      },
      setup() {
        return () => {
          return {
            type: 'PluginPageWrapper',
            props: {
              containerConfig: container,
              pageTitle: title,
              pageIcon: icon,
              pluginId: pluginId
            },
            children: {
              default: () => ({
                type: 'OriginalComponent'
              })
            }
          }
        }
      }
    }
  }

  /**
   * 导航到插件页面
   */
  navigateToPage(pageId: string): void {
    const config = this.registeredPages.get(pageId)
    if (config) {
      this.router.push(config.path)
    } else {
      console.warn(`[PluginPageManager] Page not found: ${pageId}`)
    }
  }


}