<template>
  <div class="plugin-navigation">
    <v-list v-if="navigationItems.length > 0">
      <v-list-subheader>插件页面</v-list-subheader>
      
      <template v-for="group in groupedItems" :key="group.name">
        <v-list-subheader v-if="group.name !== 'default'" class="text-caption">
          {{ group.displayName }}
        </v-list-subheader>
        
        <v-list-item
          v-for="item in group.items"
          :key="item.id"
          :to="item.path"
          :prepend-icon="item.icon || 'mdi-puzzle'"
          :title="item.title"
          :subtitle="item.description"
          class="plugin-nav-item"
        >
          <template #append>
            <v-chip
              size="x-small"
              color="primary"
              variant="outlined"
            >
              {{ item.pluginId }}
            </v-chip>
          </template>
        </v-list-item>
      </template>
    </v-list>
    
    <v-empty-state
      v-else
      icon="mdi-puzzle-outline"
      title="暂无插件页面"
      text="已加载的插件中没有注册页面"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { PluginNavigationItem } from '../core/pluginPageManager'

// 获取插件加载器实例
const pluginLoader = (window as any).__pluginLoader

interface NavigationGroup {
  name: string
  displayName: string
  items: PluginNavigationItem[]
}

const navigationItems = ref<PluginNavigationItem[]>([])
let unsubscribe: (() => void) | null = null

// 分组导航项
const groupedItems = computed<NavigationGroup[]>(() => {
  const groups = new Map<string, PluginNavigationItem[]>()
  
  navigationItems.value.forEach(item => {
    const groupName = item.group || 'default'
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName)!.push(item)
  })
  
  return Array.from(groups.entries()).map(([name, items]) => ({
    name,
    displayName: getGroupDisplayName(name),
    items: items.sort((a, b) => (a.order || 0) - (b.order || 0))
  }))
})

function getGroupDisplayName(groupName: string): string {
  const displayNames: Record<string, string> = {
    'default': '默认',
    'plugins': '插件',
    'tools': '工具',
    'settings': '设置',
    'entertainment': '娱乐',
    'productivity': '效率',
    'social': '社交',
    'media': '媒体'
  }
  
  return displayNames[groupName] || groupName
}

onMounted(() => {
  if (pluginLoader) {
    const pageManager = pluginLoader.getPageManager()
    if (pageManager) {
      // 监听导航变化
      unsubscribe = pageManager.onNavigationChange((items: PluginNavigationItem[]) => {
        navigationItems.value = items
      })
    }
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.plugin-navigation {
  width: 100%;
}

.plugin-nav-item {
  margin-bottom: 4px;
}

.plugin-nav-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
}
</style>