<template>
  <v-container>
    <v-card flat class="pa-2">
      <v-card-text>
        <div class="mb-8">
          <h2 class="text-h6 font-weight-bold mb-4">外观配置</h2>
          <v-divider class="mb-6"></v-divider>

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
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppearanceConfigStore } from '../../stores/configs/appearanceConfig';

const MIN_SIZE = 50;
const MAX_SIZE = 500;
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1.0;

const ac = useAppearanceConfigStore();

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
</script>

<style scoped>
.v-label {
  font-size: 1rem;
  font-weight: 500;
  opacity: 1;
}
</style>
