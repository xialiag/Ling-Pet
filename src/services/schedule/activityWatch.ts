// 该文件提供与 ActivityWatch 服务交互的最小 API 封装：
// - GET /api/0/buckets
// - GET /api/0/buckets/{bucket_id}/events

// 在这里约定与项目现有风格一致：使用单引号、两空格缩进、无分号，
// 并优先通过 Tauri 的 HTTP 插件发起请求（可规避 CORS），失败时回退到浏览器 fetch。
import { fetch } from '@tauri-apps/plugin-http'

// ----------------------------- 类型定义 -----------------------------
// 下方类型尽量贴近 ActivityWatch 的通用结构，字段做成可选以增强兼容性。
export interface AWBucket {
  // 桶 ID，例如：'aw-watcher-window_dada@macbook'
  id: string
  // 插件名，例如：'aw-watcher-window'
  type?: string
  // 桶的客户端信息
  client?: string
  // 创建时间
  created?: string
  // 最后一次更新
  last_updated?: string
  // 标签等元信息
  label?: string
  // 任意扩展字段
  [k: string]: any
}

export interface AWEvent<T = any> {
  // 事件开始时间（ISO8601）
  timestamp: string
  // 事件持续时长（秒）
  duration?: number
  // 事件数据体
  data?: T
  // 任意扩展字段
  [k: string]: any
}

export interface GetEventsParams {
  // 起始时间，可传 Date 或 ISO8601 字符串
  start?: Date | string
  // 结束时间，可传 Date 或 ISO8601 字符串
  end?: Date | string
  // 限制条数
  limit?: number
  // 偏移量
  offset?: number
  // 是否按时间倒序（ActivityWatch 通常支持 sort=desc）
  sort?: 'asc' | 'desc'
}

// 为 getRecentEvents 设计的返回类型，仅保留相对时间字段
export interface AWRecentEvent<T = any> {
  // 事件相对时间，如“5分钟前/2天前”
  relativeTime: string
  // 常见字段：id、duration、data 仍然保留
  id?: number | string
  duration?: number
  data?: T
  // 其他扩展字段透传（例如 window watcher 的 app/window 等）
  [k: string]: any
}

// ----------------------------- 配置项 -----------------------------
// 默认服务地址为本地 aw-server（常见默认端口 5600）。
const DEFAULT_BASE_URL = 'http://127.0.0.1:5600'

// 可选：允许通过全局变量或环境变量覆盖（例如在 Tauri 配置或应用设置中写入）。
// 这里做一个简易读取，如果不存在则回退到默认值。
// 注意：若未来你将其移动到可配置的设置中心，请在此接入对应 store。
const activityWatchBaseURL: string = (globalThis as any).__AW_BASE_URL__
  || (import.meta as any).env?.VITE_AW_BASE_URL
  || DEFAULT_BASE_URL

// 将 Date | string 规范化为 ISO8601 字符串
function toISO(val?: Date | string): string | undefined {
  if (!val) return undefined
  if (typeof val === 'string') return val
  try { return val.toISOString() } catch { return undefined }
}

// 拼接查询参数的小工具
function withQuery(url: string, params: Record<string, any | undefined>): string {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    usp.set(k, String(v))
  })
  const qs = usp.toString()
  return qs ? `${url}?${qs}` : url
}

// ----------------------------- API 函数 -----------------------------
// 获取所有 buckets
export async function listBuckets(baseURL: string = activityWatchBaseURL): Promise<AWBucket[]> {
  const url = `${baseURL}/api/0/buckets`
  const resp = await fetch(url, { method: 'GET' })
  if (!resp.ok) {
    throw new Error(`ActivityWatch listBuckets 失败：${resp.status} ${resp.statusText}`)
  }
  return await resp.json()
}

// 获取指定 bucket 的 events，支持可选查询参数
export async function getBucketEvents(
  bucketId: string,
  params: GetEventsParams = {},
  baseURL: string = activityWatchBaseURL
): Promise<AWEvent[]> {
  if (!bucketId) throw new Error('bucketId 不能为空')
  const path = `${baseURL}/api/0/buckets/${encodeURIComponent(bucketId)}/events`
  const url = withQuery(path, {
    start: toISO(params.start),
    end: toISO(params.end),
    limit: params.limit,
    offset: params.offset,
    sort: params.sort,
  })
  const resp = await fetch(url, { method: 'GET' })
  if (!resp.ok) {
    throw new Error(`ActivityWatch getBucketEvents 失败：${resp.status} ${resp.statusText}`)
  }
  return await resp.json()
}

// ----------------------------- 便捷导出 -----------------------------
// 简单的默认导出，便于按需解构或整体引入。
const ActivityWatch = {
  baseURL: activityWatchBaseURL,
  listBuckets,
  getBucketEvents,
}

export default ActivityWatch

// ----------------------------- 便捷函数：最近一段时间的事件 -----------------------------
// 该函数按“bucketId + 最近分钟数”筛选事件，优先使用服务端的 start/end 过滤，
// 同时在客户端再次校验时间边界以保证稳健性。
export async function getRecentEvents(
  bucketId: string,
  pastMinutes: number,
  baseURL: string = activityWatchBaseURL
): Promise<AWRecentEvent[]> {
  // 参数校验：bucketId 必填，pastMinutes 需为正数
  if (!bucketId) throw new Error('bucketId 不能为空')
  if (!Number.isFinite(pastMinutes) || pastMinutes <= 0) {
    throw new Error('pastMinutes 必须为正数')
  }

  // 计算时间窗：结束为当前时间，开始为过去 N 分钟
  const end = new Date()
  const start = new Date(end.getTime() - pastMinutes * 60 * 1000)

  // 服务端过滤：携带 start/end；适度给出较大的 limit 以覆盖常见场景
  const serverEvents = await getBucketEvents(bucketId, {
    start,
    end,
    // 经验值：通常窗口 watcher 每分钟触发有限事件；此处默认 5000 作为上限
    limit: 5000,
    sort: 'desc',
  }, baseURL)

  // 客户端再校验：确保时间戳严格落在区间内
  const startMs = start.getTime()
  const endMs = end.getTime()
  // 仅保留时间窗内的事件
  const filtered = serverEvents.filter(e => {
    const t = Date.parse(e.timestamp)
    return Number.isFinite(t) && t >= startMs && t <= endMs
  })

  // 仅保留相对时间：去掉原始 timestamp/timestampISO 字段
  const now = Date.now()
  return filtered.map(e => {
    const { timestamp: iso, ...rest } = e
    const rel = formatRelativeTime(iso, now)
    const out: AWRecentEvent = { ...rest, relativeTime: rel }
    return out
  })
}

// 将绝对时间转为中文相对时间，精确到秒：
// 例如 “37秒前/12分5秒前/3小时01分09秒前/2天3小时4分8秒前/1年2个月3天...”
function formatRelativeTime(iso: string, nowMs: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  let diff = Math.max(0, Math.floor((nowMs - t) / 1000))

  const YEAR = 365 * 24 * 3600
  const MONTH = 30 * 24 * 3600
  const DAY = 24 * 3600
  const HOUR = 3600
  const MIN = 60

  const y = Math.floor(diff / YEAR); diff -= y * YEAR
  const mo = Math.floor(diff / MONTH); diff -= mo * MONTH
  const d = Math.floor(diff / DAY); diff -= d * DAY
  const h = Math.floor(diff / HOUR); diff -= h * HOUR
  const m = Math.floor(diff / MIN); diff -= m * MIN
  const s = diff

  const parts: string[] = []
  if (y) parts.push(`${y}年`)
  if (mo) parts.push(`${mo}个月`)
  if (d) parts.push(`${d}天`)
  // 小时/分/秒始终展示到秒，但跳过前导 0 的大单位以避免噪音
  if (h) parts.push(`${h}小时`)
  if (m || (!y && !mo && !d && !h)) parts.push(`${m}分`)
  parts.push(`${s}秒`)

  return parts.join('') + '前'
}
