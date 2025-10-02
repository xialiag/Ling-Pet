/**
 * Hook引擎 - 核心Hook实现
 */

import type { App, Component } from 'vue'
import type { Store } from 'pinia'
import type { ComponentHooks, StoreHooks, ServiceHooks, UnhookFunction } from '../types/api'
import { createHookWrapper, createAsyncHookWrapper } from './pluginApi'

/**
 * 组件Hook管理器
 */
export class ComponentHookManager {
  private hooks = new Map<string, Set<ComponentHooks>>()
  
  /**
   * 注册组件Hook
   */
  registerHook(componentName: string, hooks: ComponentHooks): UnhookFunction {
    if (!this.hooks.has(componentName)) {
      this.hooks.set(componentName, new Set())
    }
    
    this.hooks.get(componentName)!.add(hooks)
    
    // 返回取消Hook函数
    return () => {
      this.hooks.get(componentName)?.delete(hooks)
    }
  }
  
  /**
   * 应用Hook到组件
   */
  applyToComponent(component: Component, componentName: string): void {
    const hookSet = this.hooks.get(componentName)
    if (!hookSet || hookSet.size === 0) return
    
    // 保存原始setup
    const originalSetup = (component as any).setup
    
    // 包装setup函数
    ;(component as any).setup = function(props: any, ctx: any) {
      const result = originalSetup ? originalSetup(props, ctx) : {}
      
      // 注入生命周期Hook
      const { onMounted, onBeforeMount, onUpdated, onBeforeUpdate, onUnmounted, onBeforeUnmount } = 
        require('vue')
      
      hookSet.forEach(hooks => {
        if (hooks.beforeMount) {
          onBeforeMount(() => hooks.beforeMount!(ctx.proxy || this))
        }
        if (hooks.mounted) {
          onMounted(() => hooks.mounted!(ctx.proxy || this))
        }
        if (hooks.beforeUpdate) {
          onBeforeUpdate(() => hooks.beforeUpdate!(ctx.proxy || this))
        }
        if (hooks.updated) {
          onUpdated(() => hooks.updated!(ctx.proxy || this))
        }
        if (hooks.beforeUnmount) {
          onBeforeUnmount(() => hooks.beforeUnmount!(ctx.proxy || this))
        }
        if (hooks.unmounted) {
          onUnmounted(() => hooks.unmounted!(ctx.proxy || this))
        }
      })
      
      return result
    }
  }
  
  /**
   * 获取所有已注册的组件Hook
   */
  getHooks(componentName: string): Set<ComponentHooks> | undefined {
    return this.hooks.get(componentName)
  }
}

/**
 * Store Hook管理器
 */
export class StoreHookManager {
  private hooks = new Map<string, Set<StoreHooks>>()
  private unwatchFunctions = new Map<string, Set<Function>>()
  
  /**
   * 注册Store Hook
   */
  registerHook(storeName: string, hooks: StoreHooks): UnhookFunction {
    if (!this.hooks.has(storeName)) {
      this.hooks.set(storeName, new Set())
    }
    
    this.hooks.get(storeName)!.add(hooks)
    
    return () => {
      this.hooks.get(storeName)?.delete(hooks)
    }
  }
  
  /**
   * 应用Hook到Store
   */
  applyToStore(store: Store<string, any, any, any>, storeName: string): UnhookFunction {
    const hookSet = this.hooks.get(storeName)
    if (!hookSet || hookSet.size === 0) return () => {}
    
    const unwatchFns: Function[] = []
    
    hookSet.forEach(hooks => {
      // Hook actions
      if (hooks.beforeAction || hooks.afterAction) {
        const originalActions = { ...store }
        
        Object.keys(originalActions).forEach(key => {
          const value = originalActions[key]
          if (typeof value === 'function' && !key.startsWith('$') && !key.startsWith('_')) {
            const originalAction = value.bind(store)
            
            ;(store as any)[key] = async function(...args: any[]) {
              // beforeAction hook
              if (hooks.beforeAction) {
                const shouldContinue = hooks.beforeAction(key, args)
                if (shouldContinue === false) return
              }
              
              // 执行原action
              const result = await originalAction(...args)
              
              // afterAction hook
              if (hooks.afterAction) {
                hooks.afterAction(key, args, result)
              }
              
              return result
            }
          }
        })
      }
      
      // Hook state changes
      if (hooks.onStateChange) {
        const unwatch = store.$subscribe((mutation: any, state: any) => {
          hooks.onStateChange!(state, mutation.storeId)
        })
        unwatchFns.push(unwatch)
      }
    })
    
    // 保存unwatch函数
    if (!this.unwatchFunctions.has(storeName)) {
      this.unwatchFunctions.set(storeName, new Set())
    }
    unwatchFns.forEach(fn => this.unwatchFunctions.get(storeName)!.add(fn))
    
    return () => {
      unwatchFns.forEach(fn => fn())
      unwatchFns.forEach(fn => this.unwatchFunctions.get(storeName)?.delete(fn))
    }
  }
}

/**
 * 服务Hook管理器
 */
export class ServiceHookManager {
  private hooks = new Map<string, Map<string, Set<ServiceHooks>>>()
  
  /**
   * 注册服务函数Hook
   */
  registerHook(servicePath: string, functionName: string, hooks: ServiceHooks): UnhookFunction {
    if (!this.hooks.has(servicePath)) {
      this.hooks.set(servicePath, new Map())
    }
    
    const serviceHooks = this.hooks.get(servicePath)!
    if (!serviceHooks.has(functionName)) {
      serviceHooks.set(functionName, new Set())
    }
    
    serviceHooks.get(functionName)!.add(hooks)
    
    return () => {
      serviceHooks.get(functionName)?.delete(hooks)
    }
  }
  
  /**
   * 应用Hook到服务函数
   */
  applyToService(serviceModule: any, servicePath: string): void {
    const serviceHooks = this.hooks.get(servicePath)
    if (!serviceHooks) return
    
    serviceHooks.forEach((hookSet, functionName) => {
      const originalFunction = serviceModule[functionName]
      if (typeof originalFunction !== 'function') return
      
      // 检查是否有replace hook
      const replaceHook = Array.from(hookSet).find(h => h.replace)
      if (replaceHook?.replace) {
        serviceModule[functionName] = replaceHook.replace
        return
      }
      
      // 应用before/after hooks
      const isAsync = originalFunction.constructor.name === 'AsyncFunction'
      
      if (isAsync) {
        serviceModule[functionName] = createAsyncHookWrapper(
          originalFunction,
          (...args) => {
            let modifiedArgs = args
            hookSet.forEach(hooks => {
              if (hooks.before) {
                const result = hooks.before(...modifiedArgs)
                if (result) modifiedArgs = result
              }
            })
            return modifiedArgs
          },
          (result, ...args) => {
            let modifiedResult = result
            hookSet.forEach(hooks => {
              if (hooks.after) {
                modifiedResult = hooks.after(modifiedResult, ...args)
              }
            })
            return modifiedResult
          }
        )
      } else {
        serviceModule[functionName] = createHookWrapper(
          originalFunction,
          (...args) => {
            let modifiedArgs = args
            hookSet.forEach(hooks => {
              if (hooks.before) {
                const result = hooks.before(...modifiedArgs)
                if (result) modifiedArgs = result
              }
            })
            return modifiedArgs
          },
          (result, ...args) => {
            let modifiedResult = result
            hookSet.forEach(hooks => {
              if (hooks.after) {
                modifiedResult = hooks.after(modifiedResult, ...args)
              }
            })
            return modifiedResult
          }
        )
      }
    })
  }
}

/**
 * 全局Hook引擎
 */
export class HookEngine {
  componentHooks = new ComponentHookManager()
  storeHooks = new StoreHookManager()
  serviceHooks = new ServiceHookManager()
  
  /**
   * 初始化Hook引擎
   */
  initialize(app: App): void {
    // 拦截组件注册
    this.interceptComponentRegistration(app)
  }
  
  /**
   * 拦截组件注册
   */
  private interceptComponentRegistration(app: App): void {
    const originalComponent = app.component.bind(app)
    const self = this
    
    app.component = function(name: string, component?: Component): any {
      if (component) {
        // 注册组件时应用Hook
        self.componentHooks.applyToComponent(component, name)
        return originalComponent(name, component)
      }
      return originalComponent(name)
    }
  }
}
