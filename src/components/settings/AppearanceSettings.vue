<template>
  <v-container>
    <v-card flat class="pa-2">
      <v-card-text>
        <div class="mb-8">
          <h2 class="text-h6 font-weight-bold mb-4">外观配置</h2>
          <v-divider class="mb-6"></v-divider>

          <!-- Live2D模型管理 -->
          <div class="mb-6">
            <h3 class="text-subtitle-1 font-weight-bold mb-3">Live2D模型管理</h3>
            
            <div class="mb-4">
              <div class="d-flex justify-space-between align-center mb-2">
                <v-label>当前模型</v-label>
                <v-btn
                  @click="importModel"
                  color="primary"
                  variant="outlined"
                  size="small"
                  :loading="importing"
                >
                  <v-icon start>mdi-import</v-icon>
                  导入模型
                </v-btn>
              </div>
              
              <v-select
                v-model="ac.currentModelId"
                :items="modelSelectItems"
                item-title="name"
                item-value="id"
                density="comfortable"
                variant="outlined"
                hide-details
                placeholder="请选择或导入Live2D模型"
                :disabled="!ac.hasAvailableModels"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" class="px-3">
                    <template #append>
                      <v-btn
                        @click.stop="confirmDeleteModel(item.raw.id)"
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        :loading="deletingModels.has(item.raw.id)"
                      />
                    </template>
                  </v-list-item>
                </template>
              </v-select>
              
              <div v-if="!ac.hasAvailableModels" class="text-caption text-medium-emphasis mt-2">
                暂无可用模型，请点击"导入模型"添加Live2D模型
              </div>
              <div v-else-if="ac.currentModel" class="text-caption text-medium-emphasis mt-2">
                当前模型：{{ ac.currentModel.name }}
              </div>
            </div>
          </div>

          <div class="mb-6">
            <div class="d-flex justify-space-between align-center mb-1">
              <v-label>宠物大小</v-label>
              <span class="text-primary font-weight-medium">{{ ac.petSize }}px</span>
            </div>
            <v-slider
              v-model="ac.petSize"
              :min="MIN_SIZE"
              :max="MAX_SIZE"
              :step="1"
              thumb-label
              hide-details
              color="primary"
            ></v-slider>
          </div>

          <div class="mb-6">
            <div class="d-flex justify-space-between align-center mb-1">
              <v-label>透明度</v-label>
              <span class="text-primary font-weight-medium">{{ formattedOpacity }}</span>
            </div>
            <v-slider
              v-model="ac.opacity"
              :min="MIN_OPACITY"
              :max="MAX_OPACITY"
              :step="0.01"
              thumb-label
              hide-details
              color="orange"
            ></v-slider>
          </div>

          <div class="mb-6">
            <div class="d-flex justify-space-between align-center mb-1">
              <v-label>装饰效果</v-label>
              <span class="text-primary font-weight-medium">{{ decorationLabel }}</span>
            </div>
            <v-select
              v-model="ac.decorationType"
              :items="decorationOptions"
              item-title="label"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
            />
          </div>

          <div class="mb-6">
            <div class="d-flex justify-space-between align-center mb-1">
              <v-label>Live2D边界类型</v-label>
              <span class="text-primary font-weight-medium">{{ live2dBorderLabel }}</span>
            </div>
            <v-select
              v-model="ac.live2dBorderType"
              :items="live2dBorderOptions"
              item-title="label"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
            />
            <div class="text-caption text-medium-emphasis mt-2">
              选择"无边界"可解决模型显示不全问题
            </div>
          </div>

          <div class="mb-6">
            <h3 class="text-subtitle-1 font-weight-bold mb-3">Live2D模型设置</h3>

            <div class="mb-4">
              <div class="d-flex justify-space-between align-center mb-1">
                <v-label>模型缩放</v-label>
                <span class="text-primary font-weight-medium">{{ formattedScale }}</span>
              </div>
              <v-slider
                v-model="ac.live2dModelScale"
                :min="0.01"
                :max="0.7"
                :step="0.01"
                thumb-label
                hide-details
                color="primary"
              ></v-slider>
              <div class="text-caption text-medium-emphasis mt-1">
                调整模型大小，避免显示不全
              </div>
            </div>

            <div class="mb-4">
              <div class="d-flex justify-space-between align-center mb-1">
                <v-label>模型水平位置</v-label>
                <span class="text-primary font-weight-medium">{{ formattedPositionX }}</span>
              </div>
              <v-slider
                v-model="ac.live2dModelPositionX"
                :min="0"
                :max="1"
                :step="0.01"
                thumb-label
                hide-details
                color="primary"
              ></v-slider>
              <div class="text-caption text-medium-emphasis mt-1">
                调整模型水平位置 (0:最左, 1:最右)
              </div>
            </div>

            <div>
              <div class="d-flex justify-space-between align-center mb-1">
                <v-label>模型垂直位置</v-label>
                <span class="text-primary font-weight-medium">{{ formattedPositionY }}</span>
              </div>
              <v-slider
                v-model="ac.live2dModelPositionY"
                :min="-5"
                :max="5"
                :step="0.01"
                thumb-label
                hide-details
                color="primary"
              ></v-slider>
              <div class="text-caption text-medium-emphasis mt-1">
                调整模型垂直位置 (-5:最上, 5:最下)
              </div>
            </div>
          </div>

          <div class="mb-6">
            <div class="d-flex justify-space-between align-center mb-3">
              <div class="d-flex align-center gap-2">
                <v-label>聊天气泡透明模式</v-label>
              </div>
              <v-switch
                v-model="ac.bubbleTransparent"
                color="primary"
                density="compact"
                hide-details
              />
            </div>
            <div class="text-caption text-medium-emphasis mb-3">
              开启后气泡背景将变为透明
            </div>

            <div v-if="ac.bubbleTransparent" class="ml-4">
              <div class="d-flex justify-space-between align-center mb-2">
                <v-label class="text-body-2">显示边框</v-label>
                <v-switch
                  v-model="ac.bubbleShowBorder"
                  color="secondary"
                  density="compact"
                  hide-details
                />
              </div>
              <div class="text-caption text-medium-emphasis">
                关闭后仅显示文字，达到最简洁的效果
              </div>
            </div>
          </div>

          <v-divider class="my-6"></v-divider>

          <div>
            <div class="d-flex justify-space-between align-center mb-3">
              <v-label>开发者工具</v-label>
              <v-switch
                v-model="ac.showDevTools"
                color="warning"
                density="compact"
                hide-details
              />
            </div>
            <div class="text-caption text-medium-emphasis mb-3">
              开启后可在设置与聊天记录界面使用右键开发者工具，关闭以获得更好的使用体验
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- 删除确认对话框 -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">确认删除模型</v-card-title>
        <v-card-text>
          <p>确定要删除模型 "{{ modelToDelete }}" 吗？</p>
          <p class="text-caption text-medium-emphasis mt-2">
            此操作将永久删除模型文件，无法恢复。
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelDelete">取消</v-btn>
          <v-btn 
            color="error" 
            variant="text" 
            @click="confirmDelete"
            :loading="deletingModels.has(modelToDelete || '')"
          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig';
import { live2dModelService } from '../../services/live2dModelService';
import { open } from '@tauri-apps/plugin-dialog';
import { useNotificationStore } from '../../stores/notification';

const MIN_SIZE = 50;
const MAX_SIZE = 500;
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1.0;

const ac = useAppearanceConfigStore();
const notificationStore = useNotificationStore();

// 模型管理相关状态
const importing = ref(false);
const deletingModels = ref(new Set<string>());
const deleteDialog = ref(false);
const modelToDelete = ref<string | null>(null);

const decorationOptions = [
  { label: '无', value: 'none' },
  { label: '光圈 (Circle)', value: 'circle' },
  { label: '飘落星光 (Falling Stars)', value: 'fallingStars' },
];

const live2dBorderOptions = [
  { label: '无边界', value: 'none' },
  { label: '圆形边界', value: 'circle' },
];

const decorationLabel = computed(() => {
  const found = decorationOptions.find(o => o.value === ac.decorationType);
  return found ? found.label : '无';
});

const live2dBorderLabel = computed(() => {
  const found = live2dBorderOptions.find(o => o.value === ac.live2dBorderType);
  return found ? found.label : '无边界';
});

const formattedOpacity = computed(() => `${Math.round(ac.opacity * 100)}%`);
const formattedScale = computed(() => `${Math.round(ac.live2dModelScale * 100)}%`);
const formattedPositionX = computed(() => `${Math.round(ac.live2dModelPositionX * 100)}%`);
const formattedPositionY = computed(() => `${Math.round(ac.live2dModelPositionY * 100)}%`);

// 模型选择下拉菜单项
const modelSelectItems = computed(() => {
  return ac.availableModels.map(model => ({
    id: model.id,
    name: model.name,
  }));
});

// 导入模型
const importModel = async () => {
  try {
    importing.value = true;
    
    // 使用Tauri dialog API选择模型目录
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择Live2D模型目录',
    });
    
    if (selected && typeof selected === 'string') {
      // 导入模型到数据目录
      const modelId = await live2dModelService.importModel(selected);
      
      // 刷新可用模型列表
      await refreshModels();
      
      // 自动选择新导入的模型
      ac.setCurrentModel(modelId);
      
      // 显示成功通知
      notificationStore.show({
        title: '导入成功',
        message: `Live2D模型 "${modelId}" 已成功导入`,
        duration_ms: 3000
      });
      
      console.log(`Successfully imported model: ${modelId}`);
    }
  } catch (error) {
    console.error('Failed to import model:', error);
    
    // 显示错误通知
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    notificationStore.show({
      title: '导入失败',
      message: `模型导入失败：${errorMessage}`,
      duration_ms: 5000
    });
  } finally {
    importing.value = false;
  }
};

// 确认删除模型
const confirmDeleteModel = (modelId: string) => {
  modelToDelete.value = modelId;
  deleteDialog.value = true;
};

// 取消删除
const cancelDelete = () => {
  deleteDialog.value = false;
  modelToDelete.value = null;
};

// 确认删除
const confirmDelete = async () => {
  if (!modelToDelete.value) return;
  
  await deleteModel(modelToDelete.value);
  deleteDialog.value = false;
  modelToDelete.value = null;
};

// 删除模型
const deleteModel = async (modelId: string) => {
  try {
    deletingModels.value.add(modelId);
    
    // 删除模型文件
    await live2dModelService.deleteModel(modelId);
    
    // 从store中移除模型
    ac.removeModel(modelId);
    
    // 显示成功通知
    notificationStore.show({
      title: '删除成功',
      message: `Live2D模型 "${modelId}" 已成功删除`,
      duration_ms: 3000
    });
    
    console.log(`Successfully deleted model: ${modelId}`);
  } catch (error) {
    console.error('Failed to delete model:', error);
    
    // 显示错误通知
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    notificationStore.show({
      title: '删除失败',
      message: `模型删除失败：${errorMessage}`,
      duration_ms: 5000
    });
  } finally {
    deletingModels.value.delete(modelId);
  }
};

// 刷新模型列表
const refreshModels = async () => {
  try {
    const models = await live2dModelService.getAvailableModels();
    ac.updateAvailableModels(models);
  } catch (error) {
    console.error('Failed to refresh models:', error);
    
    // 显示错误通知
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    notificationStore.show({
      title: '刷新失败',
      message: `刷新模型列表失败：${errorMessage}`,
      duration_ms: 4000
    });
  }
};

// 组件挂载时加载模型列表
onMounted(async () => {
  await refreshModels();
});
</script>

<style scoped>
.v-label {
  font-size: 1rem;
  font-weight: 500;
  opacity: 1;
}
</style>
