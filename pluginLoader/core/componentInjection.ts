/**
 * 组件注入管理器
 * 提供完整的组件注入功能，支持before/after/replace等位置
 * 支持局部导入组件的自动发现和注入
 * 集成运行时组件包装功能
 */

import type { Component } from 'vue'
import { h, defineComponent, computed, getCurrentInstance, onMounted, onUnmounted } from 'vue'

export interface InjectionInfo {
  id: string
  pluginId: string
  targetComponent: string
  component: Component
  position: 'before' | 'after' | 'replace'
  props?: Record<string, any>
  condition?: () => boolean
  order?: number
}

/**
 * 组件注入管理器
 * 集成运行时包装功能
 */
export class ComponentInjectionManager {
  private injections = new Map<string, InjectionInfo[]>()
  private wrappedComponents = new Map<string, Component>()
  private originalComponents = new Map<string, Component>()

  /**
   * 注册组件注入
   */
  registerInjection(injection: InjectionInfo): () => void {
    const { targetComponent } = injection

    if (!this.injections.has(targetComponent)) {
      this.injections.set(targetComponent, [])
    }

    const injectionList = this.injections.get(targetComponent)!
    injectionList.push(injection)

    // 按order排序
    injectionList.sort((a, b) => (a.order || 0) - (b.order || 0))

    console.log(`[ComponentInjection] Registered injection ${injection.id} for ${targetComponent}`)

    // 返回取消注入函数
    return () => {
      const list = this.injections.get(targetComponent)
      if (list) {
        const index = list.findIndex(i => i.id === injection.id)
        if (index !== -1) {
          list.splice(index, 1)
        }
      }
      console.log(`[ComponentInjection] Unregistered injection ${injection.id}`)
    }
  }

  /**
   * 获取目标组件的所有注入
   */
  getInjections(targetComponent: string): InjectionInfo[] {
    return this.injections.get(targetComponent) || []
  }

  /**
   * 智能组件注入 - 支持局部导入组件（无需修改源码）
   */
  async injectToComponent(targetComponentName: string, injection: InjectionInfo): Promise<() => void> {
    console.log(`[ComponentInjection] 智能注入到组件 ${targetComponentName}（无需修改源码）`)

    // 先注册注入信息
    const unregister = this.registerInjection(injection)

    // 触发Vue实例拦截器检查已挂载的组件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plugin:trigger-component-check', {
        detail: { componentName: targetComponentName }
      }))
    }

    console.log(`[ComponentInjection] 注入已设置，等待组件被发现: ${injection.id}`)

    // 返回清理函数
    return unregister
  }

  /**
   * 创建运行时包装组件
   * 这个包装器会在组件渲染时检查是否有插件注入，并动态应用
   */
  createRuntimeComponentWrapper(originalComponent: Component, componentName: string): Component {
    return defineComponent({
      name: `RuntimeWrapped${componentName}`,
      
      setup(props, { slots, attrs }) {
        let unwrapFunctions: Array<() => void> = []
        
        onMounted(() => {
          // 检查是否有待处理的注入
          const injections = componentInjectionManager.getInjections(componentName)
          if (injections.length > 0) {
            console.log(`[ComponentInjection] 发现 ${componentName} 有 ${injections.length} 个注入`)
            
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
          const beforeInjections = injections.filter((i: InjectionInfo) => 
            i.position === 'before' && (!i.condition || i.condition())
          )
          const afterInjections = injections.filter((i: InjectionInfo) => 
            i.position === 'after' && (!i.condition || i.condition())
          )
          const replaceInjection = injections.find((i: InjectionInfo) => 
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
          beforeInjections.forEach((injection: InjectionInfo) => {
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
          afterInjections.forEach((injection: InjectionInfo) => {
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
   * 创建包装后的组件（静态版本，兼容旧API）
   * 这个组件会在适当的位置渲染注入的组件
   */
  createWrappedComponent(originalComponent: Component, componentName: string): Component {
    const injections = this.getInjections(componentName)

    if (injections.length === 0) {
      return originalComponent
    }

    // 检查是否有replace注入
    const replaceInjection = injections.find(i => i.position === 'replace')
    if (replaceInjection) {
      // 如果有replace，直接返回替换的组件
      if (!replaceInjection.condition || replaceInjection.condition()) {
        return replaceInjection.component
      }
    }

    // 创建包装组件
    const wrappedComponent = defineComponent({
      name: `Wrapped${componentName}`,

      setup(props, { slots, attrs }) {
        // 过滤出before和after注入
        const beforeInjections = computed(() =>
          injections.filter(i =>
            i.position === 'before' &&
            (!i.condition || i.condition())
          )
        )

        const afterInjections = computed(() =>
          injections.filter(i =>
            i.position === 'after' &&
            (!i.condition || i.condition())
          )
        )

        return () => {
          const children: any[] = []

          // 渲染before注入
          beforeInjections.value.forEach(injection => {
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
          afterInjections.value.forEach(injection => {
            children.push(
              h(injection.component, {
                key: injection.id,
                ...injection.props,
                ...attrs
              })
            )
          })

          // 返回包装后的内容
          return h('div', { class: `wrapped-${componentName.toLowerCase()}` }, children)
        }
      }
    })

    // 保存包装后的组件
    this.wrappedComponents.set(componentName, wrappedComponent)

    return wrappedComponent
  }

  /**
   * 包装组件（运行时版本）
   */
  wrapComponent(componentName: string, originalComponent: Component): Component {
    if (this.wrappedComponents.has(componentName)) {
      return this.wrappedComponents.get(componentName)!
    }
    
    // 保存原始组件
    this.originalComponents.set(componentName, originalComponent)
    
    // 创建包装组件
    const wrappedComponent = this.createRuntimeComponentWrapper(originalComponent, componentName)
    this.wrappedComponents.set(componentName, wrappedComponent)
    
    console.log(`[ComponentInjection] 已包装组件: ${componentName}`)
    
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
    
    console.log(`[ComponentInjection] 已取消包装组件: ${componentName}`)
    
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
   * 清理插件的所有注入
   */
  cleanupPlugin(pluginId: string): void {
    const affectedComponents: string[] = []

    this.injections.forEach((injectionList, componentName) => {
      const filtered = injectionList.filter(i => i.pluginId !== pluginId)
      if (filtered.length !== injectionList.length) {
        affectedComponents.push(componentName)
      }

      if (filtered.length === 0) {
        this.injections.delete(componentName)
        this.wrappedComponents.delete(componentName)
        this.originalComponents.delete(componentName)
      } else {
        this.injections.set(componentName, filtered)
      }
    })

    console.log(`[ComponentInjection] Cleaned up injections for plugin ${pluginId}`)
    console.log(`[ComponentInjection] Affected components:`, affectedComponents)

    // 触发强制刷新事件
    if (affectedComponents.length > 0) {
      this.triggerComponentRefresh(affectedComponents)
    }
  }

  /**
   * 清理所有包装
   */
  cleanup(): void {
    this.injections.clear()
    this.wrappedComponents.clear()
    this.originalComponents.clear()
    console.log('[ComponentInjection] 已清理所有包装和注入')
  }

  /**
   * 触发组件刷新
   * 通过修改 key 或发送事件来强制组件重新渲染
   */
  private triggerComponentRefresh(componentNames: string[]): void {
    console.log(`[ComponentInjection] Triggering refresh for components:`, componentNames)

    // 方案1: 发送全局事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plugin:component-injection-changed', {
        detail: { components: componentNames }
      }))
    }

    // 方案2: 强制更新包装组件
    componentNames.forEach(name => {
      this.wrappedComponents.delete(name)
    })
  }

  /**
   * 获取统计信息
   */
  getStats() {
    let totalInjections = 0
    this.injections.forEach(list => {
      totalInjections += list.length
    })

    return {
      targetComponents: this.injections.size,
      totalInjections,
      wrappedComponents: this.wrappedComponents.size,
      originalComponents: this.originalComponents.size
    }
  }
}

// 全局实例
export const componentInjectionManager = new ComponentInjectionManager()

// 兼容性导出 - 保持与 componentWrapper.ts 的接口兼容
export const createRuntimeComponentWrapper = (originalComponent: Component, componentName: string): Component => {
  return componentInjectionManager.createRuntimeComponentWrapper(originalComponent, componentName)
}

export class ComponentRuntimeWrapper {
  wrapComponent(componentName: string, originalComponent: Component): Component {
    return componentInjectionManager.wrapComponent(componentName, originalComponent)
  }
  
  getWrappedComponent(componentName: string): Component | undefined {
    return componentInjectionManager.getWrappedComponent(componentName)
  }
  
  getOriginalComponent(componentName: string): Component | undefined {
    return componentInjectionManager.getOriginalComponent(componentName)
  }
  
  unwrapComponent(componentName: string): Component | undefined {
    return componentInjectionManager.unwrapComponent(componentName)
  }
  
  isWrapped(componentName: string): boolean {
    return componentInjectionManager.isWrapped(componentName)
  }
  
  getAllWrappedComponents(): string[] {
    return componentInjectionManager.getAllWrappedComponents()
  }
  
  cleanup(): void {
    componentInjectionManager.cleanup()
  }
}

export const componentRuntimeWrapper = new ComponentRuntimeWrapper()
