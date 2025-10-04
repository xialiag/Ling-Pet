<script setup lang="ts">
import { onMounted, watchEffect, onUnmounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { listen } from '@tauri-apps/api/event';
import Live2DAvatar from '../components/main/Live2DAvatar.vue';
import Input from '../components/main/Input.vue';
import DecorationsHost from '../components/main/decorations/DecorationsHost.vue';
import { useAppearanceConfigStore } from '../stores/configs/appearanceConfig';
import { chatBubbleManager } from '../services/chatBubbleManager/chatBubbleManager';
import { createGlobalHandlersManager } from '../services/events/globalHandlers';
import { useVitsConfigStore } from '../stores/configs/vitsConfig.ts';
import { startSbv2 } from '../services/voice/sbv2Process';
import { startNoInteractionWatcher, stopNoInteractionWatcher } from '../services/interactions/noInteractionWatcher';
import { useScheduleStore } from '../stores/schedule.ts';
import { useSessionStore } from '../stores/session.ts';
import { showNotification } from '../services/notificationService';

const ac = useAppearanceConfigStore();
const ss = useSessionStore();
const window = getCurrentWebviewWindow();
const { startChatBubbleWatching, stopChatBubbleWatching } = chatBubbleManager();
const globalHandlersManager = createGlobalHandlersManager();
const vitsConfig = useVitsConfigStore();

onMounted(async () => {
  ss.currentSession = [];
  startPetSizeWatching();
  startChatBubbleWatching();
  globalHandlersManager.start();

  if (vitsConfig.autoStartSbv2) {
    startSbv2(vitsConfig.installPath);
  }

  startNoInteractionWatcher();

  // 跨屏拖动在 macOS/多显示器下可能触发窗口尺寸重置为默认 200×200
  // 这里监听窗口移动/缩放相关事件并强制按照配置尺寸恢复
  startWindowMovementListening();

  // 监听插件事件
  startPluginEventListening();

  const schedule = useScheduleStore()
  console.log('[schedule] init: rehydrate + startHeartbeat')
  schedule.rehydrate()
  schedule.startHeartbeat()
});

onUnmounted(() => {
  stopPetSizeWatcher?.();
  stopChatBubbleWatching();
  globalHandlersManager.stop();
  stopNoInteractionWatcher();
  // 中文注释：移除窗口事件监听，避免重复绑定
  stopWindowMovementListening?.();
  // 中文注释：移除插件事件监听
  stopPluginEventListening?.();
});

let stopPetSizeWatcher: (() => void) | null = null;
let stopWindowMovementListening: (() => void) | null = null;
let stopPluginEventListening: (() => void) | null = null;

async function startWindowMovementListening() {
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
  stopWindowMovementListening = () => stops.forEach((fn) => { try { fn() } catch { } })
  return
}

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

// 监听插件事件
async function startPluginEventListening() {
  const stops: Array<() => void> = []
  
  try {
    // 监听插件启用事件
    const stopEnabled = await listen('plugin:enabled', async (event: any) => {
      const { pluginName } = event.payload
      console.log(`[MainPage] 收到插件启用事件: ${pluginName}`)
      
      // 显示插件启用通知
      try {
        await showNotification({
          title: '插件已启用',
          message: `插件 "${pluginName}" 已成功启用`,
          duration_ms: 3000
        })
      } catch (error) {
        console.warn('[MainPage] 显示插件启用通知失败:', error)
      }
    })
    stops.push(stopEnabled)
    
    // 监听插件禁用事件
    const stopDisabled = await listen('plugin:disabled', async (event: any) => {
      const { pluginName } = event.payload
      console.log(`[MainPage] 收到插件禁用事件: ${pluginName}`)
      
      // 显示插件禁用通知
      try {
        await showNotification({
          title: '插件已禁用',
          message: `插件 "${pluginName}" 已禁用`,
          duration_ms: 3000
        })
      } catch (error) {
        console.warn('[MainPage] 显示插件禁用通知失败:', error)
      }
    })
    stops.push(stopDisabled)
    
    // 监听插件卸载事件
    const stopRemoved = await listen('plugin:removed', async (event: any) => {
      const { pluginName } = event.payload
      console.log(`[MainPage] 收到插件卸载事件: ${pluginName}`)
      
      // 显示插件卸载成功通知
      try {
        await showNotification({
          title: '插件已卸载',
          message: `插件 "${pluginName}" 已完全卸载`,
          duration_ms: 4000
        })
      } catch (error) {
        console.warn('[MainPage] 显示插件卸载通知失败:', error)
      }
      
      // 清理与该插件相关的任何状态
      // 这里可以添加更多的清理逻辑，比如：
      // - 清理插件注入的组件
      // - 清理插件的工具
      // - 重置相关配置等
      const pluginLoader = (window as any).__pluginLoader
      if (pluginLoader) {
        console.log(`[MainPage] 确保插件 ${pluginName} 的所有资源已清理`)
      }
    })
    stops.push(stopRemoved)
    
    console.log('[MainPage] 插件事件监听已启动')
  } catch (error) {
    console.error('[MainPage] 启动插件事件监听失败:', error)
  }
  
  // 设置清理函数
  stopPluginEventListening = () => {
    stops.forEach((fn) => {
      try {
        fn()
      } catch (error) {
        console.warn('[MainPage] 清理插件事件监听器时出错:', error)
      }
    })
    console.log('[MainPage] 插件事件监听已停止')
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
