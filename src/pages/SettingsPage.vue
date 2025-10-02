<template>
  <v-layout class="settings-page bg-grey-lighten-5">
    <v-navigation-drawer permanent width="180">
      <v-list>
        <v-list-item class="px-4 pt-4 pb-3">
          <v-list-item-title class="text-h6 font-weight-bold">设置</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-divider></v-divider>
      <v-list v-model:selected="selectedTab" nav color="primary" density="compact" class="pa-2">
        <v-list-item
          v-for="tab in availableTabs"
          :key="tab.id"
          :value="tab.id"
          :prepend-icon="iconMap[tab.icon]"
          :title="tab.name"
          @click="switchTab(tab.id)"
          rounded="lg"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main scrollable>
      <div class="main-header pa-5 bg-surface border-b">
        <h2 class="text-h5 font-weight-bold">{{ currentTab.name }}</h2>
      </div>

      <v-window v-model="currentTab.id" class="pa-3 pa-md-5">
        <v-window-item value="appearance" :transition="false"><AppearanceSettings /></v-window-item>
        <v-window-item value="ai" :transition="false"><AISettings /></v-window-item>
        <v-window-item value="vits" :transition="false"><VitsSettings /></v-window-item>
        <v-window-item value="screenAnalysis" :transition="false"><ScreenAnalysisSettings /></v-window-item>
        <v-window-item value="schedule" :transition="false"><ScheduleSettings /></v-window-item>
        <v-window-item value="plugins" :transition="false"><PluginSettings /></v-window-item>
        <v-window-item value="about" :transition="false"><AboutSettings /></v-window-item>
      </v-window>
    </v-main>
  </v-layout>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import AppearanceSettings from '../components/settings/AppearanceSettings.vue'
import AISettings from '../components/settings/AISettings.vue'
import VitsSettings from '../components/settings/VitsSettings.vue'
import AboutSettings from '../components/settings/AboutSettings.vue'
import ScreenAnalysisSettings from '../components/settings/ScreenAnalysisSettings.vue'
import ScheduleSettings from '../components/settings/ScheduleSettings.vue'
import PluginSettings from '../components/settings/PluginSettings.vue'

// 中文注释：设置页标签配置，新增“调度”标签
const SETTINGS_TABS = [
  { id: 'appearance', name: '外观设置', icon: 'appearance' },
  { id: 'ai', name: 'AI设置', icon: 'ai' },
  { id: 'vits', name: '语音设置', icon: 'vits' },
  { id: 'screenAnalysis', name: '屏幕分析', icon: 'screenAnalysis' },
  { id: 'schedule', name: '调度', icon: 'schedule' },
  { id: 'plugins', name: '插件管理', icon: 'plugins' },
  { id: 'about', name: '关于', icon: 'about' },
]
const DEFAULT_ACTIVE_TAB = 'appearance'

// 中文注释：本地状态
const settingsState = ref({
  activeTab: DEFAULT_ACTIVE_TAB,
  isLoading: false,
})

// 中文注释：当前 tab 与可用 tab
const currentTab = computed(() => SETTINGS_TABS.find(tab => tab.id === settingsState.value.activeTab) || SETTINGS_TABS[0])
const availableTabs = computed(() => SETTINGS_TABS)

// 中文注释：切换标签页
function switchTab(tabId: string) {
  const tab = SETTINGS_TABS.find(t => t.id === tabId)
  if (tab) settingsState.value.activeTab = tabId
}

// 中文注释：导航选择同步
const selectedTab = ref([currentTab.value.id])
watch(currentTab, newTab => {
  if (selectedTab.value[0] !== newTab.id) selectedTab.value = [newTab.id]
})

// 中文注释：图标映射，新增 plugins 图标
const iconMap: Record<string, string> = {
  appearance: 'mdi-palette-swatch-outline',
  ai: 'mdi-brain',
  vits: 'mdi-volume-high',
  screenAnalysis: 'mdi-monitor-screenshot',
  schedule: 'mdi-clock-outline',
  plugins: 'mdi-puzzle',
  xp: 'mdi-heart-multiple',
  about: 'mdi-information-outline',
}
</script>

<style scoped>
.settings-page { width: 100vw; height: 100vh; min-width: 800px; min-height: 600px; }
.v-main { height: 100vh; }
</style>