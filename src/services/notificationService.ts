// 该文件提供跨平台通知横幅的触发接口（仅保留展示方法，隐藏由后端自动处理）
import { invoke } from '@tauri-apps/api/core'
import { type NotificationPayload } from '../stores/notification'

// 定义默认展示时长，避免调用方遗漏
const DEFAULT_DURATION = 4000

// 触发桌面通知横幅
export async function showNotification(payload: Partial<NotificationPayload>) {
  const durationMs = payload.duration_ms ?? DEFAULT_DURATION
  const finalPayload: NotificationPayload = {
    title: payload.title ?? '提示',
    message: payload.message ?? '通知内容',
    duration_ms: durationMs,
    icon: payload.icon
  }

  await invoke('show_notification', { payload: finalPayload })
  console.log('addNotificationTool: notification shown with content:', finalPayload.message)
}
