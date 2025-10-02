/**
 * 插件API - 提供给插件开发者使用的工具函数
 */

import type { PluginDefinition } from '../types/api'

/**
 * 定义插件
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition
}

/**
 * 创建Hook包装器
 */
export function createHookWrapper<T extends (...args: any[]) => any>(
  original: T,
  before?: (...args: any[]) => any[] | void,
  after?: (result: any, ...args: any[]) => any
): T {
  return ((...args: any[]) => {
    try {
      // 执行before hook，可能修改参数
      const modifiedArgs = before ? before(...args) : undefined
      const finalArgs = modifiedArgs || args
      
      // 执行原函数
      const result = original(...finalArgs)
      
      // 执行after hook，可能修改返回值
      return after ? after(result, ...finalArgs) : result
    } catch (error) {
      console.error('[Plugin Hook Error]', error)
      throw error
    }
  }) as T
}

/**
 * 创建异步Hook包装器
 */
export function createAsyncHookWrapper<T extends (...args: any[]) => Promise<any>>(
  original: T,
  before?: (...args: any[]) => Promise<any[] | void> | any[] | void,
  after?: (result: any, ...args: any[]) => Promise<any> | any
): T {
  return (async (...args: any[]) => {
    try {
      // 执行before hook
      const modifiedArgs = before ? await before(...args) : undefined
      const finalArgs = modifiedArgs || args
      
      // 执行原函数
      const result = await original(...finalArgs)
      
      // 执行after hook
      return after ? await after(result, ...finalArgs) : result
    } catch (error) {
      console.error('[Plugin Async Hook Error]', error)
      throw error
    }
  }) as T
}

/**
 * 深度代理对象，用于拦截属性访问
 */
export function createDeepProxy<T extends object>(
  target: T,
  handler: {
    get?: (target: any, prop: string | symbol, receiver: any) => any
    set?: (target: any, prop: string | symbol, value: any, receiver: any) => boolean
  }
): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      
      if (handler.get) {
        return handler.get(target, prop, receiver)
      }
      
      // 如果是对象，递归代理
      if (value && typeof value === 'object') {
        return createDeepProxy(value, handler)
      }
      
      return value
    },
    set(target, prop, value, receiver) {
      if (handler.set) {
        return handler.set(target, prop, value, receiver)
      }
      return Reflect.set(target, prop, value, receiver)
    }
  })
}

/**
 * 安全执行插件代码
 */
export async function safeExecute<T>(
  fn: () => T | Promise<T>,
  errorHandler?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[Plugin Safe Execute Error]', err)
    errorHandler?.(err)
    return undefined
  }
}

/**
 * 事件总线 - 用于插件间通信
 */
export class PluginEventBus {
  private listeners = new Map<string, Set<Function>>()
  
  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    
    // 返回取消监听函数
    return () => {
      this.listeners.get(event)?.delete(handler)
    }
  }
  
  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`[Plugin Event Error] ${event}`, error)
        }
      })
    }
  }
  
  off(event: string, handler?: Function): void {
    if (!handler) {
      this.listeners.delete(event)
    } else {
      this.listeners.get(event)?.delete(handler)
    }
  }
}
