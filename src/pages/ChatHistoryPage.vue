<template>
  <div>
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
    <v-container fluid class="pa-4 chat-history-container">
    <!-- 标题区域 -->
    <div class="text-center mb-6">
      <h2 class="text-h5 font-weight-light text-grey-darken-2">
        <v-icon class="mr-2" color="primary">mdi-chat-outline</v-icon>
        聊天记录
      </h2>
    </div>

    <!-- 聊天记录列表 -->
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <div class="chat-messages">
          <template v-for="(message, index) in chs.chatHistory" :key="index">
            <!-- 用户消息 -->
            <div v-if="message.role === 'user'" class="message-row user-message mb-4">
              <div class="d-flex justify-end align-center">
                <!-- 删除按钮 -->
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  color="error"
                  class="mr-2 delete-btn"
                  @click="showDeleteDialog(index)"
                >
                  <v-icon size="18">mdi-delete-outline</v-icon>
                </v-btn>
                
                <v-card class="message-bubble user-bubble" rounded="xl">
                  <v-card-text class="pa-3">
                    {{ message.content }}
                  </v-card-text>
                </v-card>
                <v-avatar class="ml-3 user-avatar" size="40">
                  <v-icon color="white">mdi-account</v-icon>
                </v-avatar>
              </div>
            </div>

            <!-- AI消息 -->
            <div v-if="message.role === 'assistant'" class="message-row ai-message mb-4">
              <template v-for="aiMsg in parseAIMessage(String(message.content))" :key="aiMsg.chinese">
                <div class="d-flex justify-start mb-3 ai-message-item">
                  <v-avatar class="mr-3 ai-avatar" size="40"></v-avatar>
                  <v-card class="message-bubble ai-bubble" rounded="xl">
                    <v-card-text class="pa-3">
                      {{ aiMsg.chinese }}
                    </v-card-text>
                  </v-card>
                  <!-- 语音播放按钮（占位，尚未实现） -->
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    color="primary"
                    class="ml-2 voice-btn"
                    :loading="playingIndex === `${index}-${aiMsg.chinese}`"
                    @click="playVoice(aiMsg.chinese, `${index}-${aiMsg.chinese}`)"
                  >
                    <v-icon size="18">mdi-volume-high</v-icon>
                  </v-btn>
                </div>
              </template>
            </div>
            <div v-if="message.role === 'tool'" class="message-row tool-message mb-4">
              <div class="d-flex justify-start mb-3 tool-message-item">
              <v-avatar class="mr-3 tool-avatar" size="40">
                <v-icon color="white">mdi-tools</v-icon>
              </v-avatar>
              <v-card class="message-bubble tool-bubble" rounded="xl">
                <v-card-text class="pa-3">
                <span class="tool-name">
                  {{ (JSON.parse(String(message.content)) as ToolResultMessageContent).name }}
                </span>
                </v-card-text>
              </v-card>
              </div>
            </div>
          </template>

          <!-- 空状态 -->
          <div v-if="chs.chatHistory.length === 0" class="text-center py-8">
            <v-icon size="64" color="grey-lighten-2">mdi-chat-sleep-outline</v-icon>
            <p class="text-grey mt-4">还没有聊天记录呢</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- 中文注释：在页面底部展示计划任务列表（来自 schedule store） -->
    <v-row justify="center" class="mt-6">
      <v-col cols="12" md="10" lg="8">
        <v-card class="schedule-card" rounded="xl" variant="flat">
          <v-card-title class="d-flex align-center py-3">
            <v-icon class="mr-2" color="primary">mdi-calendar-clock</v-icon>
            计划任务
            <v-spacer></v-spacer>
            <v-chip size="small" color="grey-lighten-2" variant="elevated">
              共 {{ tasks.length }} 个
            </v-chip>
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="py-0">
            <div v-if="tasks.length === 0" class="text-center py-6 text-grey">
              <v-icon size="28" color="grey-lighten-1" class="mb-2">mdi-timetable</v-icon>
              暂无计划任务
            </div>
            <v-list v-else density="comfortable">
              <v-list-item
                v-for="t in sortedTasks"
                :key="t.id"
                class="px-2 py-1 schedule-item"
              >
                <template #prepend>
                  <v-avatar size="28" class="mr-2" :class="statusAvatarClass(t.status)">
                    <v-icon size="18">{{ statusIcon(t.status) }}</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="text-body-2 font-weight-medium">
                  {{ t.prompt }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-grey-darken-1 schedule-subtitle">
                  <span class="meta">状态：</span>
                  <v-chip size="x-small" :color="statusColor(t.status)" variant="flat" class="status-chip">{{ statusLabel(t.status) }}</v-chip>
                  <span class="meta">计划：{{ fmtTime(t.scheduledAt) }}</span>
                  <span v-if="t.outdatedAt" class="meta">过期：{{ fmtTime(t.outdatedAt) }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <!-- 中文注释：一个按钮，能取消则取消，否则删除 -->
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    :aria-label="taskActionLabel(t)"
                    @click="handleTaskAction(t)"
                  >
                    <v-icon size="18">{{ taskActionIcon(t) }}</v-icon>
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <v-row class="clear-btn-bar">
      <v-btn color="error" variant="flat" @click="clearDialog = true">
        <v-icon left>mdi-delete-outline</v-icon>
        清空聊天记录
      </v-btn>
    </v-row>
  </v-container>
  
  <!-- 清空确认对话框 -->
  <v-dialog v-model="clearDialog" max-width="320">
    <v-card>
      <v-card-title class="text-h6">确认清空</v-card-title>
      <v-card-text>确定要清空所有聊天记录吗？此操作不可恢复。</v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="clearDialog = false">取消</v-btn>
        <v-btn color="error" text @click="handleClear">清空</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- 删除消息确认对话框 -->
  <v-dialog v-model="deleteDialog" max-width="360">
    <v-card>
      <v-card-title class="text-h6">确认删除</v-card-title>
      <v-card-text>
        确定要删除这条消息及其后续所有消息吗？此操作不可恢复。
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="deleteDialog = false">取消</v-btn>
        <v-btn color="error" text @click="handleDelete">删除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  </div>
</template>

<script lang="ts" setup>
// 中文注释：聊天记录页面，已简化为仅展示中文消息；语音播放功能保留占位（TODO: 语音未实现）
import { ref } from 'vue';
import { useChatHistoryStore } from '../stores/chatHistory';
import { extractItemsFromContent } from '../utils/aiResponse'
import { ToolResultMessageContent } from '../services/tools';
// 中文注释：引入计划任务的Pinia Store，用于展示与取消任务
import { computed, onMounted } from 'vue'
import { useScheduleStore, type ScheduleTask } from '../stores/schedule'

const chs = useChatHistoryStore();
// 中文注释：初始化调度Store实例
const schedule = useScheduleStore()
// 中文注释：在本页面也确保从 Tauri 存储中恢复任务并启动心跳（避免仅在 MainPage 初始化时才生效）
onMounted(() => {
  try {
    // 中文注释：启动持久化适配器（若已启动会被忽略）
    ;(schedule as any).$tauri?.start?.()
    // 中文注释：恢复悬挂任务状态
    schedule.rehydrate()
    // 中文注释：启动心跳（若已启动会直接返回）
    schedule.startHeartbeat()
  } catch (e) {
    console.warn('[ChatHistoryPage] schedule init skipped:', e)
  }
})

type ParsedAIMessage = { chinese: string }

function parseAIMessage(content: string): ParsedAIMessage[] {
  try {
    const items = extractItemsFromContent(content)
    return items.map(it => ({ chinese: it.message }))
  } catch (e) {
    console.error('解析AI消息失败:', e)
    return []
  }
}

const clearDialog = ref(false);
const deleteDialog = ref(false);
const deleteIndex = ref(-1);
// 中文注释：语音播放占位所需状态（TODO: 语音未实现）
const playingIndex = ref<string | null>(null)
const vitsWarning = ref(false)

function handleClear() {
  chs.clear();
  clearDialog.value = false;
}

function showDeleteDialog(index: number) {
  deleteIndex.value = index;
  deleteDialog.value = true;
}

function handleDelete() {
  if (deleteIndex.value >= 0) {
    chs.deleteMessageAndAfter(deleteIndex.value);
  }
  deleteDialog.value = false;
  deleteIndex.value = -1;
}

// 中文注释：占位的语音播放函数；目前未集成TTS服务
// TODO: 集成新的中文TTS服务后，在此实现生成并播放音频
async function playVoice(text: string, uniqueId: string) {
  if (playingIndex.value === uniqueId) return
  console.warn('TODO: 语音播放尚未实现。文本：', text)
  vitsWarning.value = true
  setTimeout(() => { vitsWarning.value = false }, 2500)
}

// 中文注释：调度任务区——派生任务列表、排序与操作
const tasks = computed(() => schedule.tasks)
const sortedTasks = computed(() => {
  // 中文注释：优先展示 running/outdated/pending/scheduled，然后是 accomplished/canceled；同组内按时间排序
  const order: Record<ScheduleTask['status'], number> = {
    running: 0,
    outdated: 1,
    pending: 2,
    scheduled: 3,
    accomplished: 4,
    canceled: 5,
  }
  return [...tasks.value].sort((a, b) => {
    const byStatus = order[a.status] - order[b.status]
    if (byStatus !== 0) return byStatus
    const ta = a.startedAt ?? a.scheduledAt ?? a.createdAt
    const tb = b.startedAt ?? b.scheduledAt ?? b.createdAt
    return tb - ta
  })
})

// 中文注释：展示格式化工具与UI辅助
function two(n: number) { return n < 10 ? `0${n}` : `${n}` }
function fmtTime(ts?: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const Y = d.getFullYear()
  const M = two(d.getMonth() + 1)
  const D = two(d.getDate())
  const h = two(d.getHours())
  const m = two(d.getMinutes())
  return `${Y}-${M}-${D} ${h}:${m}`
}

function statusLabel(s: ScheduleTask['status']) {
  switch (s) {
    case 'scheduled': return '已计划'
    case 'pending': return '排队中'
    case 'running': return '执行中'
    case 'outdated': return '已过期'
    case 'accomplished': return '已完成'
    case 'canceled': return '已取消'
  }
}

function statusColor(s: ScheduleTask['status']) {
  switch (s) {
    case 'running': return 'primary'
    case 'pending': return 'indigo'
    case 'scheduled': return 'grey'
    case 'outdated': return 'orange'
    case 'accomplished': return 'green'
    case 'canceled': return 'red'
  }
}

function statusIcon(s: ScheduleTask['status']) {
  switch (s) {
    case 'running': return 'mdi-progress-clock'
    case 'pending': return 'mdi-timer-sand'
    case 'scheduled': return 'mdi-calendar-clock'
    case 'outdated': return 'mdi-clock-alert-outline'
    case 'accomplished': return 'mdi-check-circle-outline'
    case 'canceled': return 'mdi-close-circle-outline'
  }
}

function statusAvatarClass(s: ScheduleTask['status']) {
  return `status-avatar-${s}`
}

function canCancel(s: ScheduleTask['status']) {
  return s !== 'running' && s !== 'accomplished' && s !== 'canceled'
}

// 中文注释：根据任务状态执行操作；可取消则取消，否则删除
function handleTaskAction(t: ScheduleTask) {
  if (canCancel(t.status)) {
    schedule.cancelSchedule(t.id)
  } else {
    schedule.deleteSchedule(t.id)
  }
}

// 中文注释：用于按钮的图标与标签（辅助可访问性）
function taskActionIcon(t: ScheduleTask) {
  return canCancel(t.status) ? 'mdi-close-circle-outline' : 'mdi-delete-outline'
}
function taskActionLabel(t: ScheduleTask) {
  return (canCancel(t.status) ? '取消任务 ' : '删除任务 ') + t.id
}

</script>

<style scoped>
.chat-history-container {
  min-height: 100vh;
  background-color: #f4f5f7;
  /* 改为纯色背景 */
}

.chat-messages {
  overflow-y: auto;
  padding: 0 8px;
}

.message-row {
  animation: fadeInUp 0.3s ease-out;
  position: relative;
}

.message-row:hover .delete-btn {
  opacity: 1;
  transform: translateX(0);
}

.ai-message-item:hover .voice-btn {
  opacity: 1;
  transform: translateX(0);
}

.delete-btn {
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.2s ease;
}

.voice-btn {
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.2s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-bubble {
  max-width: 80%;
  word-wrap: break-word;
  transition: all 0.2s ease;
}

.message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.user-bubble {
  background-color: #42a5f5;
  /* 移除渐变，改为蓝色 */
  color: white;
}

.ai-bubble {
  border: 1px solid;
}

.user-avatar {
  background-color: #42a5f5;
  /* 移除渐变，与气泡颜色统一 */
}

.ai-avatar {
  border: 2px solid rgba(0, 0, 0, 0.05);
  /* 边框颜色变浅 */
}

.tool-avatar {
  background-color: #707070; /* 黑色背景 */
  border: 2px solid #000000; /* 黑色边框 */
}

.tool-bubble {
  background-color: #404040; /* 黑底 */
  border: 1px solid #333333; /* 深灰边框，弱化存在感 */
  color: #ffffff; /* 白字 */
}

.stats-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid #e0e0e0;
  /* 添加细边框代替阴影 */
}

.stat-item {
  padding: 16px 8px;
}

.stat-number {
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  margin-top: 4px;
  font-weight: 500;
}

.emotion-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 响应式优化 */
@media (max-width: 600px) {
  .message-bubble {
    max-width: 90%;
  }

  .stat-item {
    padding: 12px 4px;
  }

  .stat-number {
    font-size: 1.5rem !important;
  }
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.clear-btn-bar {
  width: 100vw;
  left: 0;
  bottom: 0;
  z-index: 20;
  background: transparent;
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
  pointer-events: none;
}

.clear-btn-bar .v-btn {
  pointer-events: auto;
  box-shadow: none;
  font-weight: 500;
  letter-spacing: 1px;
}

/* 中文注释：计划任务卡片样式，延续页面的简洁边框与圆角 */
.schedule-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e8e8e8;
}

/* 中文注释：任务列表项的细节优化 */
.schedule-item + .schedule-item {
  border-top: 1px dashed #efefef;
}

/* 中文注释：让副标题区域可换行，避免文字被省略号截断 */
.schedule-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

/* 中文注释：元信息段落的间距微调 */
.schedule-subtitle .meta {
  margin-right: 0;
}

/* 中文注释：确保状态 Chip 全文显示 */
.status-chip :deep(.v-chip__content) {
  overflow: visible;
}

/* 中文注释：不同状态的圆形头像色彩标识 */
.status-avatar-running {
  background: #1976d2;
  color: #fff;
}
.status-avatar-pending {
  background: #3949ab;
  color: #fff;
}
.status-avatar-scheduled {
  background: #9e9e9e;
  color: #fff;
}
.status-avatar-outdated {
  background: #fb8c00;
  color: #fff;
}
.status-avatar-accomplished {
  background: #43a047;
  color: #fff;
}
.status-avatar-canceled {
  background: #e53935;
  color: #fff;
}

/* 优化的顶部警告浮层（保留占位用于语音未实现提示） */
.vits-warning-alert {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 240px;
  max-width: 90vw;
  border-radius: 12px;
  box-shadow: 0 4px 18px 0 rgba(255, 193, 7, 0.15), 0 2px 8px 0 rgba(0,0,0,0.06);
  font-weight: 500;
  letter-spacing: 0.3px;
  background-color: #fff8e1 !important;
  border-color: #ffc107 !important;
}

@media (max-width: 600px) {
  .vits-warning-alert {
    font-size: 0.9rem;
    min-width: 0;
    margin: 0 16px;
  }
}
</style>
