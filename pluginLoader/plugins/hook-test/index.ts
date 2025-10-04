/**
 * Hook测试插件
 * 功能：在Live2DAvatar组件上方注入一个显示"hook组件成功"的组件
 */

import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'
import { defineComponent, h } from 'vue'

// 保存清理函数
let cleanupFunctions: Array<() => void> = []

export default definePlugin({
    name: 'hook-test',
    version: '1.0.0',
    description: 'Hook测试插件 - 在Live2D模型上方显示Hook组件',

    async onLoad(context: PluginContext) {
        context.debug('🚀 Hook测试插件加载中...')
        context.debug('📝 测试目标：验证自动清理系统')

        // 注入样式动画
        if (typeof document !== 'undefined') {
            const styleElement = document.createElement('style')
            styleElement.id = 'hook-test-styles'
            styleElement.textContent = `
        @keyframes hookFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        .hook-test-overlay {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          font-size: 16px;
          font-weight: bold;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
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

        // 方案1: DOM 直接注入（用于当前窗口）
        const hookElement = document.createElement('div')
        hookElement.id = 'hook-test-element'
        hookElement.className = 'hook-test-overlay'
        hookElement.textContent = '✨ hook组件成功 (DOM)'
        document.body.appendChild(hookElement)
        context.debug('✅ DOM元素已注入到当前窗口')

        // 方案2: Vue 组件注入（测试自动清理系统）
        try {
            const HookSuccessComponent = defineComponent({
                name: 'HookSuccessComponent',
                setup() {
                    return () => h('div', {
                        class: 'hook-test-overlay',
                        style: {
                            top: '60px',
                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                        }
                    }, '✨ hook组件成功 (Vue组件注入)')
                }
            })

            // 使用 injectComponent - 这个应该由系统自动清理
            const unhook = context.injectComponent('Live2DAvatar', HookSuccessComponent, {
                position: 'before',
                order: 1
            })

            // 保存清理函数（虽然系统应该自动清理，但作为备份）
            cleanupFunctions.push(unhook)

            context.debug('✅ Vue组件注入已设置')
            context.debug('📌 目标组件: Live2DAvatar')
            context.debug('📌 注意：如果看不到粉色文本框，说明 Live2DAvatar 组件未找到')
            context.debug('💡 检查控制台是否有 "Target component Live2DAvatar not found" 警告')
        } catch (error) {
            context.debug('❌ Vue组件注入失败:', error)
            console.error('[Hook-Test] Vue组件注入错误:', error)
        }

        context.debug('🎉 Hook测试插件加载完成')
        context.debug('💡 提示：禁用插件后观察是否需要刷新页面')
    },

    async onUnload(context: PluginContext) {
        console.log('🔴 [Hook-Test] onUnload 开始执行')
        context.debug('🧹 Hook测试插件卸载中...')

        // 执行所有清理函数
        console.log('🔴 [Hook-Test] 清理函数数量:', cleanupFunctions.length)
        cleanupFunctions.forEach(cleanup => cleanup())
        cleanupFunctions = []

        // 只清理 DOM 元素（Vue 组件注入由系统自动清理）
        const hookElement = document.getElementById('hook-test-element')
        if (hookElement) {
            hookElement.remove()
            console.log('✅ [Hook-Test] DOM元素已移除')
        }

        const styleElement = document.getElementById('hook-test-styles')
        if (styleElement) {
            styleElement.remove()
            console.log('✅ [Hook-Test] 样式已移除')
        }

        // 验证清理结果
        setTimeout(() => {
            const domElement = document.getElementById('hook-test-element')
            const vueElements = document.querySelectorAll('.hook-test-overlay')

            console.log('📊 [Hook-Test] 清理验证:')
            console.log('  - DOM元素:', domElement ? '❌ 仍存在' : '✅ 已清理')
            console.log('  - Vue组件元素数量:', vueElements.length)

            if (vueElements.length > 0) {
                console.log('⏳ [Hook-Test] Vue组件注入仍存在，等待系统自动清理...')
                console.log('💡 [Hook-Test] 如果需要刷新页面，说明自动清理系统有问题')
            } else {
                console.log('✅ [Hook-Test] 所有元素已清理（包括Vue组件注入）')
            }
        }, 200)

        // 再次验证（给系统更多时间）
        setTimeout(() => {
            const vueElements = document.querySelectorAll('.hook-test-overlay')
            if (vueElements.length > 0) {
                console.error('❌ [Hook-Test] Vue组件注入未被自动清理！')
                console.error('❌ [Hook-Test] 自动清理系统可能有问题')
            } else {
                console.log('🎉 [Hook-Test] 完美！自动清理系统工作正常')
            }
        }, 1000)

        context.debug('✅ Hook测试插件卸载完成')
        console.log('🔴 [Hook-Test] onUnload 执行完成')
    }
})
