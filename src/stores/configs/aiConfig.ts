import { defineStore } from 'pinia'
import { ref } from 'vue'
import { basicCharacterSettings } from '../../services/chat/prompts';

export const useAIConfigStore = defineStore(
  'aiConfig',
  () => {
    const apiKey = ref('') // 默认API密钥为空
    const baseURL = ref('https://api.deepseek.com/v1') // 默认基础URL为空
    const model = ref('deepseek-chat') // 默认模型
    const temperature = ref(0.7) // 默认温度
    const maxTokens = ref(2000) // 默认最大令牌数
    const characterPrompt = ref(basicCharacterSettings) // 默认系统提示为空
    const historyMaxLength = ref(100) // 默认历史记录最大长度
    const autoPlay = ref(false) // 默认自动播放开启
    // 空闲超时（秒）：用于会话在无活动时自动回到空闲状态，范围建议 15~300 秒
    const inactivityTimeoutSec = ref(15)

    return {
      apiKey,
      baseURL,
      model,
      temperature,
      maxTokens,
      characterPrompt,
      historyMaxLength,
      autoPlay,
      inactivityTimeoutSec,
    }
  },
  {
    tauri: {
      saveOnChange: true,

      // You can also debounce or throttle when saving.
      // This is optional. The default behavior is to save immediately.
      saveStrategy: 'debounce',
      saveInterval: 500,
    },
  }
);