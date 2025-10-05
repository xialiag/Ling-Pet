<template>
  <component
    :is="wrapperComponent"
    v-bind="wrapperProps"
    :class="containerClass"
    :style="containerStyle"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import type { PluginPageContainerConfig } from '../types/api'

interface Props {
  containerConfig?: PluginPageContainerConfig
  pageTitle?: string
  pageIcon?: string
  pluginId?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerConfig: () => ({ useDefault: true })
})

// 默认容器组件
const DefaultContainer = defineAsyncComponent(() => import('./PluginPageContainer.vue'))

// 空容器组件（直接渲染内容）
const EmptyContainer = {
  name: 'EmptyContainer',
  setup(_: any, { slots }: any) {
    return () => slots.default?.()
  }
}

// 计算使用的包装器组件
const wrapperComponent = computed<Component>(() => {
  const config = props.containerConfig
  
  // 如果有自定义容器，使用自定义容器
  if (config?.customContainer) {
    return config.customContainer
  }
  
  // 如果明确设置不使用默认容器，使用空容器
  if (config?.useDefault === false) {
    return EmptyContainer
  }
  
  // 默认使用系统容器
  return DefaultContainer
})

// 计算传递给包装器的属性
const wrapperProps = computed(() => {
  const config = props.containerConfig
  
  // 如果使用默认容器，传递相关配置
  if (config?.useDefault !== false && !config?.customContainer) {
    return {
      showHeader: config?.showHeader ?? true,
      showMenu: config?.showMenu ?? true,
      showBackButton: config?.showBackButton ?? true,
      pageTitle: props.pageTitle,
      pageIcon: props.pageIcon,
      pluginId: props.pluginId
    }
  }
  
  // 其他情况不传递额外属性
  return {}
})

// 容器样式类
const containerClass = computed(() => {
  return props.containerConfig?.containerClass || ''
})

// 容器样式
const containerStyle = computed(() => {
  return props.containerConfig?.containerStyle || {}
})
</script>