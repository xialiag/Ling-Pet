import { defineStore } from 'pinia'
import { onTask } from '../services/schedule/onTask'
import { onOutdated } from '../services/schedule/onOutdated'
import { useConversationStore } from './conversation'
import { emitScheduleIdle } from '../services/events/emitters'
import { useSessionStore } from './session'
import { backendChat } from '../services/chat/backendChat'
import { getBackendEventsUserPrompt } from '../services/chat/prompts'

type TaskStatus = 'scheduled' | 'pending' | 'running' | 'outdated' | 'accomplished' | 'canceled'
const DEFAULT_HEARTBEAT_MS = 60000

export interface ScheduleTaskResult {
  type: 'executed' | 'outdated' | 'canceled'
  error?: string
}

export interface ScheduleTaskContent {
  title: string
  motivation: string
  plan: string
  expectedOutcome: string
}

export interface ScheduleTask {
  id: string
  content: ScheduleTaskContent
  scheduledAt: number // 计划执行时间（ms）
  outdatedAt?: number // 过期时间（ms）
  createdAt: number
  startedAt?: number
  finishedAt?: number
  status: TaskStatus
  result?: ScheduleTaskResult
}

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// 中文注释：将毫秒差值格式化为“X小时Y分Z秒前/后”的相对时间文本
function formatRelativeHMS(deltaMs: number): string {
  // 中文注释：正数表示未来（后），负数表示过去（前）
  const suffix = deltaMs >= 0 ? '后' : '前'
  const ms = Math.abs(deltaMs)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const parts: string[] = []
  if (h > 0) parts.push(`${h}小时`)
  if (m > 0) parts.push(`${m}分`)
  if (s > 0 || parts.length === 0) parts.push(`${s}秒`)
  return parts.join('') + suffix
}

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    tasks: [] as ScheduleTask[],
    isBusy: false as boolean,
    heartbeatTimerId: null as number | null,
    heartbeatIntervalMs: DEFAULT_HEARTBEAT_MS as number,
    maxTasksPerBeat: 1 as number,
    // 中文注释：是否在应用初始化（调用 rehydrate 后）自动启动心跳
    HeartbeatOn: false as boolean,
  }),
  // 中文注释：新增 getters，提供心跳运行状态的便捷访问
  getters: {
    // 中文注释：当前心跳是否正在运行
    heartbeatRunning: (state): boolean => state.heartbeatTimerId != null,
    getHeartbeatOn: (state): boolean => state.HeartbeatOn,
  },
  actions: {
    addSchedule(delayMs: number, content: ScheduleTaskContent, options?: { outdatedInMs?: number }): string {
      const now = Date.now()
      const scheduledAt = now + Math.max(0, Math.floor(delayMs || 0))
      const outdatedAt = options?.outdatedInMs != null ? scheduledAt + Math.max(0, Math.floor(options.outdatedInMs)) : undefined
      const task: ScheduleTask = {
        id: genId(),
        content,
        scheduledAt,
        outdatedAt,
        createdAt: now,
        status: 'scheduled',
      }
      this.tasks.push(task)
      return task.id
    },

    cancelSchedule(id: string): void {
      const task = this.tasks.find(t => t.id === id)
      if (!task) return
      if (task.status === 'running') return // 不中断正在运行的任务
      if (task.status === 'accomplished' || task.status === 'canceled') return
      task.status = 'canceled'
      task.finishedAt = Date.now()
      task.result = { type: 'canceled' }
    },

    // 中文注释：删除一个任务（无论其当前状态如何），从任务列表中移除
    deleteSchedule(id: string): boolean {
      const idx = this.tasks.findIndex(t => t.id === id)
      if (idx < 0) return false
      this.tasks.splice(idx, 1)
      return true
    },

    // 中文注释：仅将“任务列表”序列化为 JSON 字符串（不含 meta 信息），支持截取列表最后 N 项，且可将时间字段转为“时分秒”的相对时间文本
    serializeTasksJSON(options?: { pretty?: boolean; max?: number; relativeHMS?: boolean }): string {
      const pretty = options?.pretty !== false
      const max = Number(options?.max)
      const useRelative = options?.relativeHMS === true
      const now = Date.now()
      // 中文注释：按当前内存顺序取最后 N 个（通常越新的在数组末尾）
      const raw = Number.isFinite(max) && max! > 0 ? this.tasks.slice(-Math.floor(max!)) : this.tasks
      // 中文注释：用浅拷贝得到纯数据，必要时将时间字段转为相对时间文本
      const arr = raw.map(t => {
        const copy: any = { ...t }
        if (useRelative) {
          const keys: Array<keyof typeof copy> = ['scheduledAt', 'outdatedAt', 'createdAt', 'startedAt', 'finishedAt']
          for (const k of keys) {
            if (copy[k] != null && typeof copy[k] === 'number') {
              copy[k] = formatRelativeHMS((copy[k] as number) - now)
            }
          }
        }
        return copy
      })
      return JSON.stringify(arr, null, pretty ? 2 : 0)
    },

    rehydrate(): void {
      this.isBusy = false
      const now = Date.now()
      if (this.heartbeatTimerId != null) {
        clearTimeout(this.heartbeatTimerId)
        this.heartbeatTimerId = null
      }
      for (const t of this.tasks) {
        if (t.status === 'running' && !t.finishedAt) {
          // 将悬挂的 running 任务重置，避免卡死
          if (t.outdatedAt && t.outdatedAt <= now) {
            t.status = 'outdated'
          } else {
            t.status = 'pending'
          }
          t.startedAt = undefined
        }
      }
      const stats = this._stats()
      console.log('[schedule] rehydrate done', { now, ...stats })
    },

    startHeartbeat(): void {
      if (this.heartbeatTimerId != null) {
        console.log('[schedule] heartbeat already running')
        return
      }
      this._heartbeatSafe() // 立即执行一次
      console.log('[schedule] heartbeat started', { intervalMs: this.heartbeatIntervalMs })
    },

    stopHeartbeat(): void {
      if (this.heartbeatTimerId != null) {
        clearTimeout(this.heartbeatTimerId)
        this.heartbeatTimerId = null
        console.log('[schedule] heartbeat stopped')
      }
    },

    // 中文注释：设置心跳间隔（毫秒）。可选 restart=true 时若心跳正在运行则重启定时器
    setHeartbeatInterval(ms: number): void {
      // 中文注释：限制最小/最大范围，避免设置过小导致频繁执行或过大失去意义
      const clamped = Math.min(60 * 60 * 1000, Math.max(1000, Math.floor(ms))) // 1s ~ 1h
      if (clamped !== this.heartbeatIntervalMs) {
        this.heartbeatIntervalMs = clamped
        console.log('[schedule] heartbeat interval updated', { intervalMs: clamped })
      }
    },

    // 中文注释：设置是否自动启动心跳；若从 false -> true 且当前未运行，则启动；若从 true -> false 则停止
    setHeartbeatOn(val: boolean): void {
      this.HeartbeatOn = val
      console.log('[schedule] HeartbeatOn set', { value: this.HeartbeatOn })
    },

    _heartbeatSafe(): void {
      try {
        // console.log('[schedule] heartbeat tick', { now: Date.now() })
        if (this.HeartbeatOn) {
          this._heartbeat()
        } else {
          console.log('[schedule] heartbeat skipped because HeartbeatOn is false')
        }
      } catch (e) {
        // 避免异常中断心跳循环
        console.error('schedule heartbeat error:', e)
      }
      this.heartbeatTimerId = window.setTimeout(() => this._heartbeatSafe(), this.heartbeatIntervalMs)
    },

    _heartbeat(): void {
      const now = Date.now()

      // 1) 推进状态：scheduled -> pending / outdated
      for (const t of this.tasks) {
        if (t.status === 'scheduled' && t.scheduledAt <= now) {
          t.status = 'pending'
          console.log('[schedule] task -> pending', { id: t.id, scheduledAt: t.scheduledAt, now })
        }
        if ((t.status === 'scheduled' || t.status === 'pending') && t.outdatedAt != null && t.outdatedAt <= now) {
          t.status = 'outdated'
          console.log('[schedule] task -> outdated', { id: t.id, outdatedAt: t.outdatedAt, now })
        }
      }

      // 若没有未来需要执行的任务（无 scheduled/pending/outdated），发射空闲事件
      const hasFutureTasks = this.tasks.some(t => t.status === 'scheduled' || t.status === 'pending' || t.status === 'outdated')
      if (!hasFutureTasks) {
        emitScheduleIdle({ ts: now }).catch(err => console.warn('[schedule] emit SCHEDULE_IDLE failed', err))
      }
      
      // 仅当不忙且当前没有活跃session才尝试执行任务
      if (this.isBusy || useSessionStore().currentSession.length !== 0) {
        console.log('[schedule] busy, skip this tick: ',{ isBusy: this.isBusy, currentSessionLength: useSessionStore().currentSession.length })
        return
      }

      // 当会话仍有未消费消息（或处于流式中）时，视为外部占用，跳过本次调度
      try {
        const conv = useConversationStore()
        const chatBusy = Boolean(
          conv.isStreaming ||
          (conv.currentMessage && conv.currentMessage.length > 0) ||
          (Array.isArray(conv.responseItems) && conv.responseItems.length > 0)
        )
        if (chatBusy) {
          console.log('[schedule] chat busy, skip this tick')
          return
        }
      } catch (_) {
        // Pinia 可能尚未就绪（极早期），不强制阻塞
      }

      // 2) 选择一个任务执行
      const candidate = this._pickOne(now)
      if (!candidate) {
        // const stats = this._stats()
        console.log('[schedule] no candidate to run, then start backendChat')
        backendChat(getBackendEventsUserPrompt())
        return
      }

      // 3) 执行（严格串行）
      this.isBusy = true
      candidate.status = 'running'
      candidate.startedAt = now
      console.log('[schedule] run start', candidate.content.title, {
        id: candidate.id,
        status: 'running',
        scheduledAt: candidate.scheduledAt,
        outdatedAt: candidate.outdatedAt,
        now,
      })

      ;(async () => {
        try {
          if (candidate.outdatedAt != null && candidate.outdatedAt <= Date.now()) {
            console.log('[schedule] invoking onOutdated', candidate.content.title)
            await onOutdated(candidate.content, { scheduledAt: candidate.scheduledAt, outdatedAt: candidate.outdatedAt })
            candidate.result = { type: 'outdated' }
          } else {
            console.log('[schedule] invoking onTask', candidate.content.title)
            await onTask(candidate.content)
            candidate.result = { type: 'executed' }
          }
        } catch (err: any) {
          const type = (candidate.outdatedAt != null && candidate.outdatedAt <= Date.now()) ? 'outdated' : 'executed'
          candidate.result = { type, error: err?.message ? String(err.message) : String(err) }
        } finally {
          candidate.finishedAt = Date.now()
          candidate.status = 'accomplished'
          console.log('[schedule] run finish', candidate.content.title, {
            id: candidate.id,
            result: candidate.result,
            durationMs: (candidate.finishedAt ?? 0) - (candidate.startedAt ?? 0),
            finishedAt: candidate.finishedAt,
          })
          this.isBusy = false
        }
      })()
    },

    _pickOne(_now: number): ScheduleTask | undefined {
      // 优先 outdated，按 outdatedAt 升序
      const outdated = this.tasks
        .filter(t => t.status === 'outdated')
        .sort((a, b) => (a.outdatedAt ?? Infinity) - (b.outdatedAt ?? Infinity))
      if (outdated.length > 0) return outdated[0]

      // 否则 pending，按 scheduledAt 升序
      const pending = this.tasks
        .filter(t => t.status === 'pending')
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
      return pending[0]
    },
    _stats(): Record<string, number> {
      const counts: Record<string, number> = {
        scheduled: 0,
        pending: 0,
        running: 0,
        outdated: 0,
        accomplished: 0,
        canceled: 0,
        total: this.tasks.length,
      }
      for (const t of this.tasks) counts[t.status]++
      return counts
    },
  },
  tauri: {
    saveOnChange: true,
    saveStrategy: 'debounce',
    saveInterval: 300,
  },
})
