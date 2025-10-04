/**
 * 局部组件Hook解决方案
 * 通过Vue指令和全局事件实现局部导入组件的Hook功能
 */

import type { App, Component, DirectiveBinding } from 'vue'
import { componentInjectionManager } from './componentInjection'

/**
 * 局部组件Hook管理器
 */
export class LocalComponentHookManager {
  private app: App | null = null
  private hookedElements = new WeakMap<Element, string>()
  
  /**
   * 初始化
   */
  initialize(app: App): void {
    this.app = app
    
    // 注册v-plugin-hookable指令
    app.directive('plugin-hookable', {
      mounted: (el: Element, binding: DirectiveBinding) => {
        this.handleElementMounted(el, binding)
      },
      
      updated: (el: Element, binding: DirectiveBinding) => {
        this.handleElementUpdated(el, binding)
      },
      
      unmounted: (el: Element) => {
        this.handleElementUnmounted(el)
      }
    })
    
    // 监听重新应用注入事件
    if (typeof window !== 'undefined') {
      window.addEventListener('plugin:reapply-injections', (event: Event) => {
        const customEvent = event as CustomEvent
        const componentName = customEvent.detail?.componentName
        if (componentName) {
          this.triggerComponentCheck(componentName)
        }
      })
    }
    
    console.log('[LocalComponentHook] 已初始化，注册了v-plugin-hookable指令')
  }
  
  /**
   * 处理元素挂载
   */
  private handleElementMounted(el: Element, binding: DirectiveBinding): void {
    const componentName = binding.value || binding.arg
    if (!componentName) {
      console.warn('[LocalComponentHook] v-plugin-hookable指令需要组件名称')
      return
    }
    
    console.log(`[LocalComponentHook] 组件 ${componentName} 已挂载`)
    
    // 保存组件名称
    this.hookedElements.set(el, componentName)
    
    // 添加数据属性，便于查找
    el.setAttribute('data-component', componentName)
    
    // 检查是否有待处理的注入
    const injections = componentInjectionManager.getInjections(componentName)
    if (injections.length > 0) {
      console.log(`[LocalComponentHook] 发现 ${componentName} 有 ${injections.length} 个待处理注入`)
      this.applyInjections(el, componentName, injections)
    }
    
    // 触发组件发现事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plugin:local-component-mounted', {
        detail: { componentName, element: el }
      }))
    }
  }
  
  /**
   * 处理元素更新
   */
  private handleElementUpdated(el: Element, binding: DirectiveBinding): void {
    const componentName = binding.value || binding.arg
    const oldComponentName = this.hookedElements.get(el)
    
    if (componentName !== oldComponentName) {
      // 组件名称变化，重新处理
      this.handleElementUnmounted(el)
      this.handleElementMounted(el, binding)
    }
  }
  
  /**
   * 处理元素卸载
   */
  private handleElementUnmounted(el: Element): void {
    const componentName = this.hookedElements.get(el)
    if (componentName) {
      console.log(`[LocalComponentHook] 组件 ${componentName} 已卸载`)
      
      // 清理注入的元素
      this.cleanupInjections(el)
      
      // 移除记录
      this.hookedElements.delete(el)
      
      // 触发组件卸载事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plugin:local-component-unmounted', {
          detail: { componentName, element: el }
        }))
      }
    }
  }
  
  /**
   * 应用注入
   */
  private applyInjections(el: Element, componentName: string, injections: any[]): void {
    // 清理之前的注入
    this.cleanupInjections(el)
    
    // 应用before注入
    const beforeInjections = injections.filter(i => i.position === 'before')
    beforeInjections.forEach(injection => {
      this.createInjectionElement(el, injection, 'before')
    })
    
    // 应用after注入
    const afterInjections = injections.filter(i => i.position === 'after')
    afterInjections.forEach(injection => {
      this.createInjectionElement(el, injection, 'after')
    })
    
    // 应用replace注入
    const replaceInjection = injections.find(i => i.position === 'replace')
    if (replaceInjection) {
      this.createInjectionElement(el, replaceInjection, 'replace')
    }
  }
  
  /**
   * 创建注入元素
   */
  private createInjectionElement(targetEl: Element, injection: any, position: string): void {
    const injectionEl = document.createElement('div')
    injectionEl.className = `plugin-injection plugin-injection-${position}`
    injectionEl.setAttribute('data-plugin-id', injection.pluginId)
    injectionEl.setAttribute('data-injection-id', injection.id)
    
    // 根据注入类型创建内容
    if (injection.component) {
      // 如果是Vue组件，创建Vue实例
      this.mountVueComponent(injectionEl, injection.component, injection.props || {})
    } else if (injection.html) {
      // 如果是HTML内容
      injectionEl.innerHTML = injection.html
    } else if (injection.text) {
      // 如果是文本内容
      injectionEl.textContent = injection.text
    }
    
    // 插入到适当位置
    if (position === 'before') {
      targetEl.parentNode?.insertBefore(injectionEl, targetEl)
    } else if (position === 'after') {
      targetEl.parentNode?.insertBefore(injectionEl, targetEl.nextSibling)
    } else if (position === 'replace') {
      (targetEl as HTMLElement).style.display = 'none'
      targetEl.parentNode?.insertBefore(injectionEl, targetEl)
    }
    
    console.log(`[LocalComponentHook] 已创建注入元素: ${injection.id} (${position})`)
  }
  
  /**
   * 挂载Vue组件到DOM元素
   */
  private mountVueComponent(el: Element, component: Component, props: Record<string, any>): void {
    if (!this.app) return
    
    try {
      // 创建Vue应用实例
      const { createApp } = require('vue')
      const componentApp = createApp(component, props)
      
      // 挂载到元素
      componentApp.mount(el)
      
      // 保存应用实例，用于后续清理
      ;(el as any).__vueApp = componentApp
      
      console.log('[LocalComponentHook] Vue组件已挂载到注入元素')
    } catch (error) {
      console.error('[LocalComponentHook] 挂载Vue组件失败:', error)
    }
  }
  
  /**
   * 清理注入
   */
  private cleanupInjections(el: Element): void {
    // 查找所有注入元素
    const parent = el.parentNode
    if (!parent) return
    
    const injectionElements = parent.querySelectorAll('.plugin-injection')
    injectionElements.forEach(injectionEl => {
      // 清理Vue应用实例
      const vueApp = (injectionEl as any).__vueApp
      if (vueApp) {
        try {
          vueApp.unmount()
        } catch (error) {
          console.warn('[LocalComponentHook] 卸载Vue组件失败:', error)
        }
      }
      
      // 移除DOM元素
      injectionEl.remove()
    })
    
    // 恢复被替换的元素
    if (el instanceof HTMLElement && (el as HTMLElement).style.display === 'none') {
      (el as HTMLElement).style.display = ''
    }
  }
  
  /**
   * 手动触发组件Hook检查
   */
  triggerComponentCheck(componentName: string): void {
    // 查找所有使用该组件名称的元素
    document.querySelectorAll(`[data-component="${componentName}"]`).forEach(el => {
      const injections = componentInjectionManager.getInjections(componentName)
      if (injections.length > 0) {
        this.applyInjections(el, componentName, injections)
      }
    })
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const elements = document.querySelectorAll('[v-plugin-hookable]')
    const injections = document.querySelectorAll('.plugin-injection')
    
    return {
      hookedElements: elements.length,
      activeInjections: injections.length
    }
  }
}

// 全局实例
export const localComponentHookManager = new LocalComponentHookManager()