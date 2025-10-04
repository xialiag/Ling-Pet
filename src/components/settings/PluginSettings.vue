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
                    
                    <PluginConfigField
                      v-for="(schema, key) in plugin.configSchema"
                      :key="key"
                      :field-key="key"
                      :schema="schema"
                      :value="pluginConfigs[plugin.name]?.[key]"
                      :all-config="pluginConfigs[plugin.name] || {}"
                      @update:value="savePluginConfig(plugin.name, key, $event)"
                    />
                  </div>
                  
                  <!-- 插件操作按钮 -->
                  <div class="mt-4">
                    <v-divider class="mb-4"></v-divider>
                    <div class="d-flex gap-2 flex-wrap">
                      <!-- 插件自定义操作按钮 -->
                      <v-btn
                        v-for="(action, index) in getPluginActions(plugin.name)"
                        :key="index"
                        @click="action.handler"
                        :color="action.color || 'primary'"
                        :variant="action.variant || 'outlined'"
                        :prepend-icon="action.icon"
                        :disabled="typeof action.disabled === 'function' ? action.disabled() : action.disabled"
                        :loading="typeof action.loading === 'function' ? action.loading() : action.loading"
                        size="small"
                      >
                        {{ action.label }}
                      </v-btn>
                      
                      <!-- 卸载按钮 -->
                      <v-btn
                        @click="uninstallPlugin(plugin.name)"
                        :disabled="uninstalling"
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
              :loading="installing"
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
          
          <!-- 错误和成功消息 -->
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mt-4" closable @click:close="errorMessage = ''">
            {{ errorMessage }}
          </v-alert>
          <v-alert v-if="successMessage" type="success" variant="tonal" density="compact" class="mt-4" closable @click:close="successMessage = ''">
            {{ successMessage }}
          </v-alert>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- 卸载确认对话框 -->
    <v-dialog 
      v-model="uninstallDialog" 
      max-width="500"
      persistent
      :disabled="uninstalling"
      @keydown.esc="cancelUninstall"
      @keydown.enter="confirmUninstall"
    >
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle</v-icon>
          确认卸载插件
        </v-card-title>
        
        <v-card-text class="pb-2">
          <p class="mb-4 text-body-1">
            确定要卸载插件 <strong class="text-error">"{{ pluginToUninstall }}"</strong> 吗？
          </p>
          
          <v-alert 
            type="warning" 
            variant="tonal" 
            density="compact"
            class="mb-3"
          >
            <template #prepend>
              <v-icon>mdi-alert-triangle</v-icon>
            </template>
            <div>
              <strong>警告：</strong>此操作将会：
              <ul class="mt-2 ml-4">
                <li>删除所有插件文件</li>
                <li>清除插件配置</li>
                <li>停止插件运行</li>
              </ul>
              <strong class="text-error">此操作不可撤销！</strong>
            </div>
          </v-alert>
        </v-card-text>
        
        <v-card-actions class="px-6 pb-4">
          <v-spacer></v-spacer>
          <v-btn
            @click="cancelUninstall"
            :disabled="uninstalling"
            variant="text"
            color="grey"
          >
            取消
          </v-btn>
          <v-btn
            @click="confirmUninstall"
            :loading="uninstalling"
            color="error"
            variant="elevated"
            prepend-icon="mdi-delete"
          >
            确认卸载
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import PluginConfigField from './PluginConfigField.vue'

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
const installing = ref(false)
const uninstalling = ref(false)
const uninstallDialog = ref(false)
const pluginToUninstall = ref('')
const errorMessage = ref('')
const successMessage = ref('')

// 加载插件列表
const loadPlugins = async () => {
  try {
    // 从全局插件加载器获取插件信息
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      // 获取所有已安装的插件（包括未加载的）
      const pluginList = pluginLoader.getAllPlugins ? pluginLoader.getAllPlugins() : pluginLoader.getPlugins()
      
      plugins.value = pluginList.map((p: any) => ({
        name: p.name || p.id,
        version: p.version,
        description: p.description,
        author: p.author,
        enabled: p.enabled !== false,
        loaded: p.loaded !== false,
        error: p.error,
        configSchema: p.configSchema
      }))
      
      console.log('已加载插件列表:', plugins.value)
      
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
    } else {
      console.warn('插件加载器未初始化')
    }
  } catch (error) {
    console.error('加载插件列表失败:', error)
    errorMessage.value = '加载插件列表失败'
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
    // 更新本地配置
    if (!pluginConfigs[pluginName]) {
      pluginConfigs[pluginName] = {}
    }
    pluginConfigs[pluginName][key] = value
    
    // 保存到存储
    await invoke('set_plugin_config', { pluginName, key, value: JSON.stringify(value) })
    
    // 通知插件配置已更新
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      pluginLoader.notifyConfigChange(pluginName, key, value)
    }
    
    console.log(`[PluginSettings] 配置已保存: ${pluginName}.${key} = ${value}`)
  } catch (error) {
    console.error('保存插件配置失败:', error)
    errorMessage.value = `保存配置失败: ${error}`
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



// 安装插件
const installPlugin = async () => {
  try {
    errorMessage.value = ''
    successMessage.value = ''
    
    // 打开文件选择对话框
    const selected = await open({
      multiple: false,
      filters: [{
        name: '插件包',
        extensions: ['zip']
      }]
    })
    
    if (!selected) {
      console.log('用户取消了文件选择')
      return
    }
    
    const zipPath = typeof selected === 'string' ? selected : (selected as any).path || selected
    console.log('选择的插件包:', zipPath)
    
    installing.value = true
    
    // 调用插件加载器安装
    const pluginLoader = (window as any).__pluginLoader
    if (!pluginLoader) {
      errorMessage.value = '插件系统未初始化，请刷新页面后重试'
      console.error('插件加载器未找到')
      return
    }
    
    const success = await pluginLoader.installPlugin(zipPath)
    if (success) {
      successMessage.value = '插件安装成功！'
      console.log('插件安装成功')
      await refreshPlugins()
    } else {
      errorMessage.value = '插件安装失败，请检查插件包格式'
      console.error('插件安装失败')
    }
  } catch (error: any) {
    errorMessage.value = `安装失败: ${error.message || '未知错误'}`
    console.error('安装插件失败:', error)
  } finally {
    installing.value = false
  }
}

// 获取插件的自定义操作按钮
const getPluginActions = (pluginName: string) => {
  try {
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader && pluginLoader.getPluginSettingsActions) {
      return pluginLoader.getPluginSettingsActions(pluginName)
    }
  } catch (error) {
    console.error('获取插件操作失败:', error)
  }
  return []
}

// 卸载插件 - 显示确认对话框
const uninstallPlugin = (pluginName: string) => {
  pluginToUninstall.value = pluginName
  uninstallDialog.value = true
}

// 取消卸载
const cancelUninstall = () => {
  uninstallDialog.value = false
  pluginToUninstall.value = ''
}

// 确认卸载插件
const confirmUninstall = async () => {
  if (!pluginToUninstall.value) return
  
  uninstalling.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    // 调用插件加载器卸载
    const pluginLoader = (window as any).__pluginLoader
    if (pluginLoader) {
      const success = await pluginLoader.removePlugin(pluginToUninstall.value)
      if (success) {
        successMessage.value = `插件 "${pluginToUninstall.value}" 卸载成功！`
        console.log('插件卸载成功')
        await refreshPlugins()
      } else {
        errorMessage.value = `插件 "${pluginToUninstall.value}" 卸载失败`
        console.error('插件卸载失败')
      }
    } else {
      errorMessage.value = '插件系统未初始化，请刷新页面后重试'
    }
  } catch (error: any) {
    errorMessage.value = `卸载失败: ${error.message || '未知错误'}`
    console.error('卸载插件失败:', error)
  } finally {
    uninstalling.value = false
    uninstallDialog.value = false
    pluginToUninstall.value = ''
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
