/**
 * Vue组件运行时包装器
 * 用于在运行时动态包装局部导入的组件，实现插件注入
 */

import type { Component } from 'vue'
import { defineComponent, h, getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { componentInjectionManager } from './componentInjection'

/**
 * 创建组件包装器
 * 这个包装器会在组件渲染时检查是否有插件注入，并动态应用
 */
export function createRuntimeComponentWrapper(originalComponent: Component, componentName: string): Component {
  return defineComponent({
    name: `RuntimeWrapped${componentName}`,
    
    setup(props, { slots, attrs }) {
      let unwrapFunctions: Array<() => void> = []
      
      onMounted(() => {
        // 检查是否有待处理的注入
        const injections = componentInjectionManager.getInjections(componentName)
        if (injections.length > 0) {
          console.log(`[ComponentWrapper] 发现 ${componentName} 有 ${injections.length} 个注入`)
          
          // 触发组件包装事件
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plugin:component-mounted', {
              detail: { 
                componentName,
                component: originalComponent,
                instance: getCurrentInstance()
              }
            }))
          }
        }
      })
      
      onUnmounted(() => {
        // 清理包装函数
        unwrapFunctions.forEach(fn => fn())
        unwrapFunctions = []
      })
      
      return () => {
        const injections = componentInjectionManager.getInjections(componentName)
        
        if (injections.length === 0) {
          // 没有注入，直接渲染原组件
          return h(originalComponent, { ...props, ...attrs }, slots)
        }
        
        // 有注入，创建包装渲染
        const children: any[] = []
        
        // 过滤注入
        const beforeInjections = injections.filter(i => 
          i.position === 'before' && (!i.condition || i.condition())
        )
        const afterInjections = injections.filter(i => 
          i.position === 'after' && (!i.condition || i.condition())
        )
        const replaceInjection = injections.find(i => 
          i.position === 'replace' && (!i.condition || i.condition())
        )
        
        // 如果有替换注入，直接返回替换组件
        if (replaceInjection) {
          return h(replaceInjection.component, {
            key: replaceInjection.id,
            ...replaceInjection.props,
            ...attrs
          })
        }
        
        // 渲染before注入
        beforeInjections.forEach(injection => {
          children.push(
            h(injection.component, {
              key: injection.id,
              ...injection.props,
              ...attrs
            })
          )
        })
        
        // 渲染原始组件
        children.push(
          h(originalComponent, {
            key: 'original',
            ...props,
            ...attrs
          }, slots)
        )
        
        // 渲染after注入
        afterInjections.forEach(injection => {
          children.push(
            h(injection.component, {
              key: injection.id,
              ...injection.props,
              ...attrs
            })
          )
        })
        
        // 返回包装后的内容
        return h('div', { 
          class: `runtime-wrapped-${componentName.toLowerCase()}`,
          style: { position: 'relative', width: '100%', height: '100%' }
        }, children)
      }
    }
  })
}

/**
 * 组件运行时包装管理器
 */
export class ComponentRuntimeWrapper {
  private wrappedComponents = new Map<string, Component>()
  private originalComponents = new Map<string, Component>()
  
  /**
   * 包装组件
   */
  wrapComponent(componentName: string, originalComponent: Component): Component {
    if (this.wrappedComponents.has(componentName)) {
      return this.wrappedComponents.get(componentName)!
    }
    
    // 保存原始组件
    this.originalComponents.set(componentName, originalComponent)
    
    // 创建包装组件
    const wrappedComponent = createRuntimeComponentWrapper(originalComponent, componentName)
    this.wrappedComponents.set(componentName, wrappedComponent)
    
    console.log(`[ComponentRuntimeWrapper] 已包装组件: ${componentName}`)
    
    return wrappedComponent
  }
  
  /**
   * 获取包装后的组件
   */
  getWrappedComponent(componentName: string): Component | undefined {
    return this.wrappedComponents.get(componentName)
  }
  
  /**
   * 获取原始组件
   */
  getOriginalComponent(componentName: string): Component | undefined {
    return this.originalComponents.get(componentName)
  }
  
  /**
   * 取消包装
   */
  unwrapComponent(componentName: string): Component | undefined {
    const original = this.originalComponents.get(componentName)
    this.wrappedComponents.delete(componentName)
    this.originalComponents.delete(componentName)
    
    console.log(`[ComponentRuntimeWrapper] 已取消包装组件: ${componentName}`)
    
    return original
  }
  
  /**
   * 检查组件是否已包装
   */
  isWrapped(componentName: string): boolean {
    return this.wrappedComponents.has(componentName)
  }
  
  /**
   * 获取所有包装的组件
   */
  getAllWrappedComponents(): string[] {
    return Array.from(this.wrappedComponents.keys())
  }
  
  /**
   * 清理所有包装
   */
  cleanup(): void {
    this.wrappedComponents.clear()
    this.originalComponents.clear()
    console.log('[ComponentRuntimeWrapper] 已清理所有包装')
  }
}

// 全局实例
export const componentRuntimeWrapper = new ComponentRuntimeWrapper()