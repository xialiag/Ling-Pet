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
  getStore: (name: string) => Store<string, any, any, any> | undefined
  
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
  
  /** HTTP 请求 */
  fetch: (url: string, options?: RequestInit) => Promise<Response>
  
  /** 获取应用数据目录 */
  getAppDataDir: () => Promise<string>
  
  /** 文件系统操作 */
  fs: {
    readDir: (path: string) => Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string | Uint8Array) => Promise<void>
    exists: (path: string) => Promise<boolean>
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>
    remove: (path: string) => Promise<void>
  }
  
  // ========== 插件间通信API ==========
  
  /** 订阅事件 */
  on: (event: string, handler: Function) => UnhookFunction
  
  /** 发送事件 */
  emit: (event: string, ...args: any[]) => void
  
  /** 取消订阅 */
  off: (event: string, handler?: Function) => void
  
  /** 发送消息 */
  sendMessage: (to: string | undefined, type: string, data: any) => string
  
  /** 监听消息 */
  onMessage: (handler: (msg: PluginMessage) => void) => UnhookFunction
  
  /** 注册RPC方法 */
  registerRPC: (method: string, handler: Function) => UnhookFunction
  
  /** 调用其他插件的RPC方法 */
  callRPC: <T = any>(pluginId: string, method: string, ...params: any[]) => Promise<T>
  
  /** 创建共享状态 */
  createSharedState: <T = any>(key: string, initialValue: T, options?: SharedStateOptions) => any
  
  /** 获取其他插件的共享状态 */
  getSharedState: <T = any>(pluginId: string, key: string) => T | undefined
  
  // ========== LLM工具API ==========
  
  /** 注册LLM工具 */
  registerTool: (tool: ToolRegistration) => UnhookFunction
  
  /** 调用工具 */
  callTool: <T = any>(name: string, args: Record<string, any>) => Promise<ToolCallResult<T>>
  
  /** 获取所有可用工具 */
  getAvailableTools: () => ToolInfo[]
  
  // ========== 插件设置页面API ==========
  
  /** 注册设置页面操作按钮 */
  registerSettingsAction: (action: PluginSettingsAction) => UnhookFunction
  
  /** 获取插件的所有设置操作 */
  getSettingsActions: () => PluginSettingsAction[]
}

/**
 * 工具注册信息
 */
export interface ToolRegistration {
  name: string
  description: string
  parameters: ToolParameter[]
  handler: (...args: any[]) => Promise<any> | any
  category?: string
  examples?: string[]
}

/**
 * 工具参数定义
 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  enum?: string[]
  properties?: Record<string, ToolParameter>
  items?: ToolParameter
}

/**
 * 工具信息
 */
export interface ToolInfo {
  name: string
  description: string
  parameters: ToolParameter[]
  pluginId: string
  category?: string
  examples?: string[]
}

/**
 * 工具调用结果
 */
export interface ToolCallResult<T = any> {
  success: boolean
  result?: T
  error?: string
  duration: number
}

/**
 * 插件消息
 */
export interface PluginMessage {
  from: string
  to?: string
  type: string
  data: any
  timestamp: number
  id: string
  replyTo?: string
}

/**
 * 共享状态选项
 */
export interface SharedStateOptions {
  readonly?: boolean
  persistent?: boolean
}

/**
 * 插件设置页面操作按钮
 */
export interface PluginSettingsAction {
  /** 按钮文本 */
  label: string
  
  /** 按钮图标（Material Design Icons） */
  icon?: string
  
  /** 按钮颜色 */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  
  /** 按钮样式 */
  variant?: 'elevated' | 'flat' | 'tonal' | 'outlined' | 'text' | 'plain'
  
  /** 点击处理函数 */
  handler: () => Promise<void> | void
  
  /** 是否禁用 */
  disabled?: boolean | (() => boolean)
  
  /** 是否加载中 */
  loading?: boolean | (() => boolean)
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
  
  /** 插件设置页面的自定义操作按钮 */
  settingsActions?: PluginSettingsAction[]
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
  
  /** 注入顺序（数字越小越靠前） */
  order?: number
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

// ========== 增强的插件加载器API ==========

/**
 * 增强的插件API - 用于新的插件加载器
 */
export interface PluginAPI {
  paths: {
    getPluginDir(): string;
    getAssetsDir(): string;
    getDataDir(): string;
    getCacheDir(): string;
    getConfigPath(): string;
    getPluginBackend(): string;
    getLogDir(): string;
  };

  hooks: {
    register(hookName: string, handler: Function): void;
    unregister(hookName: string, handler: Function): void;
  };

  components: {
    register(name: string, component: any): void;
    unregister(name: string): void;
  };

  tools: {
    register(tool: ToolDefinition): void;
    unregister(toolName: string): void;
  };

  backend: {
    load(): Promise<any>;
    unload(): Promise<void>;
    getBackend(): any;
  };

  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    getAll(): Promise<Record<string, any>>;
    setAll(data: Record<string, any>): Promise<void>;
  };

  ui: {
    showNotification(message: string): void;
    showDialog(options: any): Promise<any>;
  };

  logger: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
  };
}

/**
 * 插件上下文 - 插件实例
 */
export interface PluginContextV2 {
  id: string;
  name: string;
  version: string;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
}

/**
 * 插件元数据 - 从package.json读取
 */
export interface PluginMetadataV2 {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  capabilities: {
    hooks?: boolean;
    components?: boolean;
    backend?: boolean;
    tools?: boolean;
  };
  permissions: string[];
  backend?: {
    type: string;
    entry: string;
  };
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterDef>;
  handler: (params: any) => Promise<any>;
  category?: string;
  examples?: string[];
}

/**
 * 工具参数定义
 */
export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}
