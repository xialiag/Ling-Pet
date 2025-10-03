import { tool } from 'ai'
import { z } from 'zod'
import { showNotification } from '../notificationService'

export const addNotificationTool = tool({
  description: '在指定的时间延迟后显示右上角横幅通知。\n**important**：切记，如果你要跟用户说话，请使用message，而不是这个工具。',
  inputSchema: z.object({
    delaySeconds: z.number().min(0).describe('延迟时间，单位为秒'),
    content: z.string().min(1).describe('提醒内容'),
  }),
  execute: async ({ delaySeconds, content }) => {
    try {
      setTimeout(() => {
        // 触发通知（桌面环境走 Tauri 命令，Web 预览走前端模拟）
        showNotification({ title: '提醒', message: content, duration_ms: 10000 })
          .catch((e: unknown) => console.error('触发通知失败:', e))
      }, delaySeconds * 1000)
      return 'Successfully scheduled notification'
    } catch (error) {
      console.error('添加通知失败:', error)
      return 'Failed to add notification'
    }
  }
})