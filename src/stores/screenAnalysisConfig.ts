import { defineStore } from 'pinia'
import { ref } from 'vue'

type ImageDetail = 'low' | 'medium' | 'high'

export const useScreenAnalysisConfigStore = defineStore(
  'screenGlancerConfig',
  () => {
    const apiKey = ref('') // 默认API密钥为空
    const baseURL = ref('https://api.siliconflow.cn/v1') // 默认基础URL为空
    const model = ref('THUDM/GLM-4.1V-9B-Thinking') // 默认模型
    const temperature = ref(0.7) // 默认温度
    const maxTokens = ref(2000) // 默认最大令牌数
    const systemPrompt = ref('描述此屏幕截图的内容') // 默认系统提示为空
    const imageDetail = ref<ImageDetail>('low') // 默认图像细节级别

    return {
      apiKey,
      baseURL,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      imageDetail,
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