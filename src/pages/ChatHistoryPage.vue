<template>
  <div class="chat-history-page">
    <transition name="slide-y-transition">
      <v-alert
        v-if="vitsWarning"
        type="warning"
        class="vits-warning-alert"
        variant="outlined"
        density="comfortable"
        icon="mdi-volume-off"
        closable
        @click:close="vitsWarning = false"
      >
        语音播放尚未实现（TODO）
      </v-alert>
    </transition>

    <ChatHistoryToolbar
      :session-title="sessionTitle"
      :message-count="displayedMessages.length"
      :is-mobile="isMobile"
      :sidebar-collapsed="sidebarCollapsed"
      @toggle-sidebar="handleToggleSidebar"
    >
      <template #actions>
        <v-btn
          class="mr-2"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-refresh"
          size="small"
          :disabled="disableNewSession"
          @click="archiveCurrentSession"
        >
          归档当前
        </v-btn>
        <v-btn
          variant="text"
          color="error"
          prepend-icon="mdi-delete-outline"
          size="small"
          :disabled="disableClear"
          @click="clearDialog = true"
        >
          清空全部
        </v-btn>
      </template>
    </ChatHistoryToolbar>

    <div class="chat-history-body">
      <transition name="sidebar-collapse">
        <ChatHistorySidebar
          v-if="!isMobile"
          :sessions="sidebarSessions"
          :active-index="activeSessionIndex"
          :collapsed="sidebarCollapsed"
          :is-mobile="false"
          :disable-clear="disableClear"
          :disable-new-session="disableNewSession"
          @toggle-collapse="toggleSidebarCollapse"
          @select-session="selectSession"
          @request-clear="clearDialog = true"
          @request-new-session="archiveCurrentSession"
        />
      </transition>

      <div class="chat-history-content" :class="{ 'chat-history-content--full': isMobile }">
        <div class="chat-history-panel">
          <ChatHistoryMessageList
            :messages="displayedMessages"
            :allow-delete="activeSessionIndex === -1"
            :playing-index="playingIndex"
            @request-delete="showDeleteDialog"
            @request-play="playVoice"
          />
        </div>
      </div>
    </div>

    <v-overlay
      v-if="isMobile"
      v-model="sidebarDrawer"
      class="chat-history-overlay"
      scrim="rgba(15, 23, 42, 0.55)"
      @click:outside="sidebarDrawer = false"
    >
      <div class="chat-history-overlay__panel">
        <ChatHistorySidebar
          :sessions="sidebarSessions"
          :active-index="activeSessionIndex"
          :collapsed="false"
          :is-mobile="true"
          :disable-clear="disableClear"
          :disable-new-session="disableNewSession"
          @select-session="handleMobileSelect"
          @request-clear="handleMobileClear"
          @request-new-session="handleMobileNewSession"
          @close-mobile="sidebarDrawer = false"
        />
      </div>
    </v-overlay>

    <v-dialog v-model="clearDialog" max-width="320">
      <v-card>
        <v-card-title class="text-h6">确认清空</v-card-title>
        <v-card-text>确定要清空所有聊天记录吗？此操作不可恢复。</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="clearDialog = false">取消</v-btn>
          <v-btn color="error" variant="text" @click="handleClear">清空</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="360">
      <v-card>
        <v-card-title class="text-h6">确认删除</v-card-title>
        <v-card-text>
          确定要删除这条消息及其后续所有消息吗？此操作不可恢复。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog = false">取消</v-btn>
          <v-btn color="error" variant="text" @click="handleDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
// 中文注释：引入组合式 API 与 Vuetify 响应式工具
import { ref, computed, watch } from 'vue'
import { useDisplay } from 'vuetify'

// 中文注释：引入拆分后的页面组件
import ChatHistorySidebar, { type SidebarSession } from '../components/chatHistory/ChatHistorySidebar.vue'
import ChatHistoryToolbar from '../components/chatHistory/ChatHistoryToolbar.vue'
import ChatHistoryMessageList from '../components/chatHistory/ChatHistoryMessageList.vue'

// 中文注释：引入会话状态管理 Store
import { useSessionStore } from '../stores/session'

// 中文注释：初始化会话 Store 实例
const sessionStore = useSessionStore()

// 中文注释：记录当前激活的会话索引（-1 表示当前会话）
const activeSessionIndex = ref(-1)

// 中文注释：控制桌面端侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 中文注释：控制移动端抽屉开关
const sidebarDrawer = ref(false)

// 中文注释：弹窗与语音提醒相关状态
const clearDialog = ref(false)
const deleteDialog = ref(false)
const deleteIndex = ref(-1)
const playingIndex = ref<string | null>(null)
const vitsWarning = ref(false)

// 中文注释：使用 Vuetify 的断点信息判断是否为移动端
const display = useDisplay()
const isMobile = computed(() => display.mdAndDown.value)

// 中文注释：监听端类型变化以自动关闭抽屉
watch(isMobile, (mobile) => {
  if (!mobile) {
    sidebarDrawer.value = false
  }
})

// 中文注释：同步历史会话长度，防止索引越界
watch(
  () => sessionStore.historySessions.length,
  (historyLength) => {
    if (activeSessionIndex.value >= historyLength) {
      activeSessionIndex.value = -1
    }
  },
  { immediate: true }
)

// 中文注释：生成当前展示的消息数组
const displayedMessages = computed(() => {
  if (activeSessionIndex.value === -1) return sessionStore.currentSession
  return sessionStore.historySessions[activeSessionIndex.value]?.messages ?? []
})

// 中文注释：构造侧边栏所需的会话摘要数据
const sidebarSessions = computed((): SidebarSession[] => {
  const history = (sessionStore.historySessions as any[]).map((session: any, index: number) => ({
    label: `历史 #${index + 1}`,
    time: session.closedAt,
    index,
    isCurrent: false,
    count: session.messages.length,
    preview: buildPreview(session.messages[0]?.content),
  })) as SidebarSession[]

  const currentSession: SidebarSession = {
    label: '当前会话',
    time: '',
    index: -1,
    isCurrent: true,
    count: sessionStore.currentSession.length,
    preview: buildPreview((sessionStore.currentSession as any[])[0]?.content),
  }

  return [...history, currentSession]
})

// 中文注释：根据选中索引生成主区域标题
const sessionTitle = computed(() => (activeSessionIndex.value === -1 ? '当前会话' : `历史会话 #${activeSessionIndex.value + 1}`))

// 中文注释：禁用归档按钮的条件（当前会话为空）
const disableNewSession = computed(() => sessionStore.currentSession.length === 0)

// 中文注释：禁用清空按钮的条件（无历史且当前为空）
const disableClear = computed(() => sessionStore.historySessions.length === 0 && sessionStore.currentSession.length === 0)

// 中文注释：构造消息预览字符串
function buildPreview(rawContent: any): string {
  if (!rawContent) return '（空）'
  if (typeof rawContent === 'string') return rawContent.slice(0, 18)
  try {
    return JSON.stringify(rawContent).slice(0, 18)
  } catch (error) {
    console.warn('生成预览失败:', error)
    return '（空）'
  }
}

// 中文注释：切换桌面侧边栏折叠或移动端抽屉
function handleToggleSidebar() {
  if (isMobile.value) {
    sidebarDrawer.value = !sidebarDrawer.value
    return
  }
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 中文注释：响应侧边栏组件的折叠事件
function toggleSidebarCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 中文注释：切换选中的会话索引
function selectSession(index: number) {
  if (index === -1) {
    activeSessionIndex.value = -1
    return
  }
  if (sessionStore.historySessions[index]) {
    activeSessionIndex.value = index
  } else {
    activeSessionIndex.value = -1
  }
}

// 中文注释：移动端选择会话后需要关闭抽屉
function handleMobileSelect(index: number) {
  selectSession(index)
  sidebarDrawer.value = false
}

// 中文注释：移动端触发清空时关闭抽屉并打开确认框
function handleMobileClear() {
  sidebarDrawer.value = false
  clearDialog.value = true
}

// 中文注释：移动端触发归档时同步关闭抽屉
function handleMobileNewSession() {
  sidebarDrawer.value = false
  archiveCurrentSession()
}

// 中文注释：归档当前会话并重置选中状态
function archiveCurrentSession() {
  if (disableNewSession.value) return
  sessionStore.newSession()
  activeSessionIndex.value = -1
}

// 中文注释：打开删除确认弹框
function showDeleteDialog(index: number) {
  deleteIndex.value = index
  deleteDialog.value = true
}

// 中文注释：执行删除操作（仅允许删除当前会话）
function handleDelete() {
  if (deleteIndex.value >= 0 && activeSessionIndex.value === -1) {
    sessionStore.deleteMessageAndAfter(deleteIndex.value)
  } else if (deleteIndex.value >= 0) {
    console.warn('历史会话不支持直接删除消息')
  }
  deleteDialog.value = false
  deleteIndex.value = -1
}

// 中文注释：清空所有会话记录
function handleClear() {
  sessionStore.clearAll()
  activeSessionIndex.value = -1
  clearDialog.value = false
}

// 中文注释：触发语音播放占位逻辑
function playVoice(payload: { text: string; key: string }) {
  const { text, key } = payload
  if (playingIndex.value === key) return
  playingIndex.value = key
  console.warn('TODO: 语音播放尚未实现。文本：', text)
  vitsWarning.value = true
  window.setTimeout(() => {
    vitsWarning.value = false
  }, 2500)
  window.setTimeout(() => {
    if (playingIndex.value === key) {
      playingIndex.value = null
    }
  }, 800)
}
</script>

<style scoped>
/* 中文注释：整体背景与高度设置 */
.chat-history-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f2f5fb 0%, #ffffff 60%);
}

/* 中文注释：主体区域对齐并取消底部空白 */
.chat-history-body {
  flex: 1;
  display: flex;
  gap: 24px;
  padding: 16px 24px;
  align-items: stretch;
  min-height: 0;
}

/* 中文注释：主消息区域自适应宽度 */
.chat-history-content {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* 中文注释：移动端铺满宽度 */
.chat-history-content--full {
  margin-left: 0;
}

/* 中文注释：消息面板基础样式 */
.chat-history-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: #ffffff;
  border-radius: 24px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
  padding: 0;
  overflow: hidden;
}

/* 中文注释：侧边栏过渡动画 */
.sidebar-collapse-enter-active,
.sidebar-collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* 中文注释：侧边栏过渡初末状态 */
.sidebar-collapse-enter-from,
.sidebar-collapse-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

/* 中文注释：顶部语音提醒样式 */
.vits-warning-alert {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 240px;
  max-width: 90vw;
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(255, 193, 7, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06);
  font-weight: 500;
  letter-spacing: 0.3px;
  background-color: #fff8e1 !important;
  border-color: #ffc107 !important;
}

/* 中文注释：移动端侧边栏遮罩与容器 */
.chat-history-overlay :deep(.v-overlay__content) {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
}

.chat-history-overlay__panel {
  width: min(360px, 90vw);
  height: 100%;
  display: flex;
  background-color: #ffffff;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
  border-radius: 0 24px 24px 0;
  overflow: hidden;
}

/* 中文注释：大屏与中屏调整 */
@media (max-width: 1280px) {
  .chat-history-body {
    padding: 12px 16px;
    gap: 20px;
  }
}

/* 中文注释：中屏以下转为纵向布局 */
@media (max-width: 960px) {
  .chat-history-body {
    flex-direction: column;
    gap: 16px;
    padding-bottom: 12px;
  }

  .chat-history-panel {
    border-radius: 20px;
  }
}

/* 中文注释：小屏细节优化 */
@media (max-width: 600px) {
  .chat-history-body {
    padding: 12px;
  }

  .chat-history-panel {
    border-radius: 18px;
  }

  .vits-warning-alert {
    font-size: 0.9rem;
    min-width: 0;
    margin: 0 16px;
  }
}
</style>
