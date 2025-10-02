/**
 * 插件API类型定义
 */

import type { App, Component, ComponentPublicInstance } from 'vue'
import type { Store } from 'pinia'
import type { Router } from 'vue-router'

/**
 * 插件上下文 - 提供给插件的API接口
 */
export interface PluginContext {
  /** Vue应用实例 */
  app: App
  
  /** Vue Router实例 */
  router: Router
  
  /** 获取Pinia Store */
  getStore: <T = any>(name: string) => Store<string, any, any, any> | undefined
  
  /** Hook Vue组件 */
  hookComponent: (componentName: string, hooks: ComponentHooks) => UnhookFunction
  
  /** Hook Pinia Store */
  hookStore: (storeName: string, hooks: StoreHooks) => UnhookFunction
  
  /** Hook服务函数 */
  hookService: (servicePath: string, functionName: string, hooks: ServiceHooks) => UnhookFunction
  
  /** 注入新的Vue组件到指定位置 */
  injectComponent: (target: string, component: Component, options?: InjectOptions) => UnhookFunction
  
  /** 包装现有组件 */
  wrapComponent: (componentName: string, wrapper: ComponentWrapper) => UnhookFunction
  
  /** 添加路由 */
  addRoute: (route: PluginRoute) => void
  
  /** 调试日志 */
  debug: (...args: any[]) => void
  
  /** 获取插件配置 */
  getConfig: <T = any>(key: string, defaultValue?: T) => T
  
  /** 保存插件配置 */
  setConfig: (key: string, value: any) => Promise<void>
  
  /** 调用Tauri命令 */
  invokeTauri: <T = any>(command: string, args?: Record<string, any>) => Promise<T>
}

/**
 * 插件定义
 */
export interface PluginDefinition {
  /** 插件名称（唯一标识） */
  name: string
  
  /** 插件版本 */
  version: string
  
  /** 插件描述 */
  description?: string
  
  /** 插件作者 */
  author?: string
  
  /** 依赖的主应用最小版本 */
  minAppVersion?: string
  
  /** 依赖的其他插件 */
  dependencies?: string[]
  
  /** 插件加载时调用 */
  onLoad: (context: PluginContext) => Promise<void> | void
  
  /** 插件卸载时调用 */
  onUnload?: (context: PluginContext) => Promise<void> | void
  
  /** 插件配置Schema（可选） */
  configSchema?: Record<string, any>
}

/**
 * Vue组件Hook
 */
export interface ComponentHooks {
  beforeMount?: (instance: ComponentPublicInstance) => void
  mounted?: (instance: ComponentPublicInstance) => void
  beforeUpdate?: (instance: ComponentPublicInstance) => void
  updated?: (instance: ComponentPublicInstance) => void
  beforeUnmount?: (instance: ComponentPublicInstance) => void
  unmounted?: (instance: ComponentPublicInstance) => void
}

/**
 * Pinia Store Hook
 */
export interface StoreHooks {
  beforeAction?: (name: string, args: any[]) => void | false // 返回false可阻止执行
  afterAction?: (name: string, args: any[], result: any) => void
  onStateChange?: (state: any, oldState: any) => void
}

/**
 * 服务函数Hook
 */
export interface ServiceHooks {
  before?: (...args: any[]) => any[] | void // 可修改参数
  after?: (result: any, ...args: any[]) => any // 可修改返回值
  replace?: (...args: any[]) => any // 完全替换函数
  onError?: (error: Error, ...args: any[]) => void
}

/**
 * 组件注入选项
 */
export interface InjectOptions {
  /** 注入位置 */
  position?: 'before' | 'after' | 'replace'
  
  /** 传递给组件的props */
  props?: Record<string, any>
  
  /** 条件渲染 */
  condition?: () => boolean
}

/**
 * 组件包装器
 */
export type ComponentWrapper = (
  originalComponent: Component,
  context: PluginContext
) => Component

/**
 * 插件路由
 */
export interface PluginRoute {
  path: string
  name?: string
  component: Component
  meta?: Record<string, any>
}

/**
 * 取消Hook的函数
 */
export type UnhookFunction = () => void

/**
 * 插件元数据
 */
export interface PluginMetadata {
  name: string
  version: string
  description?: string
  author?: string
  enabled: boolean
  loaded: boolean
  error?: string
}

/**
 * 符号映射 - 用于开发工具
 */
export interface SymbolMap {
  components: ComponentSymbol[]
  stores: StoreSymbol[]
  services: ServiceSymbol[]
  generatedAt: string
}

export interface ComponentSymbol {
  name: string
  path: string
  props?: string[]
  emits?: string[]
  methods?: string[]
  computed?: string[]
}

export interface StoreSymbol {
  name: string
  path: string
  state?: string[]
  getters?: string[]
  actions?: string[]
}

export interface ServiceSymbol {
  name: string
  path: string
  functions: string[]
}
