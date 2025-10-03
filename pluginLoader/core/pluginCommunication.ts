/**
 * 插件间通信系统
 * 提供事件、消息、共享状态、RPC等通信方式
 */

import { reactive, readonly, type UnwrapNestedRefs } from 'vue'

/**
 * 消息类型
 */
export interface PluginMessage {
  from: string           // 发送者插件ID
  to?: string            // 接收者插件ID（可选，不指定则广播）
  type: string           // 消息类型
  data: any              // 消息数据
  timestamp: number      // 时间戳
  id: string             // 消息ID
  replyTo?: string       // 回复的消息ID
}

/**
 * RPC调用请求
 */
export interface RPCRequest {
  id: string
  from: string
  to: string
  method: string
  params: any[]
  timestamp: number
}

/**
 * RPC调用响应
 */
export interface RPCResponse {
  id: string
  success: boolean
  result?: any
  error?: string
}

/**
 * 共享状态配置
 */
export interface SharedStateConfig {
  pluginId: string
  key: string
  initialValue: any
  readonly?: boolean
  persistent?: boolean
}

/**
 * 插件通信管理器
 */
export class PluginCommunicationManager {
  // 事件监听器
  private eventListeners = new Map<string, Map<string, Set<Function>>>()
  
  // 消息监听器
  private messageListeners = new Map<string, Set<(msg: PluginMessage) => void>>()
  
  // RPC方法注册
  private rpcMethods = new Map<string, Map<string, Function>>()
  
  // RPC调用等待队列
  private rpcPending = new Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>()
  
  // 共享状态
  private sharedStates = new Map<string, UnwrapNestedRefs<any>>()
  
  // 消息历史（用于调试）
  private messageHistory: PluginMessage[] = []
  private maxHistorySize = 100
  
  /**
   * 订阅事件
   */
  on(pluginId: string, event: string, handler: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Map())
    }
    
    const eventMap = this.eventListeners.get(event)!
    if (!eventMap.has(pluginId)) {
      eventMap.set(pluginId, new Set())
    }
    
    eventMap.get(pluginId)!.add(handler)
    
    console.log(`[PluginComm] ${pluginId} 订阅事件: ${event}`)
    
    // 返回取消订阅函数
    return () => {
      eventMap.get(pluginId)?.delete(handler)
      console.log(`[PluginComm] ${pluginId} 取消订阅: ${event}`)
    }
  }
  
  /**
   * 发送事件
   */
  emit(pluginId: string, event: string, ...args: any[]): void {
    const eventMap = this.eventListeners.get(event)
    if (!eventMap) return
    
    console.log(`[PluginComm] ${pluginId} 发送事件: ${event}`, args)
    
    // 通知所有订阅者（除了发送者自己）
    eventMap.forEach((handlers, listenerId) => {
      if (listenerId !== pluginId) {
        handlers.forEach(handler => {
          try {
            handler(...args)
          } catch (error) {
            console.error(`[PluginComm] 事件处理错误 ${event}:`, error)
          }
        })
      }
    })
  }
  
  /**
   * 取消订阅
   */
  off(pluginId: string, event: string, handler?: Function): void {
    const eventMap = this.eventListeners.get(event)
    if (!eventMap) return
    
    if (!handler) {
      // 取消该插件对此事件的所有订阅
      eventMap.delete(pluginId)
    } else {
      // 取消特定处理器
      eventMap.get(pluginId)?.delete(handler)
    }
  }
  
  /**
   * 发送消息
   */
  sendMessage(message: Omit<PluginMessage, 'timestamp' | 'id'>): string {
    const fullMessage: PluginMessage = {
      ...message,
      timestamp: Date.now(),
      id: this.generateMessageId()
    }
    
    // 添加到历史
    this.addToHistory(fullMessage)
    
    console.log(`[PluginComm] 消息: ${fullMessage.from} -> ${fullMessage.to || 'broadcast'}`, fullMessage)
    
    // 分发消息
    if (fullMessage.to) {
      // 点对点消息
      const listeners = this.messageListeners.get(fullMessage.to)
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(fullMessage)
          } catch (error) {
            console.error('[PluginComm] 消息处理错误:', error)
          }
        })
      }
    } else {
      // 广播消息
      this.messageListeners.forEach((listeners, pluginId) => {
        if (pluginId !== fullMessage.from) {
          listeners.forEach(listener => {
            try {
              listener(fullMessage)
            } catch (error) {
              console.error('[PluginComm] 消息处理错误:', error)
            }
          })
        }
      })
    }
    
    return fullMessage.id
  }
  
  /**
   * 监听消息
   */
  onMessage(pluginId: string, handler: (msg: PluginMessage) => void): () => void {
    if (!this.messageListeners.has(pluginId)) {
      this.messageListeners.set(pluginId, new Set())
    }
    
    this.messageListeners.get(pluginId)!.add(handler)
    
    console.log(`[PluginComm] ${pluginId} 开始监听消息`)
    
    return () => {
      this.messageListeners.get(pluginId)?.delete(handler)
      console.log(`[PluginComm] ${pluginId} 停止监听消息`)
    }
  }
  
  /**
   * 注册RPC方法
   */
  registerRPC(pluginId: string, method: string, handler: Function): () => void {
    if (!this.rpcMethods.has(pluginId)) {
      this.rpcMethods.set(pluginId, new Map())
    }
    
    this.rpcMethods.get(pluginId)!.set(method, handler)
    
    console.log(`[PluginComm] ${pluginId} 注册RPC方法: ${method}`)
    
    return () => {
      this.rpcMethods.get(pluginId)?.delete(method)
      console.log(`[PluginComm] ${pluginId} 注销RPC方法: ${method}`)
    }
  }
  
  /**
   * 调用RPC方法
   */
  async callRPC(
    from: string,
    to: string,
    method: string,
    params: any[] = [],
    timeout: number = 5000
  ): Promise<any> {
    const request: RPCRequest = {
      id: this.generateMessageId(),
      from,
      to,
      method,
      params,
      timestamp: Date.now()
    }
    
    console.log(`[PluginComm] RPC调用: ${from} -> ${to}.${method}`, params)
    
    // 查找目标插件的方法
    const targetMethods = this.rpcMethods.get(to)
    if (!targetMethods || !targetMethods.has(method)) {
      throw new Error(`RPC方法不存在: ${to}.${method}`)
    }
    
    const handler = targetMethods.get(method)!
    
    // 创建Promise等待响应
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        this.rpcPending.delete(request.id)
        reject(new Error(`RPC调用超时: ${to}.${method}`))
      }, timeout)
      
      // 保存到等待队列
      this.rpcPending.set(request.id, {
        resolve,
        reject,
        timeout: timeoutHandle
      })
      
      // 执行RPC方法
      try {
        Promise.resolve(handler(...params))
          .then(result => {
            const pending = this.rpcPending.get(request.id)
            if (pending) {
              clearTimeout(pending.timeout)
              this.rpcPending.delete(request.id)
              resolve(result)
            }
          })
          .catch(error => {
            const pending = this.rpcPending.get(request.id)
            if (pending) {
              clearTimeout(pending.timeout)
              this.rpcPending.delete(request.id)
              reject(error)
            }
          })
      } catch (error) {
        const pending = this.rpcPending.get(request.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.rpcPending.delete(request.id)
          reject(error)
        }
      }
    })
  }
  
  /**
   * 创建共享状态
   */
  createSharedState<T = any>(config: SharedStateConfig): any {
    const key = `${config.pluginId}:${config.key}`
    
    if (this.sharedStates.has(key)) {
      console.warn(`[PluginComm] 共享状态已存在: ${key}`)
      return this.sharedStates.get(key)
    }
    
    const state = reactive(config.initialValue)
    this.sharedStates.set(key, state)
    
    console.log(`[PluginComm] 创建共享状态: ${key}`)
    
    return config.readonly ? readonly(state) : state
  }
  
  /**
   * 获取共享状态
   */
  getSharedState<T = any>(pluginId: string, key: string): any {
    const fullKey = `${pluginId}:${key}`
    return this.sharedStates.get(fullKey)
  }
  
  /**
   * 删除共享状态
   */
  deleteSharedState(pluginId: string, key: string): boolean {
    const fullKey = `${pluginId}:${key}`
    const deleted = this.sharedStates.delete(fullKey)
    
    if (deleted) {
      console.log(`[PluginComm] 删除共享状态: ${fullKey}`)
    }
    
    return deleted
  }
  
  /**
   * 获取消息历史
   */
  getMessageHistory(filter?: {
    from?: string
    to?: string
    type?: string
    limit?: number
  }): PluginMessage[] {
    let history = [...this.messageHistory]
    
    if (filter) {
      if (filter.from) {
        history = history.filter(msg => msg.from === filter.from)
      }
      if (filter.to) {
        history = history.filter(msg => msg.to === filter.to)
      }
      if (filter.type) {
        history = history.filter(msg => msg.type === filter.type)
      }
      if (filter.limit) {
        history = history.slice(-filter.limit)
      }
    }
    
    return history
  }
  
  /**
   * 清理插件的所有通信资源
   */
  cleanup(pluginId: string): void {
    console.log(`[PluginComm] 清理插件通信资源: ${pluginId}`)
    
    // 清理事件监听
    this.eventListeners.forEach(eventMap => {
      eventMap.delete(pluginId)
    })
    
    // 清理消息监听
    this.messageListeners.delete(pluginId)
    
    // 清理RPC方法
    this.rpcMethods.delete(pluginId)
    
    // 清理共享状态
    const keysToDelete: string[] = []
    this.sharedStates.forEach((_, key) => {
      if (key.startsWith(`${pluginId}:`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.sharedStates.delete(key))
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      events: this.eventListeners.size,
      messageListeners: this.messageListeners.size,
      rpcMethods: Array.from(this.rpcMethods.values()).reduce((sum, map) => sum + map.size, 0),
      sharedStates: this.sharedStates.size,
      messageHistory: this.messageHistory.length,
      pendingRPC: this.rpcPending.size
    }
  }
  
  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * 添加到消息历史
   */
  private addToHistory(message: PluginMessage): void {
    this.messageHistory.push(message)
    
    // 限制历史大小
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift()
    }
  }
}

// 全局通信管理器实例
export const pluginCommunication = new PluginCommunicationManager()
