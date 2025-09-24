// 该文件用于管理通知横幅的全局状态
import { defineStore } from 'pinia'

// 定义通知展示的基础数据结构
export interface NotificationPayload {
  // 通知标题
  title: string
  // 通知正文
  message: string
  // 通知显示时长（毫秒）
  duration_ms: number
  // 可选图标地址
  icon?: string
}

// 通知状态数据结构
interface NotificationState {
  // 当前正在显示的通知
  current: NotificationPayload | null
  // 标记是否处于关闭动画状态
  hiding: boolean
}

// 暴露用于控制通知展示的 Pinia Store
export const useNotificationStore = defineStore('notification', {
  // 初始化通知状态
  state: (): NotificationState => ({
    current: null,
    hiding: false
  }),
  // 定义用于更新通知展示的动作
  actions: {
    // 展示新的通知内容
    show(payload: NotificationPayload) {
      this.current = payload
      this.hiding = false
    },
    // 触发隐藏动画
    startHide() {
      this.hiding = true
    },
    // 清空通知内容
    clear() {
      this.current = null
      this.hiding = false
    }
  }
})
