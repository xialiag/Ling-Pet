/**
 * DOM注入管理器
 * 提供直接的DOM操作API，支持CSS选择器、HTML注入、样式注入等
 */

import type { Component } from 'vue'

export interface DOMInjectionOptions {
  position?: 'before' | 'after' | 'prepend' | 'append' | 'replace'
  selector?: string
  className?: string
  style?: Record<string, string> | string
  attributes?: Record<string, string>
  condition?: () => boolean
  order?: number
  autoRemove?: boolean // 是否在插件卸载时自动移除
}

export interface DOMInjectionInfo {
  id: string
  pluginId: string
  selector: string
  element: HTMLElement
  position: string
  options: DOMInjectionOptions
  targetElements: Set<Element>
}

/**
 * DOM注入管理器
 */
export class DOMInjectionManager {
  private injections = new Map<string, DOMInjectionInfo>()
  private observer: MutationObserver | null = null
  private styleSheets = new Map<string, HTMLStyleElement>()

  /**
   * 初始化DOM注入管理器
   */
  initialize(): void {
    // 启动DOM观察器，监听新元素
    this.startDOMObserver()
    console.log('[DOMInjection] DOM注入管理器已初始化')
  }

  /**
   * 启动DOM观察器
   */
  private startDOMObserver(): void {
    if (typeof window === 'undefined') return

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkNewElement(node as Element)
          }
        })
      })
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    console.log('[DOMInjection] DOM观察器已启动')
  }

  /**
   * 检查新元素是否匹配待处理的注入
   */
  private checkNewElement(element: Element): void {
    this.injections.forEach((injection) => {
      if (element.matches && element.matches(injection.selector)) {
        this.applyInjectionToElement(injection, element)
      }
      
      // 检查子元素
      const matchingChildren = element.querySelectorAll(injection.selector)
      matchingChildren.forEach(child => {
        this.applyInjectionToElement(injection, child)
      })
    })
  }

  /**
   * 注入HTML内容
   */
  injectHTML(
    pluginId: string,
    selector: string,
    html: string,
    options: DOMInjectionOptions = {}
  ): () => void {
    const injectionId = `${pluginId}-html-${Date.now()}`
    
    // 创建HTML元素
    const element = document.createElement('div')
    element.innerHTML = html
    element.setAttribute('data-plugin-id', pluginId)
    element.setAttribute('data-injection-id', injectionId)
    
    // 应用样式和属性
    this.applyElementOptions(element, options)
    
    return this.registerInjection(injectionId, pluginId, selector, element, options)
  }

  /**
   * 注入文本内容
   */
  injectText(
    pluginId: string,
    selector: string,
    text: string,
    options: DOMInjectionOptions = {}
  ): () => void {
    const injectionId = `${pluginId}-text-${Date.now()}`
    
    // 创建文本元素
    const element = document.createElement('div')
    element.textContent = text
    element.setAttribute('data-plugin-id', pluginId)
    element.setAttribute('data-injection-id', injectionId)
    
    // 应用样式和属性
    this.applyElementOptions(element, options)
    
    return this.registerInjection(injectionId, pluginId, selector, element, options)
  }

  /**
   * 注入Vue组件
   */
  async injectVueComponent(
    pluginId: string,
    selector: string,
    component: Component,
    props: Record<string, any> = {},
    options: DOMInjectionOptions = {}
  ): Promise<() => void> {
    const injectionId = `${pluginId}-vue-${Date.now()}`
    
    // 创建容器元素
    const element = document.createElement('div')
    element.setAttribute('data-plugin-id', pluginId)
    element.setAttribute('data-injection-id', injectionId)
    
    // 应用样式和属性
    this.applyElementOptions(element, options)
    
    // 挂载Vue组件
    try {
      const { createApp } = await import('vue')
      const componentApp = createApp(component, props)
      componentApp.mount(element)
      
      // 保存Vue应用实例
      ;(element as any).__vueApp = componentApp
      
      console.log(`[DOMInjection] Vue组件已挂载: ${injectionId}`)
    } catch (error) {
      console.error('[DOMInjection] Vue组件挂载失败:', error)
      
      // 备用渲染
      element.innerHTML = `
        <div style="
          padding: 8px 12px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          color: #666;
          font-size: 12px;
        ">
          Vue组件 (${component.name || 'Unknown'})
        </div>
      `
    }
    
    return this.registerInjection(injectionId, pluginId, selector, element, options)
  }

  /**
   * 注入CSS样式
   */
  injectCSS(
    pluginId: string,
    css: string,
    options: { id?: string } = {}
  ): () => void {
    const styleId = options.id || `${pluginId}-style-${Date.now()}`
    
    // 创建style元素
    const styleElement = document.createElement('style')
    styleElement.id = styleId
    styleElement.textContent = css
    styleElement.setAttribute('data-plugin-id', pluginId)
    
    // 添加到head
    document.head.appendChild(styleElement)
    
    // 保存引用
    this.styleSheets.set(styleId, styleElement)
    
    console.log(`[DOMInjection] CSS样式已注入: ${styleId}`)
    
    // 返回清理函数
    return () => {
      const element = document.getElementById(styleId)
      if (element) {
        element.remove()
      }
      this.styleSheets.delete(styleId)
      console.log(`[DOMInjection] CSS样式已移除: ${styleId}`)
    }
  }

  /**
   * 注册DOM注入
   */
  private registerInjection(
    injectionId: string,
    pluginId: string,
    selector: string,
    element: HTMLElement,
    options: DOMInjectionOptions
  ): () => void {
    const injection: DOMInjectionInfo = {
      id: injectionId,
      pluginId,
      selector,
      element,
      position: options.position || 'after',
      options,
      targetElements: new Set()
    }
    
    this.injections.set(injectionId, injection)
    
    // 立即查找并应用到现有元素
    const existingElements = document.querySelectorAll(selector)
    existingElements.forEach(target => {
      this.applyInjectionToElement(injection, target)
    })
    
    console.log(`[DOMInjection] 注册DOM注入: ${injectionId} -> ${selector}`)
    
    // 返回清理函数
    return () => {
      this.removeInjection(injectionId)
    }
  }

  /**
   * 应用注入到元素
   */
  private applyInjectionToElement(injection: DOMInjectionInfo, targetElement: Element): void {
    // 检查条件
    if (injection.options.condition && !injection.options.condition()) {
      return
    }
    
    // 避免重复应用
    if (injection.targetElements.has(targetElement)) {
      return
    }
    
    // 克隆注入元素
    const injectedElement = injection.element.cloneNode(true) as HTMLElement
    
    // 应用注入
    try {
      switch (injection.position) {
        case 'before':
          targetElement.parentNode?.insertBefore(injectedElement, targetElement)
          break
        case 'after':
          targetElement.parentNode?.insertBefore(injectedElement, targetElement.nextSibling)
          break
        case 'prepend':
          targetElement.insertBefore(injectedElement, targetElement.firstChild)
          break
        case 'append':
          targetElement.appendChild(injectedElement)
          break
        case 'replace':
          targetElement.parentNode?.replaceChild(injectedElement, targetElement)
          break
        default:
          targetElement.parentNode?.insertBefore(injectedElement, targetElement.nextSibling)
      }
      
      injection.targetElements.add(targetElement)
      console.log(`[DOMInjection] 应用注入 ${injection.id} 到元素 ${injection.selector}`)
      
    } catch (error) {
      console.error(`[DOMInjection] 应用注入失败:`, error)
    }
  }

  /**
   * 应用元素选项
   */
  private applyElementOptions(element: HTMLElement, options: DOMInjectionOptions): void {
    // 应用类名
    if (options.className) {
      element.className = options.className
    }
    
    // 应用样式
    if (options.style) {
      if (typeof options.style === 'string') {
        element.style.cssText = options.style
      } else {
        Object.assign(element.style, options.style)
      }
    }
    
    // 应用属性
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value)
      })
    }
  }

  /**
   * 移除注入
   */
  private removeInjection(injectionId: string): void {
    const injection = this.injections.get(injectionId)
    if (!injection) return
    
    // 移除所有注入的元素
    document.querySelectorAll(`[data-injection-id="${injectionId}"]`).forEach(element => {
      // 清理Vue应用实例
      const vueApp = (element as any).__vueApp
      if (vueApp) {
        try {
          vueApp.unmount()
        } catch (error) {
          console.warn('[DOMInjection] 卸载Vue组件失败:', error)
        }
      }
      
      element.remove()
    })
    
    this.injections.delete(injectionId)
    console.log(`[DOMInjection] 移除DOM注入: ${injectionId}`)
  }

  /**
   * 清理插件的所有注入
   */
  cleanupPlugin(pluginId: string): void {
    console.log(`[DOMInjection] 清理插件注入: ${pluginId}`)
    
    // 清理DOM注入
    const injectionsToRemove: string[] = []
    this.injections.forEach((injection, id) => {
      if (injection.pluginId === pluginId) {
        injectionsToRemove.push(id)
      }
    })
    
    injectionsToRemove.forEach(id => {
      this.removeInjection(id)
    })
    
    // 清理CSS样式
    const stylesToRemove: string[] = []
    this.styleSheets.forEach((element, id) => {
      if (element.getAttribute('data-plugin-id') === pluginId) {
        stylesToRemove.push(id)
      }
    })
    
    stylesToRemove.forEach(id => {
      const element = this.styleSheets.get(id)
      if (element) {
        element.remove()
        this.styleSheets.delete(id)
      }
    })
    
    console.log(`[DOMInjection] 插件 ${pluginId} 的注入已清理`)
  }

  /**
   * 查询元素
   */
  querySelector(selector: string): Element | null {
    return document.querySelector(selector)
  }

  /**
   * 查询所有元素
   */
  querySelectorAll(selector: string): NodeListOf<Element> {
    return document.querySelectorAll(selector)
  }

  /**
   * 等待元素出现
   */
  waitForElement(selector: string, timeout: number = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      // 先检查是否已存在
      const existing = document.querySelector(selector)
      if (existing) {
        resolve(existing)
        return
      }
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
      
      // 观察DOM变化
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              if (element.matches && element.matches(selector)) {
                clearTimeout(timeoutId)
                observer.disconnect()
                resolve(element)
                return
              }
              
              const found = element.querySelector && element.querySelector(selector)
              if (found) {
                clearTimeout(timeoutId)
                observer.disconnect()
                resolve(found)
                return
              }
            }
          })
        })
      })
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      })
    })
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const injectedElements = document.querySelectorAll('[data-plugin-id]')
    
    return {
      totalInjections: this.injections.size,
      totalStyleSheets: this.styleSheets.size,
      totalInjectedElements: injectedElements.length
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    // 清理所有注入
    this.injections.forEach((_, id) => {
      this.removeInjection(id)
    })
    
    // 清理所有样式
    this.styleSheets.forEach((element) => {
      element.remove()
    })
    this.styleSheets.clear()
    
    console.log('[DOMInjection] 已清理所有资源')
  }
}

// 全局实例
export const domInjectionManager = new DOMInjectionManager()