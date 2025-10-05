/**
 * Vue实例拦截器
 * 通过拦截Vue的内部机制，在不修改源码的情况下实现组件Hook
 */

import type { App, Component } from 'vue'
import { componentInjectionManager } from './componentInjection'

/**
 * Vue实例拦截器
 */
export class VueInstanceInterceptor {
    private app: App | null = null
    private originalCreateVNode: any = null
    private originalMount: any = null
    private componentInstances = new Map<string, Set<any>>()

    /**
     * 初始化拦截器
     */
    initialize(app: App): void {
        this.app = app

        // 拦截Vue的createVNode方法
        this.interceptCreateVNode()

        // 拦截组件挂载
        this.interceptComponentMount()

        console.log('[VueInstanceInterceptor] 已初始化Vue实例拦截器')
    }

    /**
     * 拦截Vue的createVNode方法
     */
    private interceptCreateVNode(): void {
        if (!this.app) return

        // 获取Vue的内部createVNode函数
        const vueInternals = (this.app as any)._context
        if (!vueInternals) return

        // 尝试从全局Vue对象获取createVNode
        const Vue = (globalThis as any).Vue || (window as any).Vue
        if (Vue && Vue.createVNode) {
            this.originalCreateVNode = Vue.createVNode

            Vue.createVNode = (...args: any[]) => {
                const [type, props] = args

                // 检查是否是组件类型
                if (type && typeof type === 'object') {
                    const componentName = this.extractComponentName(type)
                    if (componentName) {
                        this.handleComponentCreation(componentName, type, props)
                    }
                }

                return this.originalCreateVNode.apply(Vue, args)
            }

            console.log('[VueInstanceInterceptor] 已拦截Vue.createVNode')
        }
    }

    /**
     * 拦截组件挂载
     */
    private interceptComponentMount(): void {
        if (!this.app) return

        // 拦截app.mount方法
        this.originalMount = this.app.mount
        this.app.mount = (...args: any[]) => {
            const result = this.originalMount.apply(this.app, args)

            // 延迟扫描DOM，查找组件实例
            setTimeout(() => {
                this.scanDOMForComponents()
            }, 100)

            return result
        }

        // 使用MutationObserver监听DOM变化
        this.setupDOMObserver()
    }

    /**
     * 设置DOM观察器
     */
    private setupDOMObserver(): void {
        if (typeof window === 'undefined') return

        const observer = new MutationObserver((mutations) => {
            let hasNewNodes = false

            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    hasNewNodes = true
                }
            })

            if (hasNewNodes) {
                // 延迟扫描，避免频繁触发
                setTimeout(() => {
                    this.scanDOMForComponents()
                }, 50)
            }
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })

        // 监听手动触发检查事件
        if (typeof window !== 'undefined') {
            window.addEventListener('plugin:trigger-component-check', (event: Event) => {
                const customEvent = event as CustomEvent
                const componentName = customEvent.detail?.componentName
                if (componentName) {
                    this.triggerComponentCheck(componentName)
                }
            })
        }

        console.log('[VueInstanceInterceptor] DOM观察器已启动')
    }

    /**
     * 扫描DOM查找Vue组件实例
     */
    private scanDOMForComponents(): void {
        const elements = document.querySelectorAll('*')

        elements.forEach((element) => {
            const vueInstance = this.getVueInstance(element)
            if (vueInstance) {
                const componentName = this.extractComponentName(vueInstance.type)
                if (componentName) {
                    this.handleComponentMount(componentName, element, vueInstance)
                }
            }
        })
    }

    /**
     * 获取元素的Vue实例
     */
    private getVueInstance(element: Element): any {
        // 尝试多种方式获取Vue实例
        const keys = Object.keys(element).filter(key =>
            key.startsWith('__vue') || key.startsWith('_vue')
        )

        for (const key of keys) {
            const instance = (element as any)[key]
            if (instance && instance.type) {
                return instance
            }
        }

        // 尝试从__vueParentComponent获取
        const parentComponent = (element as any).__vueParentComponent
        if (parentComponent && parentComponent.type) {
            return parentComponent
        }

        return null
    }

    /**
     * 提取组件名称
     */
    private extractComponentName(componentType: any): string | null {
        if (!componentType) return null

        // 1. 显式设置的name
        if (componentType.name) return componentType.name

        // 2. 从__name获取（Vue SFC编译后的名称）
        if (componentType.__name) return componentType.__name

        // 3. 从文件路径推断
        if (componentType.__file) {
            const fileName = componentType.__file.split('/').pop()?.replace(/\.(vue|ts|js)$/, '')
            if (fileName) return fileName
        }

        // 4. 从displayName获取
        if (componentType.displayName) return componentType.displayName

        return null
    }

    /**
     * 处理组件创建
     */
    private handleComponentCreation(componentName: string, componentType: any, props: any): void {
        console.log(`[VueInstanceInterceptor] 检测到组件创建: ${componentName}`)

        // 记录组件实例
        if (!this.componentInstances.has(componentName)) {
            this.componentInstances.set(componentName, new Set())
        }

        // 触发组件发现事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plugin:component-discovered', {
                detail: {
                    componentName,
                    componentType,
                    props
                }
            }))
        }
    }

    /**
     * 处理组件挂载
     */
    private handleComponentMount(componentName: string, element: Element, vueInstance: any): void {
        // 检查是否已经处理过这个实例
        const instances = this.componentInstances.get(componentName)
        if (instances && instances.has(vueInstance)) {
            return
        }

        console.log(`[VueInstanceInterceptor] 检测到组件挂载: ${componentName}`)

        // 记录实例
        if (!instances) {
            this.componentInstances.set(componentName, new Set())
        }
        this.componentInstances.get(componentName)!.add(vueInstance)

        // 检查是否有待处理的注入
        const injections = componentInjectionManager.getInjections(componentName)
        console.log(`[VueInstanceInterceptor] 检查 ${componentName} 的注入数量: ${injections.length}`)
        
        if (injections.length > 0) {
            console.log(`[VueInstanceInterceptor] 发现 ${componentName} 有 ${injections.length} 个待处理注入`)
            this.applyInjectionsToElement(element, injections)
        } else {
            // 如果当前没有注入，延迟检查（可能注入还没注册）
            setTimeout(() => {
                const delayedInjections = componentInjectionManager.getInjections(componentName)
                if (delayedInjections.length > 0) {
                    console.log(`[VueInstanceInterceptor] 延迟发现 ${componentName} 有 ${delayedInjections.length} 个注入`)
                    this.applyInjectionsToElement(element, delayedInjections)
                }
            }, 100)
        }

        // 触发组件挂载事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plugin:component-mounted', {
                detail: {
                    componentName,
                    element,
                    vueInstance
                }
            }))
        }
    }

    /**
     * 应用注入到元素
     */
    private applyInjectionsToElement(element: Element, injections: any[]): void {
        // 清理之前的注入
        this.cleanupInjectionsForElement(element)

        // 应用before注入
        const beforeInjections = injections.filter(i =>
            i.position === 'before' && (!i.condition || i.condition())
        )
        beforeInjections.forEach(injection => {
            this.createInjectionElement(element, injection, 'before')
        })

        // 应用after注入
        const afterInjections = injections.filter(i =>
            i.position === 'after' && (!i.condition || i.condition())
        )
        afterInjections.forEach(injection => {
            this.createInjectionElement(element, injection, 'after')
        })

        // 应用replace注入
        const replaceInjection = injections.find(i =>
            i.position === 'replace' && (!i.condition || i.condition())
        )
        if (replaceInjection) {
            this.createInjectionElement(element, replaceInjection, 'replace')
        }
    }

    /**
     * 创建注入元素
     */
    private createInjectionElement(targetEl: Element, injection: any, position: string): void {
        const injectionEl = document.createElement('div')
        injectionEl.className = `plugin-injection plugin-injection-${position}`
        injectionEl.setAttribute('data-plugin-id', injection.pluginId)
        injectionEl.setAttribute('data-injection-id', injection.id)

        // 设置样式
        if (position === 'before' || position === 'after') {
            injectionEl.style.position = 'absolute'
            injectionEl.style.zIndex = '10'
            injectionEl.style.pointerEvents = 'none'

            if (position === 'before') {
                injectionEl.style.top = '10px'
                injectionEl.style.left = '50%'
                injectionEl.style.transform = 'translateX(-50%)'
            } else {
                injectionEl.style.bottom = '10px'
                injectionEl.style.left = '50%'
                injectionEl.style.transform = 'translateX(-50%)'
            }
        }

        // 根据注入类型创建内容
        if (injection.component) {
            // 如果是Vue组件，创建Vue实例
            this.mountVueComponent(injectionEl, injection.component, injection.props || {}).catch(error => {
                console.error('[VueInstanceInterceptor] 异步挂载Vue组件失败:', error)
            })
        } else if (injection.html) {
            // 如果是HTML内容
            injectionEl.innerHTML = injection.html
        } else if (injection.text) {
            // 如果是文本内容
            injectionEl.textContent = injection.text
        }

        // 插入到适当位置
        if (position === 'before') {
            targetEl.parentNode?.insertBefore(injectionEl, targetEl)
        } else if (position === 'after') {
            targetEl.parentNode?.insertBefore(injectionEl, targetEl.nextSibling)
        } else if (position === 'replace') {
            (targetEl as HTMLElement).style.display = 'none'
            targetEl.parentNode?.insertBefore(injectionEl, targetEl)
        }

        console.log(`[VueInstanceInterceptor] 已创建注入元素: ${injection.id} (${position})`)
    }

    /**
     * 挂载Vue组件到DOM元素
     */
    private async mountVueComponent(el: Element, component: Component, props: Record<string, any>): Promise<void> {
        if (!this.app) return

        try {
            // 动态导入Vue
            const { createApp } = await import('vue')
            const componentApp = createApp(component, props)

            // 挂载到元素
            componentApp.mount(el)

                // 保存应用实例，用于后续清理
                ; (el as any).__vueApp = componentApp

            console.log('[VueInstanceInterceptor] Vue组件已挂载到注入元素')
        } catch (error) {
            console.error('[VueInstanceInterceptor] 挂载Vue组件失败:', error)

            // 如果Vue组件挂载失败，使用备用渲染
            this.fallbackRenderComponent(el)
        }
    }

    /**
     * 备用渲染方法 - 直接渲染组件内容
     */
    private fallbackRenderComponent(el: Element): void {
        try {
            // 创建一个简单的展示元素
            const wrapper = document.createElement('div')
            wrapper.innerHTML = `
                <div class="plugin-vue-component" style="
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
                    text-align: center;
                    white-space: nowrap;
                    animation: fadeIn 0.5s ease-out;
                ">
                    ✨ Vue组件注入成功
                </div>
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
            `

            // 将包装器内容移动到目标元素
            while (wrapper.firstChild) {
                el.appendChild(wrapper.firstChild)
            }

            console.log('[VueInstanceInterceptor] 使用备用渲染方法成功')
        } catch (error) {
            console.error('[VueInstanceInterceptor] 备用渲染也失败:', error)
        }
    }

    /**
     * 清理元素的注入
     */
    private cleanupInjectionsForElement(element: Element): void {
        const parent = element.parentNode
        if (!parent) return

        // 查找相关的注入元素
        const injectionElements = parent.querySelectorAll('.plugin-injection')
        injectionElements.forEach(injectionEl => {
            // 清理Vue应用实例
            const vueApp = (injectionEl as any).__vueApp
            if (vueApp) {
                try {
                    vueApp.unmount()
                } catch (error) {
                    console.warn('[VueInstanceInterceptor] 卸载Vue组件失败:', error)
                }
            }

            // 移除DOM元素
            injectionEl.remove()
        })

        // 恢复被替换的元素
        if (element instanceof HTMLElement && element.style.display === 'none') {
            element.style.display = ''
        }
    }

    /**
     * 手动触发组件检查
     */
    triggerComponentCheck(componentName: string): void {
        console.log(`[VueInstanceInterceptor] 手动触发组件检查: ${componentName}`)

        // 立即检查已知的组件实例
        const instances = this.componentInstances.get(componentName)
        if (instances && instances.size > 0) {
            console.log(`[VueInstanceInterceptor] 找到 ${instances.size} 个 ${componentName} 实例，检查注入`)
            
            // 查找对应的DOM元素并应用注入
            document.querySelectorAll('*').forEach((element) => {
                const vueInstance = this.getVueInstance(element)
                if (vueInstance && instances.has(vueInstance)) {
                    const injections = componentInjectionManager.getInjections(componentName)
                    if (injections.length > 0) {
                        console.log(`[VueInstanceInterceptor] 对已存在的 ${componentName} 应用 ${injections.length} 个注入`)
                        this.applyInjectionsToElement(element, injections)
                    }
                }
            })
        }

        // 重新扫描DOM
        this.scanDOMForComponents()
    }

    /**
     * 清理插件的注入
     */
    cleanupPlugin(pluginId: string): void {
        console.log(`[VueInstanceInterceptor] 清理插件注入: ${pluginId}`)

        // 查找所有该插件的注入元素
        const injectionElements = document.querySelectorAll(`[data-plugin-id="${pluginId}"]`)
        injectionElements.forEach(injectionEl => {
            // 清理Vue应用实例
            const vueApp = (injectionEl as any).__vueApp
            if (vueApp) {
                try {
                    vueApp.unmount()
                } catch (error) {
                    console.warn('[VueInstanceInterceptor] 卸载Vue组件失败:', error)
                }
            }

            // 移除DOM元素
            injectionEl.remove()
        })

        // 恢复被替换的元素
        document.querySelectorAll('[style*="display: none"]').forEach(el => {
            if (el instanceof HTMLElement) {
                el.style.display = ''
            }
        })
    }

    /**
     * 强制检查所有组件的注入
     */
    forceCheckAllInjections(): void {
        console.log('[VueInstanceInterceptor] 强制检查所有组件的注入')
        
        this.componentInstances.forEach((instances, componentName) => {
            const injections = componentInjectionManager.getInjections(componentName)
            if (injections.length > 0) {
                console.log(`[VueInstanceInterceptor] 强制检查 ${componentName}，有 ${injections.length} 个注入`)
                
                // 查找对应的DOM元素
                document.querySelectorAll('*').forEach((element) => {
                    const vueInstance = this.getVueInstance(element)
                    if (vueInstance && instances.has(vueInstance)) {
                        console.log(`[VueInstanceInterceptor] 对 ${componentName} 强制应用注入`)
                        this.applyInjectionsToElement(element, injections)
                    }
                })
            }
        })
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const totalInstances = Array.from(this.componentInstances.values())
            .reduce((sum, instances) => sum + instances.size, 0)

        const injectionElements = document.querySelectorAll('.plugin-injection')

        return {
            componentTypes: this.componentInstances.size,
            totalInstances,
            activeInjections: injectionElements.length
        }
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        // 恢复原始方法
        if (this.originalCreateVNode) {
            const Vue = (globalThis as any).Vue || (window as any).Vue
            if (Vue) {
                Vue.createVNode = this.originalCreateVNode
            }
        }

        if (this.originalMount && this.app) {
            this.app.mount = this.originalMount
        }

        // 清理所有注入
        const injectionElements = document.querySelectorAll('.plugin-injection')
        injectionElements.forEach(el => {
            const vueApp = (el as any).__vueApp
            if (vueApp) {
                try {
                    vueApp.unmount()
                } catch (error) {
                    console.warn('[VueInstanceInterceptor] 清理时卸载Vue组件失败:', error)
                }
            }
            el.remove()
        })

        this.componentInstances.clear()

        console.log('[VueInstanceInterceptor] 已清理所有资源')
    }
}

// 全局实例
export const vueInstanceInterceptor = new VueInstanceInterceptor()