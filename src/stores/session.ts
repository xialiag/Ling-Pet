// 中文注释: 引入必要的依赖
import { defineStore } from 'pinia'
import { ModelMessage } from 'ai';
import { backendChat } from '../services/chat/backendChat';
import { getBackendSessionUserPrompt } from '../services/chat/prompts';

// 历史会话结构，可按需扩展元数据（标题、摘要等）
type HistorySession = {
  closedAt: string
  messages: ModelMessage[]
}

export const useSessionStore = defineStore('session', {
  // 仅保留核心字段: 当前会话、历史会话、不活跃超时与内部计时器
  state: () => ({
    currentSession: [] as ModelMessage[],
    historySessions: [] as HistorySession[],
    backendSessions: [] as HistorySession[],
    inactivityTimeoutMs: 3 * 60 * 1000, // 默认 3 分钟不活跃分割
    _inactivityTimer: null as number | null,
  }),
  actions: {
    // 添加消息，并重新启动不活跃计时
    addMessage(message: ModelMessage) {
      this.currentSession.push(message as any)
      this._restartTimer()
    },
    addBackendSession(session: ModelMessage[]) {
      this.backendSessions.push({
        closedAt: new Date().toISOString(),
        messages: session as any[],
      });
    },
    // 中文注释
    // 归档当前会话并清空；若为空则忽略
    newSession() {
      if (this.currentSession.length > 0) {
        this.historySessions.push({
          closedAt: new Date().toISOString(),
          messages: this.currentSession,
        })
        backendChat(
          getBackendSessionUserPrompt((this.currentSession as any).slice(2))
        )
        this.currentSession = []
      }
      this._clearTimer()
    },
    // 删除 index 及之后的消息，并重置计时器（视作一次活动）
    deleteMessageAndAfter(index: number) {
      this.currentSession = this.currentSession.slice(0, index)
      this._restartTimer()
    },
    // 清空所有会话（当前与历史），并清除计时器
    clearAll() {
      this.currentSession = []
      this.historySessions = []
      this._clearTimer()
    },
    // 内部: 重启计时器
    _restartTimer() {
      if (this.inactivityTimeoutMs <= 0) return
      this._clearTimer()
      this._inactivityTimer = window.setTimeout(() => {
        if (this.currentSession.length > 0) {
          this.newSession()
        } else {
          this._clearTimer()
        }
      }, this.inactivityTimeoutMs)
    },
    // 内部: 清除计时器
    _clearTimer() {
      if (this._inactivityTimer != null) {
        clearTimeout(this._inactivityTimer)
        this._inactivityTimer = null
      }
    },
  },
  tauri: {
    saveOnChange: true,
    saveStrategy: 'debounce',
    saveInterval: 500,
  },
})