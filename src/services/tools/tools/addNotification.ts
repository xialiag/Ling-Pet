import type { ExecToolResult } from '../types'
import type { Tool } from '../types'
import { showNotification } from '../../notificationService'

// 工具：延迟后触发桌面通知（基于 NSPanel 的页面）
export const addNotificationTool: Tool = {
  // 工具名称（供调用器识别）
  name: 'addNotification',
  // 工具描述（中文说明参数与功能）
  description: '参数：延迟时间（秒）, 提醒内容\n  功能：在指定的时间后显示右上角横幅通知',
  // 工具调用实现（解析参数并调度通知）
  async call(delaySecondsRaw, contentRaw): Promise<ExecToolResult> {
    const delaySeconds = Number(delaySecondsRaw)
    const safeDelay = Number.isFinite(delaySeconds) && delaySeconds >= 0 ? delaySeconds : 0
    const content = String(contentRaw ?? '').trim()
    console.log(`addNotificationTool: scheduling notification in ${safeDelay} seconds with content:`, content)

    setTimeout(() => {
      // 触发通知（桌面环境走 Tauri 命令，Web 预览走前端模拟）
      showNotification({ title: '提醒', message: content, duration_ms: 10000 })
        .catch((e: unknown) => console.error('触发通知失败:', e))
    }, safeDelay * 1000)

    return { ok: true, continue: false, result: JSON.stringify({ scheduledInSeconds: safeDelay, content }) }
  },
}
