<template>
  <aside :class="['chat-history-sidebar', { 'is-collapsed': collapsed && !isMobile }]">
    <v-card
      rounded="xl"
      variant="flat"
      class="sidebar-card"
      :class="{ 'sidebar-card--collapsed': collapsed && !isMobile }"
    >
      <div class="sidebar-header">
        <v-btn
          v-if="!isMobile"
          icon
          variant="text"
          color="grey-darken-2"
          @click="emit('toggle-collapse')"
        >
          <v-icon>{{ collapsed ? 'mdi-menu-open' : 'mdi-menu' }}</v-icon>
        </v-btn>
        <div class="sidebar-title">
          <v-icon color="primary">mdi-history</v-icon>
          <span v-if="!collapsed">会话记录</span>
        </div>
        <v-spacer></v-spacer>
        <v-btn
          v-if="isMobile"
          icon
          variant="text"
          color="grey-darken-1"
          @click="emit('close-mobile')"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <div class="sidebar-actions" :class="{ 'sidebar-actions--collapsed': collapsed && !isMobile }">
        <template v-if="collapsed && !isMobile">
          <v-tooltip location="end">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon
                size="small"
                variant="text"
                :disabled="disableNewSession"
                @click="emit('request-new-session')"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </template>
            <span>新建会话</span>
          </v-tooltip>
          <v-tooltip location="end">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon
                size="small"
                variant="text"
                color="error"
                :disabled="disableClear"
                @click="emit('request-clear')"
              >
                <v-icon>mdi-delete-outline</v-icon>
              </v-btn>
            </template>
            <span>清空记录</span>
          </v-tooltip>
        </template>
        <template v-else>
          <v-btn
            prepend-icon="mdi-refresh"
            variant="tonal"
            class="mr-2"
            size="small"
            :disabled="disableNewSession"
            @click="emit('request-new-session')"
          >
            新建会话
          </v-btn>
          <v-btn
            prepend-icon="mdi-delete-outline"
            variant="text"
            color="error"
            size="small"
            :disabled="disableClear"
            @click="emit('request-clear')"
          >
            清空
          </v-btn>
        </template>
      </div>

      <v-divider class="my-2"></v-divider>

      <div class="sidebar-list">
        <v-list density="compact" nav class="py-0">
          <v-list-subheader v-if="!collapsed">历史会话 ({{ historyCount }})</v-list-subheader>
          <template v-for="session in historySessions" :key="`history-${session.index}`">
            <v-list-item
              :value="session.index"
              :active="activeIndex === session.index"
              rounded="lg"
              @click="emit('select-session', session.index)"
              class="sidebar-item"
              :class="{ 'sidebar-item--collapsed': collapsed && !isMobile }"
            >
              <template #prepend>
                <v-avatar size="28" class="mr-2" color="grey-lighten-3">
                  <v-icon size="18" color="grey-darken-2">mdi-chat-outline</v-icon>
                </v-avatar>
              </template>
              <div class="sidebar-item__meta">
                <div class="sidebar-item__title">
                  <span v-if="!collapsed">{{ session.label }}</span>
                  <v-chip
                    v-if="!collapsed"
                    size="x-small"
                    class="ml-1"
                    color="grey-lighten-2"
                    variant="flat"
                  >
                    {{ session.count }}
                  </v-chip>
                </div>
                <v-list-item-subtitle v-if="!collapsed" class="text-caption text-truncate">
                  {{ session.preview }}
                </v-list-item-subtitle>
              </div>
            </v-list-item>
          </template>

          <v-divider class="my-2"></v-divider>

          <v-list-subheader v-if="!collapsed">当前会话</v-list-subheader>
          <v-list-item
            :active="activeIndex === -1"
            rounded="lg"
            class="sidebar-item sidebar-item--current"
            :class="{ 'sidebar-item--collapsed': collapsed && !isMobile }"
            @click="emit('select-session', -1)"
          >
            <template #prepend>
              <v-avatar size="28" class="mr-2" color="primary">
                <v-icon size="18" color="white">mdi-pencil</v-icon>
              </v-avatar>
            </template>
            <div class="sidebar-item__meta">
              <div class="sidebar-item__title">
                <span v-if="!collapsed">当前会话</span>
                <v-chip v-if="!collapsed" size="x-small" color="primary" variant="flat" class="ml-1">
                  {{ currentCount }}
                </v-chip>
              </div>
              <v-list-item-subtitle v-if="!collapsed" class="text-caption text-truncate">
                {{ currentPreview }}
              </v-list-item-subtitle>
            </div>
          </v-list-item>
        </v-list>
      </div>
    </v-card>
  </aside>
</template>

<script setup lang="ts">
// 中文注释：引入组合式API辅助函数
import { computed } from 'vue'

// 中文注释：定义侧边栏条目的结构声明
export type SidebarSession = {
  label: string
  time: string
  index: number
  isCurrent: boolean
  count: number
  preview: string
}

// 中文注释：声明组件可接收的属性与状态
const props = defineProps<{
  sessions: SidebarSession[]
  activeIndex: number
  collapsed: boolean
  isMobile: boolean
  disableClear: boolean
  disableNewSession: boolean
}>()

// 中文注释：声明组件向外抛出的事件
const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'select-session', index: number): void
  (e: 'request-clear'): void
  (e: 'request-new-session'): void
  (e: 'close-mobile'): void
}>()

// 中文注释：通过计算属性拆分历史会话与当前会话信息
const historySessions = computed(() => props.sessions.filter((item) => !item.isCurrent))

// 中文注释：获取历史会话的数量
const historyCount = computed(() => historySessions.value.length)

// 中文注释：查找当前会话摘要数据
const currentSessionInfo = computed(() => props.sessions.find((item) => item.isCurrent))

// 中文注释：当前会话消息条数
const currentCount = computed(() => currentSessionInfo.value?.count ?? 0)

// 中文注释：当前会话预览文本
const currentPreview = computed(() => currentSessionInfo.value?.preview ?? '（空）')
</script>

<style scoped>
.chat-history-sidebar {
  width: 320px;
  height: 100%;
  transition: width 0.2s ease;
}

.chat-history-sidebar.is-collapsed {
  width: 96px;
}

.sidebar-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-card--collapsed {
  align-items: center;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #37474f;
}

.sidebar-actions {
  display: flex;
  align-items: center;
  padding: 0 16px 8px;
}

.sidebar-actions--collapsed {
  flex-direction: column;
  gap: 8px;
  padding: 0 0 8px;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

.sidebar-item {
  transition: background-color 0.2s ease;
}

.sidebar-item--collapsed {
  justify-content: center;
}

.sidebar-item__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar-item__title {
  display: flex;
  align-items: center;
}

.sidebar-item--current {
  border: 1px solid rgba(63, 81, 181, 0.12);
}

@media (max-width: 960px) {
  .chat-history-sidebar,
  .chat-history-sidebar.is-collapsed {
    width: 100%;
  }

  .sidebar-card {
    border-radius: 0;
    height: 100%;
  }
}
</style>
