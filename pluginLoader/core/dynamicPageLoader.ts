/**
 * 动态页面加载器
 * 支持从外部文件动态加载插件页面组件
 */

import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

export interface DynamicPageConfig {
    /** 页面ID */
    id: string
    /** 插件ID */
    pluginId: string
    /** 组件文件路径 */
    componentPath: string
    /** 页面配置 */
    config: {
        path: string
        title?: string
        icon?: string
        description?: string
        showInNavigation?: boolean
        navigationGroup?: string
    }
}

export class DynamicPageLoader {
    private loadedComponents = new Map<string, Component>()
    private loadingPromises = new Map<string, Promise<Component>>()

    /**
     * 动态加载页面组件
     */
    async loadPageComponent(
        pluginId: string,
        componentPath: string
    ): Promise<Component> {
        const cacheKey = `${pluginId}:${componentPath}`

        // 检查缓存
        if (this.loadedComponents.has(cacheKey)) {
            return this.loadedComponents.get(cacheKey)!
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey)!
        }

        // 开始加载
        const loadingPromise = this.doLoadComponent(pluginId, componentPath)
        this.loadingPromises.set(cacheKey, loadingPromise)

        try {
            const component = await loadingPromise
            this.loadedComponents.set(cacheKey, component)
            return component
        } finally {
            this.loadingPromises.delete(cacheKey)
        }
    }

    /**
     * 执行组件加载
     */
    private async doLoadComponent(
        pluginId: string,
        componentPath: string
    ): Promise<Component> {
        try {
            // 构建完整的组件路径
            const fullPath = this.resolveComponentPath(pluginId, componentPath)

            // 动态导入组件
            const module = await import(/* @vite-ignore */ fullPath)

            // 获取默认导出或命名导出
            const component = module.default || module[this.getComponentName(componentPath)]

            if (!component) {
                throw new Error(`Component not found in ${fullPath}`)
            }

            return component
        } catch (error) {
            console.error(`[DynamicPageLoader] Failed to load component ${componentPath}:`, error)

            // 返回错误组件
            return this.createErrorComponent(error as Error)
        }
    }

    /**
     * 解析组件路径
     */
    private resolveComponentPath(pluginId: string, componentPath: string): string {
        // 如果是相对路径，添加插件目录前缀
        if (componentPath.startsWith('./') || componentPath.startsWith('../')) {
            return `/pluginLoader/plugins/${pluginId}/${componentPath}`
        }

        // 如果是绝对路径，直接使用
        if (componentPath.startsWith('/')) {
            return componentPath
        }

        // 默认在插件目录下查找
        return `/pluginLoader/plugins/${pluginId}/${componentPath}`
    }

    /**
     * 获取组件名称
     */
    private getComponentName(componentPath: string): string {
        const fileName = componentPath.split('/').pop() || ''
        return fileName.replace(/\.(vue|ts|js)$/, '')
    }

    /**
     * 创建错误组件
     */
    private createErrorComponent(error: Error): Component {
        return {
            name: 'PluginPageError',
            setup() {
                return () => {
                    return {
                        type: 'div',
                        props: {
                            class: 'plugin-page-error pa-6'
                        },
                        children: [
                            {
                                type: 'div',
                                props: { class: 'text-h6 mb-4 text-error' },
                                children: '页面加载失败'
                            },
                            {
                                type: 'div',
                                props: { class: 'text-body-2 mb-4' },
                                children: error.message
                            },
                            {
                                type: 'button',
                                props: {
                                    class: 'v-btn v-btn--elevated',
                                    onClick: () => window.location.reload()
                                },
                                children: '重新加载'
                            }
                        ]
                    }
                }
            }
        }
    }

    /**
     * 创建异步组件
     */
    createAsyncComponent(
        pluginId: string,
        componentPath: string,
        options?: {
            loadingComponent?: Component
            errorComponent?: Component
            delay?: number
            timeout?: number
        }
    ): Component {
        return defineAsyncComponent({
            loader: () => this.loadPageComponent(pluginId, componentPath),
            loadingComponent: options?.loadingComponent || this.createLoadingComponent(),
            errorComponent: options?.errorComponent || this.createErrorComponent(new Error('组件加载超时')),
            delay: options?.delay || 200,
            timeout: options?.timeout || 10000
        })
    }

    /**
     * 创建加载组件
     */
    private createLoadingComponent(): Component {
        return {
            name: 'PluginPageLoading',
            setup() {
                return () => ({
                    type: 'div',
                    props: {
                        class: 'plugin-page-loading d-flex justify-center align-center pa-8'
                    },
                    children: [
                        {
                            type: 'div',
                            props: { class: 'text-center' },
                            children: [
                                {
                                    type: 'div',
                                    props: { class: 'v-progress-circular v-progress-circular--indeterminate mb-4' },
                                    children: ''
                                },
                                {
                                    type: 'div',
                                    props: { class: 'text-body-2' },
                                    children: '加载中...'
                                }
                            ]
                        }
                    ]
                })
            }
        }
    }

    /**
     * 预加载页面组件
     */
    async preloadComponent(pluginId: string, componentPath: string): Promise<void> {
        try {
            await this.loadPageComponent(pluginId, componentPath)
            console.log(`[DynamicPageLoader] Preloaded component: ${pluginId}/${componentPath}`)
        } catch (error) {
            console.warn(`[DynamicPageLoader] Failed to preload component: ${pluginId}/${componentPath}`, error)
        }
    }

    /**
     * 清理插件的所有组件缓存
     */
    clearPluginCache(pluginId: string): void {
        const keysToDelete = Array.from(this.loadedComponents.keys())
            .filter(key => key.startsWith(`${pluginId}:`))

        keysToDelete.forEach(key => {
            this.loadedComponents.delete(key)
        })

        console.log(`[DynamicPageLoader] Cleared cache for plugin: ${pluginId}`)
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        totalComponents: number
        loadingComponents: number
        pluginBreakdown: Record<string, number>
    } {
        const pluginBreakdown: Record<string, number> = {}

        for (const key of this.loadedComponents.keys()) {
            const pluginId = key.split(':')[0]
            pluginBreakdown[pluginId] = (pluginBreakdown[pluginId] || 0) + 1
        }

        return {
            totalComponents: this.loadedComponents.size,
            loadingComponents: this.loadingPromises.size,
            pluginBreakdown
        }
    }
}

// 全局实例
export const dynamicPageLoader = new DynamicPageLoader()

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
    (window as any).__dynamicPageLoader = dynamicPageLoader
}