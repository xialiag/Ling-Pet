<template>
  <div class="live2d-wrapper">
    <!-- Thinking bubble in top-left when streaming -->
    <div v-if="conversation.isStreaming" class="thinking-bubble" aria-label="thinking">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>

    <div class="live2d-container" ref="live2dContainer">
      <canvas ref="live2dCanvas" class="live2d-canvas" @mousedown="onDragStart" @click.stop="onClick"></canvas>
    </div>
    
    <div v-if="!isReady" class="avatar-loading">Live2D加载中……</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import * as PIXI from 'pixi.js';
// 仅引入 Cubism 3/4 的实现，避免 v2 运行时强制校验
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { usePetStateStore } from '../../stores/petState';
import { useConversationStore } from '../../stores/conversation';
import { registerAvatarClick } from '../../services/interactions/avatarMultiClickEmitter';
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig';
import { useMemoryStore } from '../../stores/memory';

const state = usePetStateStore();
const appWindow = getCurrentWebviewWindow();
const conversation = useConversationStore();
const ac = useAppearanceConfigStore();

const live2dContainer = ref<HTMLDivElement>();
const live2dCanvas = ref<HTMLCanvasElement>();
const isReady = ref(false);

// 暴露 PIXI 到 window，方便 live2d 插件拿到 Ticker
(window as any).PIXI = PIXI;

let pixiApp: PIXI.Application | null = null;
let live2dModel: Live2DModel | null = null;

// 脚本加载工具（仅本地文件）
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

// 确保加载 Cubism 4 核心运行时（live2dcubismcore.min.js）
async function ensureCubismCore() {
  const w = window as unknown as { Live2DCubismCore?: unknown };
  if (w.Live2DCubismCore) return;
  await loadLocalScript('/live2d-core/live2dcubismcore.min.js');
}

// 确保加载 Cubism 2 运行时（live2d.min.js）
async function ensureCubism2() {
  const w = window as unknown as { Live2D?: unknown };
  if ((w as any).Live2D) return;
  await loadLocalScript('/live2d-core/live2d.min.js');
}

// 根据模型文件自动选择需要的运行时
async function ensureLive2DRuntimeForModel(modelPath: string) {
  const lower = modelPath.toLowerCase();
  if (lower.endsWith('.model3.json') || lower.endsWith('.moc3')) {
    await ensureCubismCore();
  } else if (lower.endsWith('.model.json') || lower.endsWith('.moc')) {
    await ensureCubism2();
  } else {
    // 默认按 v3/4 处理
    await ensureCubismCore();
  }
}

// Live2D模型路径配置
const modelConfig = {
  // UGOfficial模型的主配置文件
  modelPath: '/live2d/snowfox/model0.json',
  scale: 0.08, // 稍微增大缩放比例，让模型更明显
  position: { x: 0.5, y: 0.8 } // 稍微上移一点，因为模型可能底部有空白
};

// 表情映射：将你现有的emotion code映射到Live2D表情和动作
// 基于UGOfficial模型的表情文件名映射
const emotionToExpression: Record<number, string> = {
  0: 'loop', // 默认循环动作
  1: '1desk', // 桌面/工作状态
  2: '5QAQ', // 伤心
  3: '8punch', // 生气/打击
  4: '4OAO', // 惊讶
  5: '9', // 眨眼等
  6: '3clever', // 聪明/点头
  7: '7keyboard', // 摇头/键盘
  8: '1desk', // 开心/工作
  9: '5QAQ', // 哭泣
  10: '3clever', // 微笑/聪明
  11: '4OAO', // 眨眼
  12: '6i gi a ri', // 亲吻/特殊表情
  13: '2mic', // 爱心/麦克风
  14: '1desk', // 睡觉/桌面
  15: '3clever', // 思考/聪明
  16: '4OAO', // 疑问/惊讶
  17: '2mic', // 打招呼/麦克风
  18: '1desk' // 再见/桌面
  // 根据UGOfficial模型的实际表情文件调整
};

async function initLive2D() {
  if (!live2dContainer.value || !live2dCanvas.value) return;
  
  try {
    // 在加载模型前根据模型类型加载对应运行时（仅本地）
    await ensureLive2DRuntimeForModel(modelConfig.modelPath);

    // 获取实际的容器尺寸
    const containerRect = live2dContainer.value.getBoundingClientRect();
    const canvasWidth = containerRect.width || 300;
    const canvasHeight = containerRect.height || 300;

    // 创建 PIXI 应用：兼容 v7 / v8 两种初始化方式
    const isV8 = 'init' in (PIXI.Application.prototype as any);
    if (isV8) {
      pixiApp = new PIXI.Application() as any;
      await (pixiApp as any).init({
        canvas: live2dCanvas.value,
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0, // 透明背景
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    } else {
      pixiApp = new (PIXI.Application as any)({
        view: live2dCanvas.value,
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0, // 透明背景
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    }

    // 加载Live2D模型（禁用内置交互以兼容 Pixi v7/v8 差异）
    live2dModel = await Live2DModel.from(modelConfig.modelPath, {
      autoInteract: false,
    });
    
    if (live2dModel) {
      if (!pixiApp) throw new Error('PIXI Application not initialized');
      // 设置模型缩放和位置
      live2dModel.scale.set(modelConfig.scale);
      
      // 更精确的居中计算
      const centerX = pixiApp.screen.width * modelConfig.position.x;
      const centerY = pixiApp.screen.height * modelConfig.position.y;
      
      live2dModel.x = centerX;
      live2dModel.y = centerY;
      live2dModel.anchor.set(0.5, 0.5);

      // 添加到舞台
      pixiApp.stage.addChild(live2dModel as any);
      
      // 启用交互（使用类型断言解决兼容性问题）
      (live2dModel as any).eventMode = 'static';
      (live2dModel as any).cursor = 'pointer';
      
      // 设置默认动画
      playMotion('loop');
      
      console.log('Live2D模型已加载并居中:', { 
        modelX: live2dModel.x, 
        modelY: live2dModel.y, 
        screenWidth: pixiApp.screen.width, 
        screenHeight: pixiApp.screen.height,
        centerX,
        centerY,
        containerRect: live2dContainer.value?.getBoundingClientRect()
      });
      
      isReady.value = true;
      
      // 确保模型真正居中，延迟再次检查
      setTimeout(() => {
        if (live2dModel && pixiApp && live2dContainer.value) {
          const rect = live2dContainer.value.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const newCenterX = rect.width * modelConfig.position.x;
            const newCenterY = rect.height * modelConfig.position.y;
            live2dModel.x = newCenterX;
            live2dModel.y = newCenterY;
            console.log('延迟调整后的模型位置:', { 
              modelX: live2dModel.x, 
              modelY: live2dModel.y,
              rectWidth: rect.width,
              rectHeight: rect.height
            });
          }
        }
      }, 200);
    }
  } catch (error) {
    console.error('Live2D初始化失败:', error);
    isReady.value = false;
  }
}

function playMotion(motionName: string) {
  if (!live2dModel) return;
  
  try {
    // 播放指定动作
    live2dModel.motion(motionName);
  } catch (error) {
    console.warn('动作播放失败:', motionName, error);
    // 回退到默认动作
    live2dModel.motion('loop');
  }
}

function playExpression(expressionName: string) {
  if (!live2dModel) return;
  
  try {
    // 播放指定表情
    live2dModel.expression(expressionName);
  } catch (error) {
    console.warn('表情播放失败:', expressionName, error);
    // 尝试作为动作播放
    try {
      live2dModel.motion(expressionName);
    } catch (motionError) {
      console.warn('作为动作播放也失败:', expressionName, motionError);
    }
  }
}

function playExpressionByEmotion(emotionCode: number) {
  const expressionName = emotionToExpression[emotionCode] || 'loop';
  playExpression(expressionName);
}

function onDragStart(e: MouseEvent) {
  // 仅在按下主键时启用拖拽判定
  if ((e.buttons & 1) === 0) return;

  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;

  const DRAG_THRESHOLD = 5; // 像素，避免点击触发拖拽

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
  // 取消可能存在的自动播放定时器
  conversation.cancelAutoPlay();
  
  state.updateLastClickTimestamp();
  conversation.playNext();
  registerAvatarClick();
  
  // 播放点击动作
  playMotion('tap_body');
}

function resizeCanvas() {
  if (!pixiApp || !live2dContainer.value) return;
  
  const containerRect = live2dContainer.value.getBoundingClientRect();
  pixiApp.renderer.resize(containerRect.width, containerRect.height);
  
  if (live2dModel) {
    // 更精确的居中重新计算
    const centerX = containerRect.width * modelConfig.position.x;
    const centerY = containerRect.height * modelConfig.position.y;
    
    live2dModel.x = centerX;
    live2dModel.y = centerY;
    
    console.log('Canvas已重新调整大小，模型重新居中:', { 
      containerWidth: containerRect.width, 
      containerHeight: containerRect.height,
      modelX: live2dModel.x, 
      modelY: live2dModel.y,
      centerX,
      centerY
    });
  }
}

// 监听表情变化
watch(() => state.currentEmotion, (newEmotion) => {
  playExpressionByEmotion(newEmotion);
});

// 监听容器大小变化
watch(() => ac.petSize, () => {
  nextTick(() => {
    resizeCanvas();
  });
});

onMounted(async () => {
  await nextTick();
  
  // 确保容器已经有正确的尺寸，延迟一点时间
  setTimeout(async () => {
    await initLive2D();
    
    // 初始化完成后再次确保居中
    setTimeout(() => {
      resizeCanvas();
    }, 100);
  }, 50);
  
  // 添加窗口大小监听
  window.addEventListener('resize', resizeCanvas);
  
  // 初始化对话内容（保持原有逻辑）
  setTimeout(() => {
    if (useMemoryStore().firstLaunch) {
      [
        {
          message: '你好呀，初次见面~',
          emotion: 10,
          japanese: 'こんにちは〜',
        },
        {
          message: '我叫钦灵，从今天开始我就住在你的电脑里了……',
          emotion: 17,
          japanese: '私はりんと申します。今日からあなたのパートナーになります。',
        },
        {
          message: '你可以叫我灵灵',
          emotion: 8,
          japanese: 'りんりんと呼んでください。',
        },
        {
          message: '你呢？如果能告诉我你的名字的话，我会很开心的~',
          emotion: 10,
          japanese: '差し支えなければ、あなたのお名前を教えていただけますか？',
        }
      ].forEach(item => {
        conversation.addItem(item);
      });
    }
    useMemoryStore().firstLaunch = false;
  }, 2000);
  
  setTimeout(() => {
    conversation.cancelInactivityWatch();
  }, 6000);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  if (pixiApp) {
    pixiApp.destroy(true, true);
  }
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
  width: 80%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  background: transparent;
}

.live2d-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
  border-radius: 50%;
}

.live2d-container:hover {
  transform: scale(1.05);
  transform-origin: center center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.avatar-loading {
  width: 80%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  user-select: none;
}

/* Thinking bubble - 保持原有样式 */
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
