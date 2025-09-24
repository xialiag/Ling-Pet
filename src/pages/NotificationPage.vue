<!-- 该模板负责渲染通知横幅页面 -->
<template>
  <div
    class="notification-container"
    :class="{ 'is-visible': isVisible, 'is-hiding': notificationStore.hiding }"
  >
    <div v-if="notificationStore.current" class="notification-card">
      <div class="notification-content">
        <h2 class="notification-title">{{ notificationStore.current.title }}</h2>
        <p class="notification-message">{{ notificationStore.current.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 该脚本负责订阅原生事件并驱动通知状态（启动即加载，无需 ready 握手）
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useNotificationStore, type NotificationPayload } from '../stores/notification'

const notificationStore = useNotificationStore()
const isVisible = computed(() => Boolean(notificationStore.current))
const unlistenFns: UnlistenFn[] = []

onMounted(async () => {
  // 先注册监听，避免在发送 ready 后错过首条 show 事件
  const showUnlisten = await listen<NotificationPayload>('notification://show', event => {
    notificationStore.show(event.payload)
  })
  unlistenFns.push(showUnlisten)

  const hideUnlisten = await listen('notification://hide', () => {
    notificationStore.startHide()
    setTimeout(() => notificationStore.clear(), 260)
  })
  unlistenFns.push(hideUnlisten)

  // 启动即初始化完成：无需向后端发送 ready 事件
})

onBeforeUnmount(() => {
  unlistenFns.forEach(stop => stop())
})
</script>

<style scoped>
/* 该样式块确保通知窗口固定右上角，并添加“自右向左”滑入/滑出动效 */
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  pointer-events: none;
  opacity: 0;
  /* 初始在屏幕右侧之外，等待滑入 */
  transform: translateX(120%);
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
  width: 320px;
  max-width: calc(100vw - 40px);
  display: flex;
  justify-content: flex-end;
  will-change: transform, opacity;
}

.notification-container.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.notification-container.is-hiding {
  opacity: 0;
  transform: translateX(120%);
}

.notification-card {
  pointer-events: auto;
  background: rgba(30, 30, 30, 0.92);
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  padding: 16px 20px;
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 优化无动画偏好：仅使用淡入淡出 */
@media (prefers-reduced-motion: reduce) {
  .notification-container {
    transition: opacity 0.2s ease;
    transform: none;
  }
  .notification-container.is-visible,
  .notification-container.is-hiding {
    transform: none;
  }
}

.notification-title {
  font-size: 16px;
  margin-bottom: 6px;
  font-weight: 600;
}

.notification-message {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
}
</style>
