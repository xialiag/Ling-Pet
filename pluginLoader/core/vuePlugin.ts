/**
 * Vue插件 - 自动包装局部导入的组件
 * 通过Vue插件机制，在组件渲染时自动检测和包装
 */

import type { App, Plugin } from 'vue'
import { componentDiscoveryManager } from './componentDiscovery'
import { componentInjectionManager } from './componentInjection'

/**
 * 插件系统Vue插件
 */
export const pluginSystemVuePlugin: Plugin = {
  install(app: App) {
    console.log('[PluginSystemVuePlugin] 正在安装Vue插件')
    
    // 添加全局属性，供组件使用
    app.config.globalProperties.$pluginSystem = {
      injectComponent: (targetName: string, component: any, options?: any) => {
        return componentInjectionManager.injectToComponent(targetName, {
          id: `global-${targetName}-${Date.now()}`,
          pluginId: 'global',
          targetComponent: targetName,
          component,
          position: options?.position || 'after',
          props: options?.props,
          condition: options?.condition,
          order: options?.order
        })
      },
      
      getDiscoveredComponents: () => {
        return componentDiscoveryManager.getAllComponents()
      }
    }
    
    // 监听组件挂载事件
    app.mixin({
      mounted() {
        const instance = (this as any).$
        if (instance?.type) {
          const componentName = instance.type.__name || instance.type.name
          if (componentName) {
            // 通知组件发现管理器
            console.log(`[PluginSystemVuePlugin] 发现组件: ${componentName}`)
            
            // 触发组件发现事件
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('plugin:component-discovered', {
                detail: { componentName, component: instance.type }
              }))
            }
          }
        }
      }
    })
    
    console.log('[PluginSystemVuePlugin] Vue插件安装完成')
  }
}