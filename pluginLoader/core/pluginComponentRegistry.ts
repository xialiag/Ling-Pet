/**
 * 插件组件注册表
 * 管理插件系统提供的通用组件
 */

import type { App, Component } from 'vue'

export interface PluginSystemComponent {
    name: string
    component: Component
    description?: string
    props?: Record<string, any>
}

export class PluginComponentRegistry {
    private components = new Map<string, PluginSystemComponent>()
    private app: App | null = null

    /**
     * 初始化组件注册表
     */
    initialize(app: App): void {
        this.app = app
        this.registerBuiltinComponents()
    }

    /**
     * 注册内置组件
     */
    private async registerBuiltinComponents(): Promise<void> {
        try {
            // 动态导入插件导航组件
            const PluginNavigation = await import('../components/PluginNavigation.vue')
            this.registerComponent({
                name: 'PluginNavigation',
                component: PluginNavigation.default,
                description: '插件页面导航组件'
            })

            // 动态导入插件页面容器组件
            const PluginPageContainer = await import('../components/PluginPageContainer.vue')
            this.registerComponent({
                name: 'PluginPageContainer',
                component: PluginPageContainer.default,
                description: '插件页面容器组件'
            })

            // 动态导入插件页面包装器组件
            const PluginPageWrapper = await import('../components/PluginPageWrapper.vue')
            this.registerComponent({
                name: 'PluginPageWrapper',
                component: PluginPageWrapper.default,
                description: '插件页面包装器组件'
            })

            console.log('[PluginComponentRegistry] Built-in components registered')
        } catch (error) {
            console.error('[PluginComponentRegistry] Failed to register built-in components:', error)
        }
    }

    /**
     * 注册组件
     */
    registerComponent(componentInfo: PluginSystemComponent): void {
        this.components.set(componentInfo.name, componentInfo)

        // 全局注册组件
        if (this.app) {
            this.app.component(componentInfo.name, componentInfo.component)
            console.log(`[PluginComponentRegistry] Registered component: ${componentInfo.name}`)
        }
    }

    /**
     * 获取组件
     */
    getComponent(name: string): PluginSystemComponent | undefined {
        return this.components.get(name)
    }

    /**
     * 获取所有组件
     */
    getAllComponents(): PluginSystemComponent[] {
        return Array.from(this.components.values())
    }

    /**
     * 检查组件是否存在
     */
    hasComponent(name: string): boolean {
        return this.components.has(name)
    }

    /**
     * 注销组件
     */
    unregisterComponent(name: string): void {
        this.components.delete(name)
        console.log(`[PluginComponentRegistry] Unregistered component: ${name}`)
    }

    /**
     * 清理所有组件
     */
    cleanup(): void {
        this.components.clear()
        this.app = null
        console.log('[PluginComponentRegistry] Cleaned up all components')
    }
}

// 全局实例
export const pluginComponentRegistry = new PluginComponentRegistry()

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
    (window as any).__pluginComponentRegistry = pluginComponentRegistry
}