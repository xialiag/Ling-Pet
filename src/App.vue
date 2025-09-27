<script setup lang="ts">
import { useAppearanceConfigStore } from './stores/configs/appearanceConfig';
import { usePetStateStore } from './stores/petState';
import { useAIConfigStore } from './stores/configs/aiConfig';
import { useScreenAnalysisConfigStore } from './stores/configs/screenAnalysisConfig';
import { useVitsConfigStore } from './stores/configs/vitsConfig';
import { useConversationStore } from './stores/conversation';
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { denySave } from '@tauri-store/pinia';
import { useSessionStore } from './stores/session';
import { useNotificationStore } from './stores/notification';
import { useMemoryStore } from './stores/memory';
import { useScheduleStore } from './stores/schedule';

const ac = useAppearanceConfigStore();
const unlistenFns: UnlistenFn[] = [];

// 工具函数：检查开发者工具是否开启
function isDevToolsEnabled(): boolean {
  return ac.showDevTools ?? false;
}

// 优化事件处理函数
function handleEvent(event: Event, shouldPrevent: boolean) {
  if (!isDevToolsEnabled() && shouldPrevent) {
    event.preventDefault();
    return false;
  }
}

// 右键菜单控制函数
function handleContextMenu(event: MouseEvent) {
  // 在全局范围内，如果开发者工具未开启，则禁用右键菜单
  return handleEvent(event, true);
}

// 禁用选择
function handleSelectStart(event: Event) {
  return handleEvent(event, true);
}

// 禁用拖拽
function handleDragStart(event: DragEvent) {
  return handleEvent(event, true);
}

onMounted(async () => {
  useAppearanceConfigStore().$tauri.start();
  usePetStateStore().$tauri.start();
  useAIConfigStore().$tauri.start();
  useScreenAnalysisConfigStore().$tauri.start();
  useConversationStore().$tauri.start();
  useSessionStore().$tauri.start();
  useVitsConfigStore().$tauri.start();
  useNotificationStore().$tauri.start();
  useMemoryStore().$tauri.start();
  useScheduleStore().$tauri.start();
  // 会话编排使用非持久化的会话 store（conversation），无需 denySave
  denySave('conversation');
  denySave('notification');

  // 添加全局右键事件监听器
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('selectstart', handleSelectStart);
  document.addEventListener('dragstart', handleDragStart);

  // 监听开发者工具设置变化，动态更新体选择器样式
  watch(() => isDevToolsEnabled(), (enabled) => {
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.classList.toggle('disable-context-menu', !enabled);
    }
  }, { immediate: true });

  const toggleDevToolsUnlisten = await listen('lingpet://toggle-devtools', () => {
    ac.showDevTools = !ac.showDevTools;
  });
  unlistenFns.push(toggleDevToolsUnlisten);
});

onBeforeUnmount(() => {
  unlistenFns.forEach((stop) => stop());
  document.removeEventListener('contextmenu', handleContextMenu);
  document.removeEventListener('selectstart', handleSelectStart);
  document.removeEventListener('dragstart', handleDragStart);
});
</script>

<template>
  <router-view />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body::-webkit-scrollbar {
  display: none;
  /* Windows禁止显示滚动条 */
}

/* 禁用右键菜单和用户选择的样式 */
.disable-context-menu {
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
  -webkit-user-drag: none !important;
  -khtml-user-drag: none !important;
  -moz-user-drag: none !important;
  -o-user-drag: none !important;
}

.disable-context-menu * {
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
  -webkit-user-drag: none !important;
  -khtml-user-drag: none !important;
  -moz-user-drag: none !important;
  -o-user-drag: none !important;
  pointer-events: auto;
}

/* 保证输入框和可编辑元素仍然可用 */
.disable-context-menu input,
.disable-context-menu textarea,
.disable-context-menu [contenteditable="true"] {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
</style>
