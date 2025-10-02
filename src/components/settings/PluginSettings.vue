<template>
  <v-container>
    <v-card flat class="pa-2">
      <v-card-text>
        <div class="mb-8">
          <h2 class="text-h6 font-weight-bold mb-4">插件管理</h2>
          <v-divider class="mb-6"></v-divider>

          <!-- 插件列表 -->
          <div v-if="plugins.length === 0" class="text-center py-8 text-medium-emphasis">
            <v-icon size="64" color="grey-lighten-1">mdi-puzzle-outline</v-icon>
            <p class="mt-4">暂无已加载的插件</p>
          </div>

          <v-expansion-panels v-else variant="accordion" class="mb-4">
            <v-expansion-panel
              v-for="plugin in plugins"
              :key="plugin.name"
              :value="plugin.name"
            >
              <v-expansion-panel-title>
                <div class="d-flex align-center justify-space-between w-100 pr-4">
                  <div class="d-flex align-center gap-3">
                    <v-icon :color="plugin.enabled ? 'success' : 'grey'">
                      {{ plugin.enabled ? 'mdi-puzzle-check' : 'mdi-puzzle-outline' }}
                    </v-icon>
                    <div>
                      <div class="font-weight-bold">{{ plugin.name }}</div>
                      <div class="text-caption text-medium-emphasis">
                        v{{ plugin.version }} 
                        <span v-if="plugin.author">· {{ plugin.author }}</span>
                      </div>
                    </div>
                  </div>
                  <v-switch
                    v-model="plugin.enabled"
                    @click.stop
                    @change="togglePlugin(plugin.name, plugin.enabled)"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <div class="pt-2">
                  <p v-if="plugin.description" class="mb-4">{{ plugin.description }}</p>
                  
                  <!-- 插件配置 -->
                  <div v-if="plugin.configSchema && Object.keys(plugin.configSchema).length > 0">
                    <v-divider class="my-4"></v-divider>
                    <h3 class="text-subtitle-2 font-weight-bold mb-3">插件配置</h3>
                    
                    <div
                      v-for="(schema, key) in plugin.configSchema"
                      :key="key"
                      class="mb-4"
                    >
                      <!-- 字符串类型 -->
                      <v-text-field
                        v-if="schema.type === 'string'"
                        v-model="pluginConfigs[plugin.name][key]"
                        :label="schema.label"
                        :hint="schema.description"
                        :type="schema.secret ? 'password' : 'text'"
                        :required="schema.required"
                        density="comfortable"
                        variant="outlined"
                        persistent-hint
                        @blur="savePluginConfig(plugin.name, key, pluginConfigs[plugin.name][key])"
                      />
                      
                      <!-- 数字类型 -->
                      <div v-else-if="schema.type === 'number'">
                        <v-label class="mb-2">{{ schema.label }}</v-label>
                        <v-slider
                          v-model="pluginConfigs[plugin.name][key]"
                          :min="schema.min || 0"
                          :max="schema.max || 100"
                          :step="schema.step || 1"
                          thumb-label
                          @end="savePluginConfig(plugin.name, key, pluginConfigs[plugin.name][key])"
                        >
                          <template #append>
                            <v-text-field
                              v-model.number="pluginConfigs[plugin.name][key]"
                              type="number"
                              style="width: 80px"
                              density="compact"
                              variant="outlined"
                              hide-details
                              @blur="savePluginConfig(plugin.name, key, pluginConfigs[plugin.name][key])"
                            />
                          </template>
                        </v-slider>
                        <div class="text-caption text-medium-emphasis mt-1">
                          {{ schema.description }}
                        </div>
                      </div>
                      
                      <!-- 布尔类型 -->
                      <div v-else-if="schema.type === 'boolean'" class="d-flex justify-space-between align-center">
                        <div>
                          <v-label>{{ schema.label }}</v-label>
                          <div class="text-caption text-medium-emphasis">{{ schema.description }}</div>
                        </div>
                        <v-switch
                          v-model="pluginConfigs[plugin.name][key]"
                          @change="savePluginConfig(plugin.name, key, pluginConfigs[plugin.name][key])"
                          color="primary"
                          density="compact"
                          hide-details
                        />
                      </div>
                    </div>
                  </div>
                  
                  <!-- 插件操作按钮 -->
                  <div class="mt-4">
                    <v-divider class="mb-4"></v-divider>
                    <div class="d-flex gap-2">
                      <!-- 插件特定功能 -->
                      <v-btn
                        v-if="plugin.name === 'bilibili-emoji'"
                        @click="openDownloadManager"
                        color="primary"
                        variant="outlined"
                        prepend-icon="mdi-download"
                        size="small"
                      >
                        下载表情包
                      </v-btn>
                      
                      <!-- 卸载按钮 -->
                      <v-btn
                        @click="uninstallPlugin(plugin.name)"
                        color="error"
                        variant="outlined"
                        prepend-icon="mdi-delete"
                        size="small"
                      >
                        卸载插件
                      </v-btn>
                    </div>
                  </div>
                  
                  <div v-if="plugin.error" class="mt-4">
                    <v-alert type="error" variant="tonal" density="compact">
                      {{ plugin.error }}
                    </v-alert>
                  </div>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-divider class="my-6"></v-divider>

          <!-- 操作按钮 -->
          <div class="d-flex gap-2 flex-wrap">
            <v-btn
              @click="installPlugin"
              color="primary"
              prepend-icon="mdi-plus"
            >
              安装插件
            </v-btn>
            
            <v-btn
              @click="refreshPlugins"
              :loading="refreshing"
              variant="outlined"
              prepend-icon="mdi-refresh"
            >
              刷新
            </v-btn>
            
            <v-btn
              @click="openPluginFolder"
              variant="outlined"
              prepend-icon="mdi-folder-open"
            >
              打开目录
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- 下载管理器对话框 -->
    <v-dialog v-model="showDownloadManager" max-width="700">
      <DownloadManager
        @close="closeDownloadManager"
        @downloaded="handleDownloaded"
      />
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import DownloadManager from '../../../pluginLoader/plugins/bilibili-emoji/DownloadManager.vue'

interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  enabled: boolean
  loaded: boolean
  error?: string
  configSchema?: Record<string, any>
}

const plugins = ref<PluginInfo[]>([])
const pluginConfigs = reactive<Record<string, Record<string, any>>>({})
const refreshing = ref(false)
const showDownloadManager = ref(false)

// 加载插件列表
const loadPlugins = async () => {
  try {
    // 从全局插件加载器获取插件信息
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      const pluginList = pluginLoader.getPlugins()
      plugins.value = pluginList.map((p: any) => ({
        name: p.name,
        version: p.version,
        description: p.description,
        author: p.author,
        enabled: p.enabled !== false,
        loaded: p.loaded !== false,
        error: p.error,
        configSchema: p.configSchema
      }))
      
      // 加载每个插件的配置
      for (const plugin of plugins.value) {
        if (!pluginConfigs[plugin.name]) {
          pluginConfigs[plugin.name] = {}
        }
        
        // 加载配置值
        if (plugin.configSchema) {
          for (const key of Object.keys(plugin.configSchema)) {
            const schema = plugin.configSchema[key]
            const savedValue = await loadPluginConfig(plugin.name, key)
            pluginConfigs[plugin.name][key] = savedValue !== null ? savedValue : schema.default
          }
        }
      }
    }
  } catch (error) {
    console.error('加载插件列表失败:', error)
  }
}

// 加载插件配置
const loadPluginConfig = async (pluginName: string, key: string): Promise<any> => {
  try {
    const value = await invoke('get_plugin_config', { pluginName, key })
    return value
  } catch {
    return null
  }
}

// 保存插件配置
const savePluginConfig = async (pluginName: string, key: string, value: any) => {
  try {
    await invoke('set_plugin_config', { pluginName, key, value: JSON.stringify(value) })
    
    // 通知插件配置已更新
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      pluginLoader.notifyConfigChange(pluginName, key, value)
    }
  } catch (error) {
    console.error('保存插件配置失败:', error)
  }
}

// 切换插件启用状态
const togglePlugin = async (pluginName: string, enabled: boolean) => {
  try {
    await invoke('set_plugin_enabled', { pluginName, enabled })
    
    // 通知插件加载器
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      if (enabled) {
        await pluginLoader.enablePlugin(pluginName)
      } else {
        await pluginLoader.disablePlugin(pluginName)
      }
    }
  } catch (error) {
    console.error('切换插件状态失败:', error)
  }
}

// 刷新插件列表
const refreshPlugins = async () => {
  refreshing.value = true
  try {
    await loadPlugins()
  } finally {
    refreshing.value = false
  }
}

// 打开插件目录
const openPluginFolder = async () => {
  try {
    await invoke('open_plugin_folder')
  } catch (error) {
    console.error('打开插件目录失败:', error)
  }
}

// 打开下载管理器
const openDownloadManager = () => {
  showDownloadManager.value = true
}

// 关闭下载管理器
const closeDownloadManager = () => {
  showDownloadManager.value = false
}

// 下载完成后重新扫描
const handleDownloaded = async () => {
  const manager = (window as any).__bilibiliEmojiManager
  if (manager) {
    await manager.scanEmojis()
    console.log('表情包已重新扫描')
  }
}

// 安装插件
const installPlugin = async () => {
  try {
    // 打开文件选择对话框
    const selected = await open({
      multiple: false,
      filters: [{
        name: '插件包',
        extensions: ['zip']
      }]
    })
    
    if (!selected) return
    
    const zipPath = typeof selected === 'string' ? selected : (selected as any).path || selected
    
    // 调用插件加载器安装
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      const success = await pluginLoader.installPlugin(zipPath)
      if (success) {
        console.log('插件安装成功')
        await refreshPlugins()
      } else {
        console.error('插件安装失败')
      }
    }
  } catch (error) {
    console.error('安装插件失败:', error)
  }
}

// 卸载插件
const uninstallPlugin = async (pluginName: string) => {
  try {
    // 确认对话框
    if (!confirm(`确定要卸载插件 "${pluginName}" 吗？这将删除所有插件文件和配置。`)) {
      return
    }
    
    // 调用插件加载器卸载
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      const success = await pluginLoader.removePlugin(pluginName)
      if (success) {
        console.log('插件卸载成功')
        await refreshPlugins()
      } else {
        console.error('插件卸载失败')
      }
    }
  } catch (error) {
    console.error('卸载插件失败:', error)
  }
}

onMounted(() => {
  loadPlugins()
})
</script>

<style scoped>
.v-label {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 1;
}
</style>
