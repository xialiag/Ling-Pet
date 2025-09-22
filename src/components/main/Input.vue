<template>
  <input
    type="text"
    v-model="inputMessage"
    @keyup.enter="sendMessage"
    @keydown.enter="preventSendWhenThinking"
    :readonly="currentConfig.readonly"
    :placeholder="placeholder"
    class="chat-input"
    :class="currentConfig.cssClass"
    :style="inputStyle"
  />
</template>

<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { useConversationStore } from '../../stores/conversation';
import { storeToRefs } from 'pinia';
import { chatWithPetStream } from '../../services/chatAndVoice/chatWithPet';
import { callToolByName } from '../../services/tools';
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig';

const conversation = useConversationStore();
const { isStreaming, isTooling } = storeToRefs(conversation);
const ac = useAppearanceConfigStore();

const inputMessage = ref('');
const thinkingMessages = ['正在思考中', '正在思考中.', '正在思考中..', '正在思考中...'];
const thinkingIndex = ref(0);
const toolingMessages = ['使用工具中', '使用工具中.', '使用工具中..', '使用工具中...'];

const inputStyle = computed(() => {
  const modelCenterX = ac.live2dModelPositionX;
  const leftPosition = `${modelCenterX * 100 - 30}%`;
  const bottomPosition = '3%';

  return {
    left: leftPosition,
    bottom: bottomPosition,
    transform: 'translateX(0)',
  };
});

let thinkingTimer: number | null = null;

function startThinkingAnimation() {
  if (thinkingTimer !== null) return;
  thinkingTimer = window.setInterval(() => {
    thinkingIndex.value = (thinkingIndex.value + 1) % thinkingMessages.length;
  }, 500);
}

function stopThinkingAnimation() {
  if (thinkingTimer === null) return;
  clearInterval(thinkingTimer);
  thinkingTimer = null;
  thinkingIndex.value = 0;
}

watch(isStreaming, (val) => {
  if (val) startThinkingAnimation();
  else stopThinkingAnimation();
});

onUnmounted(() => {
  stopThinkingAnimation();
});

enum InputState {
  IDLE = 'idle',
  THINKING = 'thinking',
  TOOLING = 'tooling',
  CONTINUE = 'continue',
}

const stateConfig = {
  [InputState.IDLE]: {
    placeholder: '和我聊天吧...',
    readonly: false,
    cssClass: '',
    cursor: 'text'
  },
  [InputState.THINKING]: {
    placeholder: () => thinkingMessages[thinkingIndex.value],
    readonly: true,
    cssClass: 'thinking',
    cursor: 'not-allowed'
  },
  [InputState.TOOLING]: {
    placeholder: () => toolingMessages[thinkingIndex.value],
    readonly: true,
    cssClass: 'tooling',
    cursor: 'not-allowed'
  },
  [InputState.CONTINUE]: {
    placeholder: '点击以继续...',
    readonly: true,
    cssClass: 'continue',
    cursor: 'pointer'
  }
};

const currentState = computed(() => {
  if (isStreaming.value) return isTooling.value ? InputState.TOOLING : InputState.THINKING;
  if (conversation.responseItems.length > 0) return InputState.CONTINUE;
  return InputState.IDLE;
});

const currentConfig = computed(() => stateConfig[currentState.value]);

const placeholder = computed(() => {
  const config = currentConfig.value;
  return typeof config.placeholder === 'function'
    ? config.placeholder()
    : config.placeholder;
});

watch(currentState, (newState: InputState, oldState: InputState) => {
  if (newState === InputState.THINKING && oldState === InputState.IDLE) {
    // 预留钩子
  }
  if (newState === InputState.CONTINUE && oldState === InputState.THINKING) {
    // 预留钩子
  }
  if (newState === InputState.IDLE) {
    // 预留钩子
  }
}, { immediate: false });

async function sendMessage() {
  const userMessage = inputMessage.value.trim();
  if (userMessage && currentState.value === InputState.IDLE) {
    if (userMessage.startsWith('/')) {
      const toolResponse = await callToolByName('addNotification', ['2', userMessage.replace('/', '')]);
      console.log('工具调用结果:', toolResponse);
      inputMessage.value = '';
      return;
    }

    inputMessage.value = '';
    const petResponse = await chatWithPetStream(userMessage);

    if (!petResponse.success) {
      conversation.currentMessage = petResponse.error || '发生错误，请稍后再试。'
    }

    stopThinkingAnimation();
  }
}

function preventSendWhenThinking(event: KeyboardEvent) {
  if (currentState.value !== InputState.IDLE) {
    event.preventDefault();
    event.stopPropagation();
  }
}

</script>

<style scoped>
.chat-input {
  position: absolute;
  display: flex;
  bottom: 3%;
  padding: 3px 10px;
  width: 60%;

  opacity: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(6px);
  transition: all 0.2s ease;

  font-size: 16px;
  font-weight: 500;
  color: #1f2933;
  outline: none;
}

.chat-input::placeholder {
  color: rgba(31, 41, 51, 0.5);
}

.chat-input:focus {
  border-color: rgba(99, 102, 241, 0.7);
  background: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  opacity: 1;
}

.chat-input.thinking,
.chat-input.tooling {
  cursor: not-allowed;
  color: rgba(31, 41, 51, 0.6);
  background: rgba(255, 255, 255, 0.3);
}

.chat-input.continue {
  cursor: pointer;
  border-color: rgba(129, 140, 248, 0.9);
  background: rgba(129, 140, 248, 0.18);
  color: rgba(67, 56, 202, 0.95);
}

.chat-input.thinking::placeholder,
.chat-input.tooling::placeholder {
  color: rgba(31, 41, 51, 0.45);
}

.chat-input.continue::placeholder {
  color: rgba(67, 56, 202, 0.8);
}
</style>
