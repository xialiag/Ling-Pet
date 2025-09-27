<template>
  <header class="chat-history-toolbar">
    <div class="toolbar-left">
      <v-btn
        icon
        variant="text"
        color="primary"
        @click="emit('toggle-sidebar')"
      >
        <v-icon>
          {{ isMobile ? 'mdi-menu' : sidebarCollapsed ? 'mdi-menu-open' : 'mdi-menu' }}
        </v-icon>
      </v-btn>
      <div class="toolbar-title">
        <h2 class="text-h6 mb-1">{{ sessionTitle }}</h2>
        <p class="text-caption text-medium-emphasis">
          共 {{ messageCount }} 条消息
        </p>
      </div>
    </div>
    <div class="toolbar-right">
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<script setup lang="ts">
// 中文注释：定义工具栏展示所需的属性
import { toRefs } from 'vue'

const props = defineProps<{
  sessionTitle: string
  messageCount: number
  isMobile: boolean
  sidebarCollapsed: boolean
}>()

// 中文注释：声明向父组件派发的事件
const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
}>()

// 中文注释：使用 props 防止未使用报错
const { isMobile, sidebarCollapsed, sessionTitle, messageCount } = toRefs(props)
</script>

<style scoped>
.chat-history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background-color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title h2 {
  font-weight: 600;
  color: #263238;
}

.toolbar-title p {
  margin: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

@media (max-width: 600px) {
  .chat-history-toolbar {
    padding: 12px 16px;
  }
}
</style>
