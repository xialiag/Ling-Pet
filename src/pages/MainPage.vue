<script setup lang="ts">
import { onMounted, watchEffect, onUnmounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import Live2DAvatar from '../components/main/Live2DAvatar.vue';
import Input from '../components/main/Input.vue';
import DecorationsHost from '../components/main/decorations/DecorationsHost.vue';
import { useAppearanceConfigStore } from '../stores/configs/appearanceConfig';
import { windowListMaintainer } from '../services/screenAnalysis/windowListMaintainer';
import { chatBubbleManager } from '../services/chatBubbleManager/chatBubbleManager';
import { createGlobalHandlersManager } from '../services/events/globalHandlers';
import { useVitsConfigStore } from '../stores/configs/vitsConfig.ts';
import { startSbv2 } from '../services/chatAndVoice/sbv2Process';
import { registerDefaultTools } from '../services/tools/index.ts';
import { startNoInteractionWatcher, stopNoInteractionWatcher } from '../services/interactions/noInteractionWatcher';
import { useMemoryStore } from '../stores/memory.ts';
import { useHypothesesStore } from '../stores/hypotheses.ts';
import { useScheduleStore } from '../stores/schedule.ts';

const ac = useAppearanceConfigStore();
const window = getCurrentWebviewWindow();
const { startWindowListMaintaining, stopWindowListMaintaining } = windowListMaintainer();
const { startChatBubbleWatching, stopChatBubbleWatching } = chatBubbleManager();
const globalHandlersManager = createGlobalHandlersManager();
const vitsConfig = useVitsConfigStore();

onMounted(async () => {
  try {
    useMemoryStore().$tauri.start();
    useHypothesesStore().$tauri.start();

    registerDefaultTools()
    startPetSizeWatching();
    startChatBubbleWatching();
    globalHandlersManager.start();
    startWindowListMaintaining();

    if (vitsConfig.autoStartSbv2) {
      startSbv2(vitsConfig.installPath);
    }

    startNoInteractionWatcher();

    // 跨屏拖动在 macOS/多显示器下可能触发窗口尺寸重置为默认 200×200
    // 这里监听窗口移动/缩放相关事件并强制按照配置尺寸恢复
    try {
      // 中文注释：记录用于卸载的停止函数
      const stops: Array<() => void> = []
      // 中文注释：监听窗口被移动（包括跨屏）
      const stopMoved = await window.onMoved(async () => {
        await setWindowToSquare()
      })
      stops.push(stopMoved)
      // 中文注释：尽可能监听缩放因子变化（不同屏幕 DPR 切换）
      const anyWin: any = window as unknown as any
      if (typeof anyWin.onScaleChanged === 'function') {
        const stopScale = await anyWin.onScaleChanged(async () => {
          await setWindowToSquare()
        })
        stops.push(stopScale)
      }
      // 中文注释：兜底监听尺寸变化，确保内部画布跟随
      if (typeof window.onResized === 'function') {
        const stopResized = await (window as any).onResized(async () => {
          await setWindowToSquare()
        })
        stops.push(stopResized)
      }
      // 中文注释：在组件卸载时清理监听器
      stopWindowEventListeners = () => stops.forEach((fn) => { try { fn() } catch {} })
    } catch (e) {
      console.warn('注册窗口事件监听失败（可忽略）:', e)
    }

    // Initialize schedule manager: restore state and start heartbeat
    try {
      const schedule = useScheduleStore()
      console.log('[schedule] init: start storage + rehydrate + startHeartbeat')
      schedule.$tauri.start()
      schedule.rehydrate()
      schedule.startHeartbeat()
    } catch (e) {
      console.error('Failed to initialize schedule manager:', e)
    }
  } catch (error) {
    console.error('MainPage初始化失败:', error)
  }
});

onUnmounted(() => {
  stopPetSizeWatcher?.();
  stopChatBubbleWatching();
  globalHandlersManager.stop();
  stopWindowListMaintaining();
  stopNoInteractionWatcher();
  // 中文注释：移除窗口事件监听，避免重复绑定
  stopWindowEventListeners?.()
});

let stopPetSizeWatcher: (() => void) | null = null;
let stopWindowEventListeners: (() => void) | null = null;

async function setWindowToSquare() {
  try {
    await window.setSize(new LogicalSize(ac.petSize, ac.petSize + 30));
  } catch (error) {
    console.error('设置窗口大小失败:', error)
  }
}

async function startPetSizeWatching() {
  await setWindowToSquare();

  if (!stopPetSizeWatcher) {
    stopPetSizeWatcher = watchEffect(async () => {
      await setWindowToSquare();
    });
  }
}
</script>

<template>
  <div class="main-wrapper" :style="{ opacity: ac.opacity }" @wheel.prevent
    @selectstart.prevent="!(ac.showDevTools ?? false)" @dragstart.prevent="!(ac.showDevTools ?? false)">
    <DecorationsHost />
    <Live2DAvatar />
    <Input class="input" />
  </div>
</template>

<style scoped>
.main-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  overscroll-behavior: none;
  padding: 5px;

  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.main-wrapper:hover .input,
.main-wrapper:focus-within .input {
  opacity: 0.95;
}

.main-wrapper:hover .button,
.main-wrapper:focus-within .button {
  opacity: 1;
}
</style>
