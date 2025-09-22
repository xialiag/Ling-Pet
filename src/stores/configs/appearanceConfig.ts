import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppearanceConfigStore = defineStore(
  'appearanceConfig',
  () => {
    // 宠物基本外观设置
    const petSize = ref(200)
    const opacity = ref(1)

    // 装饰效果类型: 'none' | 'circle' | 'fallingStars'
    const decorationType = ref<'none' | 'circle' | 'fallingStars'>('circle')

    // Live2D相关设置
    const live2dBorderType = ref<'none' | 'circle'>('none')
    const live2dModelScale = ref(0.08)
    const live2dModelPositionX = ref(0.5)
    const live2dModelPositionY = ref(0.8)

    // 聊天气泡设置
    const bubbleTransparent = ref(false)
    const bubbleShowBorder = ref(true)

    // 开发者工具设置
    const showDevTools = ref(false)

    return {
      petSize,
      opacity,
      decorationType,
      live2dBorderType,
      live2dModelScale,
      live2dModelPositionX,
      live2dModelPositionY,
      bubbleTransparent,
      bubbleShowBorder,
      showDevTools,
    }
  },
  {
    tauri: {
      saveOnChange: true,
      saveStrategy: 'debounce',
      saveInterval: 500,
    },
  }
)
