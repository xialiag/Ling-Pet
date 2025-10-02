<template>
  <div class="live2d-wrapper" @mousedown="onDragStart" @click.stop="onClick">
    <!-- Thinking bubble in top-left when streaming -->
    <div v-if="isStreaming" class="thinking-bubble" :style="thinkingBubbleStyle" aria-label="thinking">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>

    <div class="live2d-container" :class="borderClass" ref="live2dContainer">
      <canvas ref="live2dCanvas" class="live2d-canvas"></canvas>
    </div>
    
    <div v-if="!isReady" class="avatar-loading" :class="borderClass">
      <div v-if="loadError" class="error-message">
        <div class="error-text">{{ loadError }}</div>
      </div>
      <div v-else-if="!ac.hasAvailableModels" class="no-models-message">
        <div class="no-models-text">暂无可用模型</div>
        <div class="no-models-hint">请在设置中导入Live2D模型</div>
      </div>
      <div v-else class="loading-message">
        <div class="loading-spinner"></div>
        <div class="loading-text">Live2D加载中……</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { join, dirname } from '@tauri-apps/api/path'
import { readTextFile } from '@tauri-apps/plugin-fs'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'
import { storeToRefs } from 'pinia'
import { usePetStateStore } from '../../stores/petState'
import { useConversationStore } from '../../stores/conversation'
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig'
import { registerAvatarClick } from '../../services/interactions/avatarMultiClickEmitter'
import { initializeLive2DModels } from '../../services/live2d/live2dModelService'
import { ensureCubismCore, transformLive2DConfig } from '../../services/live2d/live2dConfigAdapter'

// 中文注释: 初始化 store 与窗口交互
const state = usePetStateStore()
const conversation = useConversationStore()
const ac = useAppearanceConfigStore()
const { isStreaming } = storeToRefs(conversation)
const appWindow = getCurrentWebviewWindow()

// 中文注释: 定义组件状态
const live2dContainer = ref<HTMLDivElement>()
const live2dCanvas = ref<HTMLCanvasElement>()
const isReady = ref(false)
const loadError = ref<string | null>(null)
const borderClass = computed(() => (ac.live2dBorderType === 'circle' ? 'circle-border' : 'no-border'))
const thinkingBubbleStyle = computed(() => {
  if (!isStreaming.value) return { display: 'none' }
  return { position: 'absolute' as const, top: '10%', left: '10%', width: '30%', height: '18%', zIndex: '2' }
})

// 中文注释: PIXI 应用全局引用
let pixiApp: PIXI.Application | null = null
let live2dModel: Live2DModel | null = null
let resizeObserver: ResizeObserver | null = null
;(window as any).PIXI = PIXI

// 中文注释: 等待容器尺寸准备
async function waitForContainerRect(el: HTMLElement): Promise<DOMRect> {
  for (let i = 0; i < 10; i++) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return rect
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
  }
  throw new Error('容器尺寸未准备就绪')
}

// 中文注释: 初始化并渲染 Live2D 模型
async function initLive2D() {
  if (!live2dContainer.value || !live2dCanvas.value) return
  try {
    isReady.value = false
    loadError.value = null
    await ensureCubismCore()
    await nextTick()
    const rect = await waitForContainerRect(live2dContainer.value)
    let app = pixiApp
    if (!app) {
      pixiApp = new (PIXI.Application as any)({
        view: live2dCanvas.value,
        width: Math.max(rect.width, 100),
        height: Math.max(rect.height, 100),
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.max(window.devicePixelRatio || 1, 1),
        autoDensity: true,
        sharedTicker: false,
        sharedLoader: false
      })
      app = pixiApp
    } else {
      app.renderer.resize(Math.max(rect.width, 100), Math.max(rect.height, 100))
    }
    if (!app) throw new Error('PIXI 应用初始化失败')
    const model = ac.currentModel
    if (!model) throw new Error('没有可用的Live2D模型')
    const configPath = await join(model.path, model.configFile)
    const configDir = await dirname(configPath)
    const rawConfig = await readTextFile(configPath)
    const hydratedConfig = await transformLive2DConfig(JSON.parse(rawConfig), configDir)
    const blob = new Blob([JSON.stringify(hydratedConfig)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    try {
      live2dModel = await Live2DModel.from(url, { autoInteract: false })
    } finally {
      URL.revokeObjectURL(url)
    }
    if (!live2dModel) throw new Error('Live2D 模型初始化失败')
    updateLayout()
    app.stage.addChild(live2dModel as any)
    ;(live2dModel as any).eventMode = 'static'
    ;(live2dModel as any).cursor = 'pointer'
    isReady.value = true
  } catch (error) {
    console.error('Live2D 初始化失败:', error)
    loadError.value = error instanceof Error ? error.message : '模型加载失败'
    disposeModel()
  }
}

// 中文注释: 根据配置更新布局
function updateLayout() {
  if (!pixiApp || !live2dContainer.value) return
  const rect = live2dContainer.value.getBoundingClientRect()
  pixiApp.renderer.resize(Math.max(rect.width, 100), Math.max(rect.height, 100))
  if (!live2dModel) return
  const baseScale = ac.petSize / 200
  const scale = baseScale * ac.live2dModelScale
  live2dModel.scale.set(scale)
  live2dModel.anchor.set(0.5, 0.5)
  live2dModel.x = pixiApp.screen.width * ac.live2dModelPositionX
  live2dModel.y = pixiApp.screen.height * ac.live2dModelPositionY
}

// 中文注释: 销毁当前模型实例
function disposeModel() {
  if (pixiApp && live2dModel) {
    pixiApp.stage.removeChild(live2dModel as any)
  }
  if (live2dModel) {
    try {
      live2dModel.destroy()
    } catch (error) {
      console.warn('销毁 Live2D 模型时出现问题:', error)
    }
  }
  live2dModel = null
  isReady.value = false
}

// 中文注释: 清理 PIXI 应用
function cleanupPixiApp() {
  disposeModel()
  if (pixiApp) {
    try {
      pixiApp.destroy(true, true)
    } catch (error) {
      console.warn('销毁 PIXI 应用时出现问题:', error)
    }
  }
  pixiApp = null
}

// 中文注释: 初始化模型列表数据
async function initializeModels() {
  try {
    const models = await initializeLive2DModels()
    ac.updateAvailableModels(models)
    if (models.length > 0 && !ac.currentModelId) {
      ac.setCurrentModel(models[0].id)
    }
  } catch (error) {
    console.error('初始化模型列表失败:', error)
    loadError.value = error instanceof Error ? error.message : '加载模型列表失败'
  }
}

// 中文注释: 重新加载当前模型
async function reloadModel() {
  if (!ac.currentModel) {
    loadError.value = '没有选中的模型'
    cleanupPixiApp()
    return
  }
  disposeModel()
  await nextTick()
  await initLive2D()
}

// 中文注释: 处理桌宠窗口拖拽
function onDragStart(e: MouseEvent) {
  if ((e.buttons & 1) === 0) return
  const startX = e.clientX
  const startY = e.clientY
  let dragging = false
  const DRAG_THRESHOLD = 5
  const onMove = (event: MouseEvent) => {
    if (dragging) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      dragging = true
      void appWindow.startDragging()
      cleanup()
    }
  }
  const onUp = () => cleanup()
  const cleanup = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp, { once: true })
}

// 中文注释: 处理点击互动逻辑
function onClick() {
  conversation.cancelAutoPlay()
  state.updateLastClickTimestamp()
  conversation.playNext()
  registerAvatarClick()
}

// 中文注释: 监听配置变更调整布局
watch(
  () => [ac.petSize, ac.live2dModelScale, ac.live2dModelPositionX, ac.live2dModelPositionY],
  () => nextTick(() => updateLayout())
)
watch(() => ac.live2dBorderType, () => nextTick(() => updateLayout()))
watch(() => ac.currentModelId, async (next, prev) => {
  if (next && next !== prev) {
    await reloadModel()
  }
})

// 中文注释: 生命周期管理
onMounted(async () => {
  await initializeModels()
  if (ac.currentModel) {
    await initLive2D()
  }
  if (live2dContainer.value) {
    resizeObserver = new ResizeObserver(() => updateLayout())
    resizeObserver.observe(live2dContainer.value)
  }
  window.setTimeout(() => conversation.cancelInactivityWatch(), 6000)
})

onUnmounted(() => {
  if (resizeObserver && live2dContainer.value) {
    resizeObserver.unobserve(live2dContainer.value)
    resizeObserver.disconnect()
  }
  cleanupPixiApp()
})
</script>


<style scoped>
.live2d-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  --glow-color: 80 180 255;
}

.live2d-container {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: transparent;
}

.live2d-container.circle-border {
  border-radius: 50%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.live2d-container.circle-border:hover {
  transform: scale(1.05);
  transform-origin: center center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.live2d-container.no-border {
  border-radius: 0;
  box-shadow: none;
}

.live2d-container.no-border:hover {
  transform: scale(1.05);
  transform-origin: center center;
}

.live2d-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.live2d-container.circle-border .live2d-canvas {
  border-radius: 50%;
}

.avatar-loading {
  position: absolute;
  bottom: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  user-select: none;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 12px;
  z-index: 10;
}

.avatar-loading.circle-border,
.avatar-loading.no-border {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* Error and loading states */
.error-message, .no-models-message, .loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  text-align: center;
}



.error-text, .no-models-text, .loading-text {
  font-size: 0.9em;
  font-weight: 500;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  line-height: 1.3;
}

.no-models-hint {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Thinking bubble - scales with parent */
.thinking-bubble {
  position: absolute;
  top: 10%;
  left: 10%;
  width: 30%;
  height: 18%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10%;
  z-index: 2;
  pointer-events: none;
  /* do not block clicks */
}

.thinking-bubble .dot {
  width: 12%;
  height: 26%;
  border-radius: 50%;
  background: black;
  opacity: 0.35;
  animation: bubblePulse 1.2s infinite ease-in-out;
}

.thinking-bubble .dot:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking-bubble .dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes bubblePulse {
  0% {
    opacity: 0.25;
    transform: translateY(0) scale(0.9);
  }

  30% {
    opacity: 1;
    transform: translateY(-6%) scale(1.05);
  }

  60% {
    opacity: 0.6;
    transform: translateY(0) scale(0.95);
  }

  100% {
    opacity: 0.25;
    transform: translateY(0) scale(0.9);
  }
}
</style>
