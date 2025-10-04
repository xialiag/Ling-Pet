/**
 * 组件自动发现和注册机制
 * 解决局部导入组件无法hook的问题
 */

import type { App, Component } from 'vue'
import { componentInjectionManager } from './componentInjection'

export interface ComponentRegistration {
  name: string
  component: Component
  source: 'global' | 'discovered'
  path?: string
}

/**
 * 组件发现管理器
 */
export class ComponentDiscoveryManager {
  private app: App | null = null
  private discoveredComponents = new Map<string, ComponentRegistration>()
  private componentObserver: MutationObserver | null = null
  private pendingInjections = new Map<string, Array<() => void>>()

  /**
   * 初始化组件发现系统
   */
  initialize(app: App): void {
    this.app = app
    
    // 扫描已全局注册的组件
    this.scanGlobalComponents()
    
    // 启动DOM观察器，发现动态组件
    this.startDOMObserver()
    
    // 监听Vue组件挂载事件
    this.setupVueComponentWatcher()
    
    console.log('[ComponentDiscovery] 组件发现系统已初始化')
  }

  /**
   * 扫描全局注册的组件
   */
  private scanGlobalComponents(): void {
    if (!this.app) return

    // 获取全局组件
    const globalComponents = this.app._context.components
    if (globalComponents) {
      for (const [name, component] of Object.entries(globalComponents)) {
        this.discoveredComponents.set(name, {
          name,
          component: component as Component,
          source: 'global'
        })
      }
    }

    console.log(`[ComponentDiscovery] 发现 ${this.discoveredComponents.size} 个全局组件`)
  }

  /**
   * 启动DOM观察器
   */
  private startDOMObserver(): void {
    if (typeof window === 'undefined') return

    this.componentObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.scanElementForComponents(node as Element)
          }
        })
      })
    })

    this.componentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    })

    console.log('[ComponentDiscovery] DOM观察器已启动')
  }

  /**
   * 扫描元素中的Vue组件
   */
  private scanElementForComponents(element: Element): void {
    // 检查元素是否是Vue组件实例
    const vueInstance = (element as any).__vueParentComponent
    if (vueInstance) {
      const componentName = this.extractComponentName(vueInstance)
      if (componentName && !this.discoveredComponents.has(componentName)) {
        this.registerDiscoveredComponent(componentName, vueInstance.type)
      }
    }

    // 递归扫描子元素
    element.querySelectorAll('*').forEach((child) => {
      const childVueInstance = (child as any).__vueParentComponent
      if (childVueInstance) {
        const componentName = this.extractComponentName(childVueInstance)
        if (componentName && !this.discoveredComponents.has(componentName)) {
          this.registerDiscoveredComponent(componentName, childVueInstance.type)
        }
      }
    })
  }

  /**
   * 设置Vue组件监听器
   */
  private setupVueComponentWatcher(): void {
    if (!this.app) return

    // Hook Vue的组件创建过程
    const originalMount = this.app.mount
    this.app.mount = (...args) => {
      const result = originalMount.apply(this.app!, args)
      
      // 延迟扫描，确保组件已挂载
      setTimeout(() => {
        this.scanMountedComponents()
      }, 100)
      
      return result
    }
  }

  /**
   * 扫描已挂载的组件
   */
  private scanMountedComponents(): void {
    if (typeof window === 'undefined') return

    // 扫描所有DOM元素，查找Vue组件实例
    document.querySelectorAll('*').forEach((element) => {
      const vueInstance = (element as any).__vueParentComponent
      if (vueInstance) {
        const componentName = this.extractComponentName(vueInstance)
        if (componentName && !this.discoveredComponents.has(componentName)) {
          this.registerDiscoveredComponent(componentName, vueInstance.type)
        }
      }
    })
  }

  /**
   * 提取组件名称
   */
  private extractComponentName(vueInstance: any): string | null {
    // 尝试多种方式获取组件名称
    const component = vueInstance.type
    if (!component) return null

    // 1. 显式设置的name
    if (component.name) return component.name

    // 2. 从__name获取（Vue SFC编译后的名称）
    if (component.__name) return component.__name

    // 3. 从文件路径推断
    if (component.__file) {
      const fileName = component.__file.split('/').pop()?.replace(/\.(vue|ts|js)$/, '')
      if (fileName) return fileName
    }

    // 4. 从构造函数名称推断
    if (component.constructor?.name && component.constructor.name !== 'Object') {
      return component.constructor.name
    }

    return null
  }

  /**
   * 注册发现的组件
   */
  private registerDiscoveredComponent(name: string, component: Component): void {
    console.log(`[ComponentDiscovery] 发现组件: ${name}`)

    const registration: ComponentRegistration = {
      name,
      component,
      source: 'discovered'
    }

    this.discoveredComponents.set(name, registration)

    // 如果有待处理的注入，立即处理
    const pendingCallbacks = this.pendingInjections.get(name)
    if (pendingCallbacks) {
      console.log(`[ComponentDiscovery] 处理 ${name} 的 ${pendingCallbacks.length} 个待处理注入`)
      pendingCallbacks.forEach(callback => callback())
      this.pendingInjections.delete(name)
    }

    // 触发组件发现事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plugin:component-discovered', {
        detail: { componentName: name, component }
      }))
    }
  }

  /**
   * 获取组件（全局或发现的）
   */
  getComponent(name: string): Component | null {
    const registration = this.discoveredComponents.get(name)
    return registration?.component || null
  }

  /**
   * 检查组件是否存在
   */
  hasComponent(name: string): boolean {
    return this.discoveredComponents.has(name)
  }

  /**
   * 等待组件被发现
   */
  waitForComponent(name: string, timeout: number = 5000): Promise<Component> {
    return new Promise((resolve, reject) => {
      // 如果组件已存在，立即返回
      const existing = this.getComponent(name)
      if (existing) {
        resolve(existing)
        return
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        reject(new Error(`Component ${name} not found within ${timeout}ms`))
      }, timeout)

      // 等待组件被发现
      const callback = () => {
        clearTimeout(timeoutId)
        const component = this.getComponent(name)
        if (component) {
          resolve(component)
        } else {
          reject(new Error(`Component ${name} still not found`))
        }
      }

      // 添加到待处理列表
      if (!this.pendingInjections.has(name)) {
        this.pendingInjections.set(name, [])
      }
      this.pendingInjections.get(name)!.push(callback)
    })
  }

  /**
   * 强制扫描指定组件
   */
  async forceDiscoverComponent(name: string): Promise<Component | null> {
    // 重新扫描DOM
    this.scanMountedComponents()
    
    // 等待一小段时间让扫描完成
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return this.getComponent(name)
  }

  /**
   * 获取所有发现的组件
   */
  getAllComponents(): ComponentRegistration[] {
    return Array.from(this.discoveredComponents.values())
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const components = this.getAllComponents()
    const globalCount = components.filter(c => c.source === 'global').length
    const discoveredCount = components.filter(c => c.source === 'discovered').length

    return {
      total: components.length,
      global: globalCount,
      discovered: discoveredCount,
      pending: this.pendingInjections.size
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.componentObserver) {
      this.componentObserver.disconnect()
      this.componentObserver = null
    }

    this.discoveredComponents.clear()
    this.pendingInjections.clear()

    console.log('[ComponentDiscovery] 已清理资源')
  }
}

// 全局实例
export const componentDiscoveryManager = new ComponentDiscoveryManager()