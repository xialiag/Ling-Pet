<template>
  <div class="plugin-page-container">
    <v-app-bar
      v-if="showHeader"
      density="compact"
      color="surface"
      class="plugin-page-header"
    >
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        @click="goBack"
      />
      
      <v-toolbar-title class="d-flex align-center">
        <v-icon
          v-if="pageConfig?.icon"
          :icon="pageConfig.icon"
          class="mr-2"
        />
        <span>{{ pageConfig?.title || 'Plugin Page' }}</span>
      </v-toolbar-title>
      
      <v-spacer />
      
      <v-chip
        v-if="pageConfig?.pluginId"
        size="small"
        color="primary"
        variant="outlined"
      >
        {{ pageConfig.pluginId }}
      </v-chip>
      
      <v-menu v-if="showMenu">
        <template #activator="{ props }">
          <v-btn
            icon="mdi-dots-vertical"
            variant="text"
            v-bind="props"
          />
        </template>
        
        <v-list>
          <v-list-item @click="refreshPage">
            <v-list-item-title>刷新页面</v-list-item-title>
            <template #prepend>
              <v-icon icon="mdi-refresh" />
            </template>
          </v-list-item>
          
          <v-list-item @click="openInNewWindow" v-if="canOpenInNewWindow">
            <v-list-item-title>在新窗口打开</v-list-item-title>
            <template #prepend>
              <v-icon icon="mdi-open-in-new" />
            </template>
          </v-list-item>
          
          <v-divider />
          
          <v-list-item @click="showPageInfo">
            <v-list-item-title>页面信息</v-list-item-title>
            <template #prepend>
              <v-icon icon="mdi-information" />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>
    
    <v-main class="plugin-page-content">
      <div class="plugin-page-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component
              :is="Component"
              v-if="Component"
              :key="$route.fullPath"
              class="plugin-page-component"
            />
          </transition>
        </router-view>
        
        <!-- 错误状态 -->
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="ma-4"
        >
          <v-alert-title>页面加载失败</v-alert-title>
          <div>{{ error }}</div>
          <template #append>
            <v-btn
              variant="text"
              @click="retryLoad"
            >
              重试
            </v-btn>
          </template>
        </v-alert>
        
        <!-- 加载状态 -->
        <div v-if="loading" class="d-flex justify-center align-center pa-8">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
          />
          <span class="ml-4">加载中...</span>
        </div>
      </div>
    </v-main>
    
    <!-- 页面信息对话框 -->
    <v-dialog v-model="showInfoDialog" max-width="500">
      <v-card>
        <v-card-title>页面信息</v-card-title>
        <v-card-text>
          <v-list density="compact">
            <v-list-item>
              <v-list-item-title>页面标题</v-list-item-title>
              <v-list-item-subtitle>{{ pageConfig?.title || '未设置' }}</v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item>
              <v-list-item-title>路由路径</v-list-item-title>
              <v-list-item-subtitle>{{ pageConfig?.path || '未知' }}</v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item>
              <v-list-item-title>所属插件</v-list-item-title>
              <v-list-item-subtitle>{{ pageConfig?.pluginId || '未知' }}</v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item v-if="pageConfig?.description">
              <v-list-item-title>页面描述</v-list-item-title>
              <v-list-item-subtitle>{{ pageConfig.description }}</v-list-item-subtitle>
            </v-list-item>
            
            <v-list-item v-if="pageConfig?.navigationGroup">
              <v-list-item-title>导航分组</v-list-item-title>
              <v-list-item-subtitle>{{ pageConfig.navigationGroup }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showInfoDialog = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PluginPageConfig } from '../core/pluginPageManager'

interface Props {
  showHeader?: boolean
  showMenu?: boolean
  canOpenInNewWindow?: boolean
}

withDefaults(defineProps<Props>(), {
  showHeader: true,
  showMenu: true,
  canOpenInNewWindow: false
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const showInfoDialog = ref(false)
const pageConfig = ref<PluginPageConfig | null>(null)

// 获取插件加载器实例
const pluginLoader = (window as any).__pluginLoader

// 监听路由变化，获取页面配置
watch(() => route.path, async (newPath) => {
  await loadPageConfig(newPath)
}, { immediate: true })

async function loadPageConfig(path: string) {
  loading.value = true
  error.value = null
  
  try {
    if (pluginLoader) {
      const pageManager = pluginLoader.getPageManager()
      if (pageManager) {
        pageConfig.value = pageManager.getPageByPath(path) || null
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '未知错误'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    router.push('/')
  }
}

function refreshPage() {
  // 强制刷新当前路由
  const currentPath = route.path
  router.replace('/').then(() => {
    router.replace(currentPath)
  })
}

function openInNewWindow() {
  // 在新窗口中打开当前页面
  const url = `${window.location.origin}${window.location.pathname}#${route.fullPath}`
  window.open(url, '_blank')
}

function showPageInfo() {
  showInfoDialog.value = true
}

function retryLoad() {
  loadPageConfig(route.path)
}

onMounted(() => {
  loadPageConfig(route.path)
})
</script>

<style scoped>
.plugin-page-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.plugin-page-content {
  flex: 1;
  overflow: auto;
}

.plugin-page-wrapper {
  height: 100%;
  position: relative;
}

.plugin-page-component {
  height: 100%;
}

.plugin-page-header {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* 页面切换动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>