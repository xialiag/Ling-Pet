<script setup lang="ts">
import { useAppearanceConfigStore } from './stores/configs/appearanceConfig';
import { usePetStateStore } from './stores/petState';
import { useAIConfigStore } from './stores/configs/aiConfig';
import { useChatHistoryStore } from './stores/chatHistory';
import { useScreenAnalysisConfigStore } from './stores/configs/screenAnalysisConfig';
import { useVitsConfigStore } from './stores/configs/vitsConfig';
import { useConversationStore } from './stores/conversation';
import { onMounted, watch } from 'vue';
import { denySave } from '@tauri-store/pinia';

// 常量定义
const MAIN_PAGE_PATHS = ['', '#/', '#'] as const;

const ac = useAppearanceConfigStore();

// 工具函数：检查是否为主页面
function isMainPage(): boolean {
  return MAIN_PAGE_PATHS.includes(window.location.hash);
}

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
  // 如果在主页面，让主页面组件自己处理右键菜单
  if (isMainPage()) {
    return;
  }
  
  // 在其他页面，如果开发者工具未开启，则禁用右键菜单
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
  useChatHistoryStore().$tauri.start();
  useScreenAnalysisConfigStore().$tauri.start();
  useConversationStore().$tauri.start();
  const vitsConfig = useVitsConfigStore();
  vitsConfig.$tauri.start();
  // 会话编排使用非持久化的会话 store（conversation），无需 denySave
  denySave('conversation');

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
