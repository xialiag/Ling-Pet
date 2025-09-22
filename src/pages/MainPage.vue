<script setup lang="ts">
import { onMounted, ref, watchEffect, onUnmounted } from 'vue';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/dpi';
import Live2DAvatar from '../components/main/Live2DAvatar.vue';
import Input from '../components/main/Input.vue';
import DecorationsHost from '../components/main/decorations/DecorationsHost.vue';
import ContextMenu from '../components/main/ContextMenu.vue';
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

const contextMenuRef = ref();
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
});

let stopPetSizeWatcher: (() => void) | null = null;

async function setWindowToSquare() {
  try {
    await window.setSize(new LogicalSize(ac.petSize, ac.petSize + 30));
  } catch (error) {
    console.error('设置窗口大小失败:', error)
  }
}

function handleContextMenu(event: MouseEvent) {
  const isDevToolsEnabled = ac.showDevTools ?? false;
  contextMenuRef.value?.showMenu(event);
  if (!isDevToolsEnabled) {
    event.preventDefault();
    event.stopPropagation();
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
  <div class="main-wrapper"
       :style="{ opacity: ac.opacity }"
       @wheel.prevent
       @contextmenu="handleContextMenu"
       @selectstart.prevent="!(ac.showDevTools ?? false)"
       @dragstart.prevent="!(ac.showDevTools ?? false)">
    <DecorationsHost />
    <Live2DAvatar />
    <Input class="input" />
    <ContextMenu ref="contextMenuRef" />
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
