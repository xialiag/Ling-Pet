import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Live2DModelInfo } from '../../types/live2d'

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

    // Live2D模型管理
    const currentModelId = ref<string>('')
    const availableModels = ref<Live2DModelInfo[]>([])

    // 聊天气泡设置
    const bubbleTransparent = ref(false)
    const bubbleShowBorder = ref(true)

    // 开发者工具设置
    const showDevTools = ref(false)

    // 计算属性：当前选中的模型信息
    const currentModel = computed(() => {
      return availableModels.value.find(model => model.id === currentModelId.value) || null
    })

    // 计算属性：是否有可用模型
    const hasAvailableModels = computed(() => {
      return availableModels.value.length > 0
    })

    // 模型管理方法
    const setCurrentModel = (modelId: string) => {
      const model = availableModels.value.find(m => m.id === modelId)
      if (model) {
        currentModelId.value = modelId
      }
    }

    const updateAvailableModels = (models: Live2DModelInfo[]) => {
      availableModels.value = models
      
      // 如果当前选中的模型不在新列表中，清空选择
      if (currentModelId.value && !models.find(m => m.id === currentModelId.value)) {
        currentModelId.value = ''
      }
      
      // 如果没有选中模型但有可用模型，选择第一个
      if (!currentModelId.value && models.length > 0) {
        currentModelId.value = models[0].id
      }
    }

    const addModel = (model: Live2DModelInfo) => {
      const existingIndex = availableModels.value.findIndex(m => m.id === model.id)
      if (existingIndex >= 0) {
        // 更新现有模型
        availableModels.value[existingIndex] = model
      } else {
        // 添加新模型
        availableModels.value.push(model)
      }
      
      // 如果这是第一个模型，自动选中
      if (availableModels.value.length === 1) {
        currentModelId.value = model.id
      }
    }

    const removeModel = (modelId: string) => {
      const index = availableModels.value.findIndex(m => m.id === modelId)
      if (index >= 0) {
        availableModels.value.splice(index, 1)
        
        // 如果删除的是当前选中的模型，选择其他模型或清空
        if (currentModelId.value === modelId) {
          if (availableModels.value.length > 0) {
            currentModelId.value = availableModels.value[0].id
          } else {
            currentModelId.value = ''
          }
        }
      }
    }

    // 监听模型切换，可以在这里添加额外的逻辑
    watch(currentModelId, (newModelId, oldModelId) => {
      if (newModelId !== oldModelId) {
        console.log(`Model switched from ${oldModelId} to ${newModelId}`)
        // 这里可以添加模型切换时的额外逻辑，比如触发事件等
      }
    })

    return {
      petSize,
      opacity,
      decorationType,
      live2dBorderType,
      live2dModelScale,
      live2dModelPositionX,
      live2dModelPositionY,
      currentModelId,
      availableModels,
      bubbleTransparent,
      bubbleShowBorder,
      showDevTools,
      // 计算属性
      currentModel,
      hasAvailableModels,
      // 模型管理方法
      setCurrentModel,
      updateAvailableModels,
      addModel,
      removeModel,
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
