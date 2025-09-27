<template>
  <div class="chat-history-messages">
    <template v-for="(message, index) in messages" :key="`message-${index}`">
      <div v-if="message.role === 'user'" class="message-row user-message">
        <div class="message-row__inner">
          <v-btn
            v-if="allowDelete"
            icon
            size="small"
            variant="text"
            color="error"
            class="delete-btn"
            @click="emit('request-delete', index)"
          >
            <v-icon size="18">mdi-delete-outline</v-icon>
          </v-btn>
          <v-card class="message-bubble user-bubble" rounded="xl">
            <v-card-text class="pa-3">{{ (message as any).content }}</v-card-text>
          </v-card>
          <v-avatar class="user-avatar" size="40">
            <v-icon color="white">mdi-account</v-icon>
          </v-avatar>
        </div>
      </div>

      <div v-else-if="message.role === 'assistant'" class="message-row ai-message">
        <template v-for="aiMsg in parseAIMessage(message)" :key="voiceKey(index, aiMsg.chinese)">
          <div class="message-row__inner ai-message-item">
            <v-avatar class="ai-avatar" size="40"></v-avatar>
            <v-card class="message-bubble ai-bubble" rounded="xl">
              <v-card-text class="pa-3">{{ aiMsg.chinese }}</v-card-text>
            </v-card>
            <v-btn
              icon
              size="small"
              variant="text"
              color="primary"
              class="voice-btn"
              :loading="playingIndex === voiceKey(index, aiMsg.chinese)"
              @click="emit('request-play', { text: aiMsg.chinese, key: voiceKey(index, aiMsg.chinese) })"
            >
              <v-icon size="18">mdi-volume-high</v-icon>
            </v-btn>
          </div>
        </template>
      </div>

      <div v-else-if="message.role === 'tool'" class="message-row tool-message">
        <div
          v-for="(item, toolIndex) in (message as any).content"
          :key="`tool-${index}-${toolIndex}`"
          class="message-row__inner tool-message-item"
        >
          <v-avatar class="tool-avatar" size="40">
            <v-icon color="white">mdi-tools</v-icon>
          </v-avatar>
          <v-card class="message-bubble tool-bubble" rounded="xl">
            <v-card-text class="pa-3">
              <span class="tool-name">{{ (item as any).toolName }}</span>
            </v-card-text>
          </v-card>
        </div>
      </div>
    </template>

    <div v-if="messages.length === 0" class="empty-placeholder">
      <v-icon size="64" color="grey-lighten-2">mdi-chat-sleep-outline</v-icon>
      <p class="text-grey mt-4">还没有消息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 中文注释：引入组合式API和工具函数
import { computed } from 'vue'
import { extractItemsFromContent } from '../../utils/aiResponse'

// 中文注释：定义 AI 消息解析结果类型
export type ParsedAIMessage = { chinese: string }

// 中文注释：声明组件可接收的属性
const props = defineProps<{
  messages: any[]
  allowDelete: boolean
  playingIndex: string | null
}>()

// 中文注释：定义组件派发的事件
const emit = defineEmits<{
  (e: 'request-delete', index: number): void
  (e: 'request-play', payload: { text: string; key: string }): void
}>()

// 中文注释：通过计算属性保持对 props 的响应式访问
const messages = computed(() => props.messages)
const allowDelete = computed(() => props.allowDelete)
const playingIndex = computed(() => props.playingIndex)

// 中文注释：构造语音按钮的唯一键值
function voiceKey(index: number, text: string) {
  return `${index}-${text}`
}

// 中文注释：解析 AI 消息为可渲染数组
function parseAIMessage(message: any): ParsedAIMessage[] {
  try {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    const items = extractItemsFromContent(content)
    return items.map((item) => ({ chinese: item.message }))
  } catch (error) {
    console.error('解析AI消息失败:', error)
    return []
  }
}
</script>

<style scoped>
/* 中文注释：消息列表容器 */
.chat-history-messages {
  flex: 1;
  overflow-y: auto;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 中文注释：单条消息外层 */
.message-row {
  animation: fadeInUp 0.3s ease-out;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.message-row__inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-message {
  justify-content: flex-end;
}

.user-message .message-row__inner {
  justify-content: flex-end;
}

/* 中文注释：AI 与工具消息条目 */
.ai-message-item,
.tool-message-item {
  justify-content: flex-start;
  gap: 16px;
}

.message-bubble {
  max-width: min(80%, 640px);
  word-break: break-word;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12) !important;
}

.user-bubble {
  background-color: #42a5f5;
  color: white;
}

.ai-bubble {
  border: 1px solid rgba(33, 150, 243, 0.2);
}

.tool-bubble {
  background-color: #404040;
  border: 1px solid #333333;
  color: white;
}

/* 中文注释：删除与语音按钮默认状态 */
.delete-btn,
.voice-btn {
  opacity: 0;
  transform: translateX(6px);
  transition: all 0.2s ease;
}

.message-row:hover .delete-btn,
.ai-message-item:hover .voice-btn {
  opacity: 1;
  transform: translateX(0);
}

.user-avatar {
  background-color: #42a5f5;
}

.ai-avatar {
  border: 2px solid rgba(0, 0, 0, 0.05);
}

.tool-avatar {
  background-color: #707070;
  border: 2px solid #000000;
}

.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #78909c;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-history-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-history-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 3px;
}

.chat-history-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

@media (max-width: 600px) {
  .chat-history-messages {
    padding: 20px 16px;
    gap: 24px;
  }

  .message-bubble {
    max-width: 90%;
  }
}
</style>
