/**
 * Hook测试插件
 * 功能：使用Vue组件注入在Live2DAvatar组件上方显示"hook组件成功"的组件
 * 设计初衷：验证插件系统的Vue组件注入功能和自动清理系统
 */

import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'
import { defineComponent, h } from 'vue'

// 保存清理函数
let cleanupFunctions: Array<() => void> = []

export default definePlugin({
    name: 'hook-test',
    version: '1.0.0',
    description: 'Hook测试插件 - 验证Vue组件注入和自动清理系统',

    async onLoad(context: PluginContext) {
        context.debug('🚀 Hook测试插件加载中...')
        context.debug('📝 测试目标：验证Vue组件注入和自动清理系统')

        // 注入样式（用于Vue组件）
        if (typeof document !== 'undefined') {
            const styleElement = document.createElement('style')
            styleElement.id = 'hook-test-styles'
            styleElement.textContent = `
        @keyframes hookFadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .hook-test-component {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
          z-index: 10;
          pointer-events: none;
          animation: hookFadeIn 0.5s ease-out;
          text-align: center;
          white-space: nowrap;
        }

        .hook-test-component-after {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 16px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 10px rgba(240, 147, 251, 0.3);
          z-index: 10;
          pointer-events: none;
          animation: hookFadeIn 0.5s ease-out;
          text-align: center;
          white-space: nowrap;
        }

        .hook-test-dom-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 12px 24px;
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          color: white;
          border-radius: 12px;
          font-size: 16px;
          font-weight: bold;
          box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
          z-index: 999999;
          pointer-events: none;
          animation: hookFadeIn 0.5s ease-out;
          text-align: center;
          white-space: nowrap;
        }
      `

            const existingStyle = document.getElementById('hook-test-styles')
            if (existingStyle) {
                existingStyle.remove()
            }

            document.head.appendChild(styleElement)
            context.debug('✅ Hook测试样式已注入')
        }

        // 尝试Vue组件注入
        try {
            context.debug('🔍 检查Live2DAvatar组件注册状态...')

            // 检查Live2DAvatar是否已全局注册
            const targetComponent = context.app.component('Live2DAvatar')
            context.debug(`📋 Live2DAvatar组件注册状态: ${targetComponent ? '已注册' : '未注册'}`)

            // Vue组件注入 - Before位置
            const HookBeforeComponent = defineComponent({
                name: 'HookBeforeComponent',
                setup() {
                    return () => h('div', {
                        class: 'hook-test-component'
                    }, '✨ Vue组件注入 (Before)')
                }
            })

            const unhookBefore = context.injectComponent('Live2DAvatar', HookBeforeComponent, {
                position: 'before',
                order: 1
            })

            cleanupFunctions.push(unhookBefore)
            context.debug('✅ Vue组件注入已设置 (Before位置)')

            // Vue组件注入 - After位置
            const HookAfterComponent = defineComponent({
                name: 'HookAfterComponent',
                setup() {
                    return () => h('div', {
                        class: 'hook-test-component-after'
                    }, '✨ Vue组件注入 (After)')
                }
            })

            const unhookAfter = context.injectComponent('Live2DAvatar', HookAfterComponent, {
                position: 'after',
                order: 1
            })

            cleanupFunctions.push(unhookAfter)
            context.debug('✅ Vue组件注入已设置 (After位置)')

            // 等待一段时间后检查注入是否成功
            setTimeout(() => {
                const beforeElements = document.querySelectorAll('.hook-test-component')
                const afterElements = document.querySelectorAll('.hook-test-component-after')

                if (beforeElements.length > 0 || afterElements.length > 0) {
                    context.debug('🎉 Vue组件注入成功！检测到注入的元素')
                } else {
                    context.debug('⚠️ Vue组件注入可能未生效，未检测到注入的元素')

                    // 显示备选提示
                    const domOverlay = document.createElement('div')
                    domOverlay.id = 'hook-test-dom-overlay'
                    domOverlay.className = 'hook-test-dom-overlay'
                    domOverlay.textContent = '⚠️ Vue组件注入未生效 - 组件可能未全局注册'
                    document.body.appendChild(domOverlay)

                    // 5秒后自动移除
                    setTimeout(() => {
                        const element = document.getElementById('hook-test-dom-overlay')
                        if (element) {
                            element.remove()
                        }
                    }, 5000)
                }
            }, 1000)

        } catch (error) {
            context.debug('❌ Vue组件注入失败:', error)
            console.error('[Hook-Test] Vue组件注入错误:', error)

            // 备选方案：使用DOM注入显示测试结果
            context.debug('🔄 使用DOM注入作为备选方案...')

            const domOverlay = document.createElement('div')
            domOverlay.id = 'hook-test-dom-overlay'
            domOverlay.className = 'hook-test-dom-overlay'
            domOverlay.textContent = '❌ Vue组件注入失败，请检查控制台错误'
            document.body.appendChild(domOverlay)

            // 5秒后自动移除
            setTimeout(() => {
                const element = document.getElementById('hook-test-dom-overlay')
                if (element) {
                    element.remove()
                }
            }, 5000)

            context.debug('✅ DOM备选方案已显示')
        }

        context.debug('📌 目标组件: Live2DAvatar')
        context.debug('📌 注入位置: Before 和 After')
        context.debug('💡 如果看不到组件，请检查控制台错误信息')
        context.debug('🎉 Hook测试插件加载完成')
        context.debug('💡 提示：禁用插件后观察Vue组件注入是否被自动清理')
    },

    async onUnload(context: PluginContext) {
        console.log('🔴 [Hook-Test] onUnload 开始执行')
        context.debug('🧹 Hook测试插件卸载中...')

        // 执行所有清理函数（手动清理Vue组件注入）
        console.log('🔴 [Hook-Test] 清理函数数量:', cleanupFunctions.length)
        cleanupFunctions.forEach(cleanup => cleanup())
        cleanupFunctions = []

        // 清理样式
        const styleElement = document.getElementById('hook-test-styles')
        if (styleElement) {
            styleElement.remove()
            console.log('✅ [Hook-Test] 样式已移除')
        }

        // 清理DOM备选方案元素
        const domOverlay = document.getElementById('hook-test-dom-overlay')
        if (domOverlay) {
            domOverlay.remove()
            console.log('✅ [Hook-Test] DOM备选方案元素已移除')
        }

        // 验证清理结果
        setTimeout(() => {
            const beforeElements = document.querySelectorAll('.hook-test-component')
            const afterElements = document.querySelectorAll('.hook-test-component-after')
            const domElements = document.querySelectorAll('.hook-test-dom-overlay')

            console.log('📊 [Hook-Test] 清理验证:')
            console.log('  - Before组件元素数量:', beforeElements.length)
            console.log('  - After组件元素数量:', afterElements.length)
            console.log('  - DOM备选方案元素数量:', domElements.length)

            if (beforeElements.length > 0 || afterElements.length > 0 || domElements.length > 0) {
                console.log('⏳ [Hook-Test] 部分元素仍存在，等待系统自动清理...')
                console.log('💡 [Hook-Test] 如果需要刷新页面，说明自动清理系统有问题')
            } else {
                console.log('✅ [Hook-Test] 所有注入元素已清理')
            }
        }, 200)

        // 再次验证（给系统更多时间）
        setTimeout(() => {
            const beforeElements = document.querySelectorAll('.hook-test-component')
            const afterElements = document.querySelectorAll('.hook-test-component-after')
            const domElements = document.querySelectorAll('.hook-test-dom-overlay')
            const totalElements = beforeElements.length + afterElements.length + domElements.length

            if (totalElements > 0) {
                console.error('❌ [Hook-Test] 部分注入元素未被完全清理！')
                console.error('❌ [Hook-Test] 剩余元素数量:', totalElements)
                console.error('❌ [Hook-Test] 自动清理系统可能有问题')
            } else {
                console.log('🎉 [Hook-Test] 完美！所有注入元素清理系统工作正常')
            }
        }, 1000)

        context.debug('✅ Hook测试插件卸载完成')
        console.log('🔴 [Hook-Test] onUnload 执行完成')
    }
})
