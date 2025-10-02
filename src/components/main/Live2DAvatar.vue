<template>
  <div class="live2d-wrapper">
    <!-- Thinking bubble in top-left when streaming -->
    <div v-if="isStreaming" class="thinking-bubble" :style="thinkingBubbleStyle" aria-label="thinking">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>

    <div class="live2d-container" :class="borderClass" ref="live2dContainer">
      <canvas ref="live2dCanvas" class="live2d-canvas" @mousedown="onDragStart" @click.stop="onClick"></canvas>
    </div>
    
    <div v-if="!isReady" class="avatar-loading" :class="borderClass">
      <div v-if="loadError" class="error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-text">{{ loadError }}</div>
        <div class="error-hint">
          <div>请尝试以下解决方案：</div>
          <ul class="error-solutions">
            <li>检查模型文件是否完整</li>
            <li>重新导入模型</li>
            <li>选择其他可用模型</li>
          </ul>
        </div>
        <button 
          v-if="ac.currentModel" 
          @click="retryLoadModel" 
          class="retry-button"
          :disabled="retrying"
        >
          {{ retrying ? '重试中...' : '重试加载' }}
        </button>
      </div>
      <div v-else-if="!ac.hasAvailableModels" class="no-models-message">
        <div class="no-models-icon">📁</div>
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
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import * as PIXI from 'pixi.js';
// 仅引入 Cubism4 的实现（项目中使用 model3.json）
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { usePetStateStore } from '../../stores/petState';
import { useConversationStore } from '../../stores/conversation';
import { storeToRefs } from 'pinia';
import { registerAvatarClick } from '../../services/interactions/avatarMultiClickEmitter';
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig';
import { initializeLive2DModels } from '../../services/live2dModelService';

/* -------------------------------------------------------------------------- */
/* Constants & Config                                                         */
/* -------------------------------------------------------------------------- */

// 表情映射（将 emotion code 映射到 Live2D 表情/动作）
const emotionToExpression: Record<number, string> = {
  0: 'loop',
  1: '1desk',
  2: '5QAQ',
  3: '8punch',
  4: '4OAO',
  5: '9',
  6: '3clever',
  7: '7keyboard',
  8: '1desk',
  9: '5QAQ',
  10: '3clever',
  11: '4OAO',
  12: '6i gi a ri',
  13: '2mic',
  14: '1desk',
  15: '3clever',
  16: '4OAO',
  17: '2mic',
  18: '1desk',
};

/* -------------------------------------------------------------------------- */
/* Stores, refs and computed                                                   */
/* -------------------------------------------------------------------------- */
const state = usePetStateStore();
const conversation = useConversationStore();
const { isStreaming } = storeToRefs(conversation);
const ac = useAppearanceConfigStore();
const appWindow = getCurrentWebviewWindow();

const live2dContainer = ref<HTMLDivElement>();
const live2dCanvas = ref<HTMLCanvasElement>();
const isReady = ref(false);
const loadError = ref<string | null>(null);
const retrying = ref(false);

const borderClass = computed(() => (ac.live2dBorderType === 'circle' ? 'circle-border' : 'no-border'));

const thinkingBubbleStyle = computed(() => {
  if (!isStreaming.value) return { display: 'none' };
  return { position: 'absolute' as const, top: '10%', left: '10%', width: '30%', height: '18%', zIndex: '2' };
});

(window as any).PIXI = PIXI;

let pixiApp: PIXI.Application | null = null;
let live2dModel: Live2DModel | null = null;

/* -------------------------------------------------------------------------- */
/* Utilities and Live2D helpers                                                */
/* -------------------------------------------------------------------------- */
function loadLocalScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureCubismCore() {
  const w = window as unknown as { Live2DCubismCore?: unknown };
  if (w.Live2DCubismCore) return;
  await loadLocalScript('/live2d-core/live2dcubismcore.min.js');
}

async function processModelConfig(config: any, modelBasePath: string): Promise<any> {
  const processedConfig = JSON.parse(JSON.stringify(config));
  
  const convertPath = async (path: string) => {
    const fullPath = await join(modelBasePath, path);
    return convertFileSrc(fullPath);
  };
  
  // 处理新版本格式（model3.json）
  const refs = processedConfig.FileReferences;
  if (refs) {
    if (refs.Moc) refs.Moc = await convertPath(refs.Moc);
    if (refs.Physics) refs.Physics = await convertPath(refs.Physics);
    if (refs.DisplayInfo) refs.DisplayInfo = await convertPath(refs.DisplayInfo);
    
    if (refs.Textures) {
      for (let i = 0; i < refs.Textures.length; i++) {
        refs.Textures[i] = await convertPath(refs.Textures[i]);
      }
    }
    
    if (refs.Motions) {
      for (const groupName in refs.Motions) {
        for (const motion of refs.Motions[groupName]) {
          if (motion.File) motion.File = await convertPath(motion.File);
          if (motion.Sound) motion.Sound = await convertPath(motion.Sound);
        }
      }
    }
    
    if (refs.Expressions) {
      for (const expression of refs.Expressions) {
        if (expression.File) expression.File = await convertPath(expression.File);
      }
    }
  }
  
  // 处理旧版本格式（model.json）
  if (processedConfig.model) processedConfig.model = await convertPath(processedConfig.model);
  if (processedConfig.physics) processedConfig.physics = await convertPath(processedConfig.physics);
  
  if (processedConfig.textures) {
    for (let i = 0; i < processedConfig.textures.length; i++) {
      processedConfig.textures[i] = await convertPath(processedConfig.textures[i]);
    }
  }
  
  if (processedConfig.motions) {
    for (const groupName in processedConfig.motions) {
      for (const motion of processedConfig.motions[groupName]) {
        if (motion.file) motion.file = await convertPath(motion.file);
        if (motion.sound) motion.sound = await convertPath(motion.sound);
      }
    }
  }
  
  if (processedConfig.expressions) {
    for (const expression of processedConfig.expressions) {
      if (expression.file) expression.file = await convertPath(expression.file);
    }
  }
  
  return processedConfig;
}

async function initLive2D() {
  if (!live2dContainer.value || !live2dCanvas.value) return;

  try {
    loadError.value = null;
    await ensureCubismCore();

    const containerRect = live2dContainer.value.getBoundingClientRect();
    const canvasWidth = containerRect.width || 300;
    const canvasHeight = containerRect.height || 300;

    pixiApp = new (PIXI.Application as any)({
      view: live2dCanvas.value,
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // 获取当前选中的模型
    const currentModel = ac.currentModel;
    if (!currentModel) {
      throw new Error('没有可用的Live2D模型');
    }

    // 构建模型配置文件的完整路径
    const modelConfigPath = await join(currentModel.path, currentModel.configFile);
    
    // 读取并修改模型配置文件，将相对路径转换为绝对路径
    const configContent = await readTextFile(modelConfigPath);
    const config = JSON.parse(configContent);
    const modifiedConfig = await processModelConfig(config, currentModel.path);
    
    // 创建一个临时的blob URL来加载修改后的配置
    const configBlob = new Blob([JSON.stringify(modifiedConfig)], { type: 'application/json' });
    const configUrl = URL.createObjectURL(configBlob);

    live2dModel = await Live2DModel.from(configUrl, { autoInteract: false });
    
    // 清理临时的blob URL
    URL.revokeObjectURL(configUrl);

    if (!live2dModel || !pixiApp) {
      throw new Error('Live2D 或 PIXI 未正确初始化');
    }

    updateModelScaleAndPosition();
    pixiApp.stage.addChild(live2dModel as any);

    (live2dModel as any).eventMode = 'static';
    (live2dModel as any).cursor = 'pointer';

    playMotion('loop');
    playExpression('exp_01');

    isReady.value = true;
  } catch (err) {
    console.error('Live2D 初始化失败:', err);
    loadError.value = err instanceof Error ? err.message : '模型加载失败';
    isReady.value = false;
  }
}

function updateModelScaleAndPosition() {
  if (!live2dModel || !pixiApp) return;
  const sizeScale = ac.petSize / 200;
  const scale = sizeScale * ac.live2dModelScale;
  live2dModel.scale.set(scale);

  const centerX = pixiApp.screen.width * ac.live2dModelPositionX;
  const centerY = pixiApp.screen.height * ac.live2dModelPositionY;
  live2dModel.x = centerX;
  live2dModel.y = centerY;
  live2dModel.anchor.set(0.5, 0.5);
}

function playMotion(motionName: string) {
  if (!live2dModel) return;
  try {
    live2dModel.motion(motionName);
  } catch (e) {
    console.warn('动作播放失败:', motionName, e);
    try {
      live2dModel.motion('loop');
    } catch {}
  }
}

function playExpression(expressionName: string) {
  if (!live2dModel) return;
  try {
    live2dModel.expression(expressionName);
  } catch (err) {
    console.warn('表情播放失败:', expressionName, err);
    try {
      live2dModel.motion(expressionName);
    } catch (e) {
      console.warn('作为动作播放也失败:', expressionName, e);
    }
  }
}

function playExpressionByEmotion(emotionCode: number) {
  const name = emotionToExpression[emotionCode] || 'loop';
  playExpression(name);
}

function resizeCanvas() {
  if (!pixiApp || !live2dContainer.value) return;
  const containerRect = live2dContainer.value.getBoundingClientRect();
  pixiApp.renderer.resize(containerRect.width, containerRect.height);
  updateModelScaleAndPosition();
}

function cleanupPixiApp() {
  if (pixiApp) {
    try {
      pixiApp.destroy(true, true);
    } catch (e) {}
  }
  pixiApp = null;
  live2dModel = null;
}

async function initializeModels() {
  try {
    const models = await initializeLive2DModels();
    ac.updateAvailableModels(models);
    
    if (models.length > 0 && !ac.currentModelId) {
      ac.setCurrentModel(models[0].id);
    }
  } catch (error) {
    console.error('初始化模型列表失败:', error);
    loadError.value = error instanceof Error ? error.message : '加载模型列表失败';
  }
}

async function reloadModel() {
  if (!ac.currentModel) {
    loadError.value = '没有选中的模型';
    isReady.value = false;
    return;
  }

  try {
    cleanupPixiApp();
    isReady.value = false;
    loadError.value = null;
    
    await nextTick();
    setTimeout(async () => {
      await initLive2D();
      setTimeout(() => resizeCanvas(), 100);
    }, 50);
  } catch (error) {
    console.error('重新加载模型失败:', error);
    loadError.value = error instanceof Error ? error.message : '重新加载失败';
    isReady.value = false;
  }
}

async function retryLoadModel() {
  if (retrying.value) return;
  
  try {
    retrying.value = true;
    await reloadModel();
  } finally {
    retrying.value = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Interaction handlers                                                         */
/* -------------------------------------------------------------------------- */
function onDragStart(e: MouseEvent) {
  if ((e.buttons & 1) === 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;
  const DRAG_THRESHOLD = 5;

  const onMove = (ev: MouseEvent) => {
    if (started) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      started = true;
      void appWindow.startDragging();
      cleanup();
    }
  };

  const onUp = () => cleanup();
  function cleanup() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp, { once: true });
}

function onClick() {
  conversation.cancelAutoPlay();
  state.updateLastClickTimestamp();
  conversation.playNext();
  registerAvatarClick();
}

/* -------------------------------------------------------------------------- */
/* Watchers & lifecycle                                                         */
/* -------------------------------------------------------------------------- */
watch(() => state.currentEmotion, (v) => playExpressionByEmotion(v));

watch(() => ac.petSize, () => nextTick(() => resizeCanvas()));
watch(() => [ac.live2dModelScale, ac.live2dModelPositionX, ac.live2dModelPositionY], () => nextTick(() => updateModelScaleAndPosition()));
watch(() => ac.live2dBorderType, () => nextTick(() => resizeCanvas()));

// 监听模型切换
watch(() => ac.currentModelId, async (newModelId, oldModelId) => {
  if (newModelId !== oldModelId && newModelId) {
    console.log(`切换模型: ${oldModelId} -> ${newModelId}`);
    await reloadModel();
  }
});

onMounted(async () => {
  await nextTick();
  await initializeModels();
  
  setTimeout(async () => {
    await initLive2D();
    setTimeout(() => resizeCanvas(), 100);
  }, 50);

  window.addEventListener('resize', resizeCanvas);
  setTimeout(() => conversation.cancelInactivityWatch(), 6000);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  cleanupPixiApp();
});
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
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  user-select: none;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
}

.avatar-loading.circle-border {
  border-radius: 50%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.avatar-loading.no-border {
  border-radius: 0;
  box-shadow: none;
}

/* Error and loading states */
.error-message, .no-models-message, .loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}

.error-icon, .no-models-icon {
  font-size: 2em;
  margin-bottom: 8px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.error-text, .no-models-text, .loading-text {
  font-size: 1.1em;
  font-weight: 500;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.error-hint, .no-models-hint {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.error-solutions {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
  text-align: left;
}

.error-solutions li {
  position: relative;
  padding-left: 16px;
  margin-bottom: 4px;
  font-size: 0.85em;
}

.error-solutions li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: rgba(255, 255, 255, 0.6);
}

.retry-button {
  margin-top: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.retry-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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