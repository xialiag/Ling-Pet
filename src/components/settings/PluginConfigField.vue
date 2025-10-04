<template>
  <div v-if="!schema.hidden && isVisible" :class="['plugin-config-field', schema.class]">
    <!-- 分组类型 -->
    <v-expansion-panels v-if="schema.type === 'group'" variant="accordion" class="mb-4">
      <v-expansion-panel :value="schema.expanded !== false">
        <v-expansion-panel-title>
          <div class="d-flex align-center">
            <v-icon v-if="schema.icon" :icon="schema.icon" class="mr-2" />
            <span class="font-weight-bold">{{ schema.label }}</span>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div v-if="schema.description" class="text-caption text-medium-emphasis mb-3">
            {{ schema.description }}
          </div>
          <div v-if="schema.children">
            <PluginConfigField
              v-for="(childSchema, childKey) in schema.children"
              :key="childKey"
              :field-key="childKey"
              :schema="childSchema"
              :value="modelValue?.[childKey]"
              :all-config="allConfig"
              @update:value="updateChildValue(childKey, $event)"
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- 字符串类型 -->
    <v-text-field
      v-else-if="schema.type === 'string'"
      :model-value="modelValue"
      @update:model-value="updateValue"
      :label="schema.label"
      :hint="schema.description"
      :placeholder="schema.placeholder"
      :type="schema.secret ? 'password' : 'text'"
      :required="schema.required"
      :disabled="schema.disabled"
      :rules="validationRules"
      density="comfortable"
      variant="outlined"
      persistent-hint
      clearable
    >
      <template v-if="schema.helpUrl" #append-inner>
        <v-btn
          :href="schema.helpUrl"
          target="_blank"
          icon="mdi-help-circle-outline"
          variant="text"
          size="small"
          density="compact"
        />
      </template>
    </v-text-field>

    <!-- 多行文本类型 -->
    <v-textarea
      v-else-if="schema.type === 'textarea'"
      :model-value="modelValue"
      @update:model-value="updateValue"
      :label="schema.label"
      :hint="schema.description"
      :placeholder="schema.placeholder"
      :required="schema.required"
      :disabled="schema.disabled"
      :rules="validationRules"
      :rows="schema.rows || 3"
      density="comfortable"
      variant="outlined"
      persistent-hint
      clearable
      auto-grow
    />

    <!-- 数字类型 -->
    <div v-else-if="schema.type === 'number'">
      <v-label class="mb-2">
        {{ schema.label }}
        <span v-if="schema.required" class="text-error">*</span>
        <span v-if="schema.unit" class="text-caption text-medium-emphasis ml-1">({{ schema.unit }})</span>
      </v-label>
      <v-text-field
        :model-value="modelValue"
        @update:model-value="updateValue"
        type="number"
        :min="schema.min"
        :max="schema.max"
        :step="schema.step || 1"
        :required="schema.required"
        :disabled="schema.disabled"
        :rules="validationRules"
        density="comfortable"
        variant="outlined"
        hide-details="auto"
      />
      <div v-if="schema.description" class="text-caption text-medium-emphasis mt-1">
        {{ schema.description }}
      </div>
    </div>

    <!-- 范围类型 -->
    <div v-else-if="schema.type === 'range'">
      <v-label class="mb-2">
        {{ schema.label }}
        <span v-if="schema.required" class="text-error">*</span>
        <span v-if="schema.unit" class="text-caption text-medium-emphasis ml-1">({{ schema.unit }})</span>
      </v-label>
      <v-slider
        :model-value="modelValue"
        @update:model-value="updateValue"
        :min="schema.min || 0"
        :max="schema.max || 100"
        :step="schema.step || 1"
        :disabled="schema.disabled"
        thumb-label
        class="mb-2"
      >
        <template #append>
          <v-text-field
            :model-value="modelValue"
            @update:model-value="updateValue"
            type="number"
            :min="schema.min"
            :max="schema.max"
            :step="schema.step || 1"
            style="width: 80px"
            density="compact"
            variant="outlined"
            hide-details
          />
        </template>
      </v-slider>
      <div v-if="schema.description" class="text-caption text-medium-emphasis">
        {{ schema.description }}
      </div>
    </div>

    <!-- 布尔类型 -->
    <div v-else-if="schema.type === 'boolean'" class="d-flex justify-space-between align-center mb-4">
      <div>
        <v-label>
          {{ schema.label }}
          <span v-if="schema.required" class="text-error">*</span>
        </v-label>
        <div v-if="schema.description" class="text-caption text-medium-emphasis">
          {{ schema.description }}
        </div>
      </div>
      <v-switch
        :model-value="modelValue"
        @update:model-value="updateValue"
        :disabled="schema.disabled"
        color="primary"
        density="compact"
        hide-details
      />
    </div>

    <!-- 单选下拉菜单 -->
    <v-select
      v-else-if="schema.type === 'select' && !schema.multiple"
      :model-value="modelValue"
      @update:model-value="updateValue"
      :items="schema.options || []"
      :label="schema.label"
      :hint="schema.description"
      :required="schema.required"
      :disabled="schema.disabled"
      :rules="validationRules"
      item-title="label"
      item-value="value"
      density="comfortable"
      variant="outlined"
      persistent-hint
      clearable
    >
      <template #item="{ props, item }">
        <v-list-item v-bind="props" :disabled="item.raw.disabled">
          <template v-if="item.raw.icon" #prepend>
            <v-icon :icon="item.raw.icon" />
          </template>
        </v-list-item>
      </template>
    </v-select>

    <!-- 多选下拉菜单 -->
    <v-select
      v-else-if="schema.type === 'multiselect' || (schema.type === 'select' && schema.multiple)"
      :model-value="modelValue"
      @update:model-value="updateValue"
      :items="schema.options || []"
      :label="schema.label"
      :hint="schema.description"
      :required="schema.required"
      :disabled="schema.disabled"
      :rules="validationRules"
      item-title="label"
      item-value="value"
      density="comfortable"
      variant="outlined"
      persistent-hint
      multiple
      chips
      closable-chips
    >
      <template #item="{ props, item }">
        <v-list-item v-bind="props" :disabled="item.raw.disabled">
          <template v-if="item.raw.icon" #prepend>
            <v-icon :icon="item.raw.icon" />
          </template>
        </v-list-item>
      </template>
    </v-select>

    <!-- 颜色选择器 -->
    <div v-else-if="schema.type === 'color'">
      <v-label class="mb-2">
        {{ schema.label }}
        <span v-if="schema.required" class="text-error">*</span>
      </v-label>
      <div class="d-flex align-center gap-3">
        <v-text-field
          :model-value="modelValue"
          @update:model-value="updateValue"
          :required="schema.required"
          :disabled="schema.disabled"
          :rules="validationRules"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
          style="flex: 1"
        />
        <input
          type="color"
          :value="modelValue || '#000000'"
          @input="updateValue(($event.target as HTMLInputElement)?.value)"
          :disabled="schema.disabled"
          class="color-picker"
        />
      </div>
      <div v-if="schema.description" class="text-caption text-medium-emphasis mt-1">
        {{ schema.description }}
      </div>
    </div>

    <!-- 文件选择器 -->
    <div v-else-if="schema.type === 'file'">
      <v-label class="mb-2">
        {{ schema.label }}
        <span v-if="schema.required" class="text-error">*</span>
      </v-label>
      <v-file-input
        :model-value="fileValue"
        @update:model-value="updateFileValue"
        :accept="schema.accept"
        :multiple="schema.multipleFiles"
        :required="schema.required"
        :disabled="schema.disabled"
        :rules="validationRules"
        density="comfortable"
        variant="outlined"
        prepend-icon="mdi-paperclip"
        show-size
        clearable
      />
      <div v-if="schema.description" class="text-caption text-medium-emphasis">
        {{ schema.description }}
      </div>
    </div>

    <!-- 未知类型 -->
    <v-alert v-else type="warning" variant="tonal" density="compact">
      未支持的配置类型: {{ schema.type }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PluginConfigSchema } from '../../../pluginLoader/types/api'

interface Props {
  fieldKey: string
  schema: PluginConfigSchema
  value: any
  allConfig: Record<string, any>
}

interface Emits {
  (e: 'update:value', value: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const modelValue = computed(() => props.value)
const fileValue = ref<File[]>([])

// 检查是否应该显示此字段
const isVisible = computed(() => {
  if (!props.schema.condition) return true
  return props.schema.condition(props.allConfig)
})

// 验证规则
const validationRules = computed(() => {
  const rules: Array<(value: any) => boolean | string> = []
  
  if (props.schema.required) {
    rules.push((value: any) => {
      if (value === null || value === undefined || value === '') {
        return `${props.schema.label} 是必填项`
      }
      return true
    })
  }
  
  if (props.schema.validation) {
    const validation = props.schema.validation
    
    // 最小值/最小长度
    if (validation.min !== undefined) {
      rules.push((value: any) => {
        if (value === null || value === undefined) return true
        const length = typeof value === 'string' ? value.length : Number(value)
        if (length < validation.min!) {
          return `${props.schema.label} 不能小于 ${validation.min}`
        }
        return true
      })
    }
    
    // 最大值/最大长度
    if (validation.max !== undefined) {
      rules.push((value: any) => {
        if (value === null || value === undefined) return true
        const length = typeof value === 'string' ? value.length : Number(value)
        if (length > validation.max!) {
          return `${props.schema.label} 不能大于 ${validation.max}`
        }
        return true
      })
    }
    
    // 正则表达式
    if (validation.pattern) {
      rules.push((value: any) => {
        if (value === null || value === undefined || value === '') return true
        const regex = new RegExp(validation.pattern!)
        if (!regex.test(String(value))) {
          return `${props.schema.label} 格式不正确`
        }
        return true
      })
    }
    
    // 自定义验证
    if (validation.validator) {
      rules.push((value: any) => {
        const result = validation.validator!(value)
        return result === true ? true : (typeof result === 'string' ? result : `${props.schema.label} 验证失败`)
      })
    }
  }
  
  return rules
})

// 更新值
const updateValue = (value: any) => {
  emit('update:value', value)
}

// 更新子字段值
const updateChildValue = (childKey: string, value: any) => {
  const newValue = { ...props.value }
  newValue[childKey] = value
  emit('update:value', newValue)
}

// 更新文件值
const updateFileValue = (files: File | File[]) => {
  const fileArray = Array.isArray(files) ? files : (files ? [files] : [])
  fileValue.value = fileArray
  if (props.schema.multipleFiles) {
    emit('update:value', fileArray.map(f => f.name))
  } else {
    emit('update:value', fileArray[0]?.name || null)
  }
}
</script>

<style scoped>
.plugin-config-field {
  margin-bottom: 16px;
}

.color-picker {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.color-picker:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.v-label {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 1;
}
</style>