/**
 * 演示：无需预留注入点的动态组件注入
 * 
 * 这个插件证明了：
 * 1. 主应用无需修改任何代码
 * 2. 无需预留PluginSlot
 * 3. 完全动态注入
 * 4. 支持热加载
 */

import { definePlugin } from '../../core/pluginApi'
import { h } from 'vue'

export default definePlugin({
  name: 'demo-no-slot',
  version: '1.0.0',
  
  async onLoad(context) {
    context.debug('🎯 演示：无需预留注入点的动态注入')
    
    // ========== 证明1：可以注入到任意已注册的组件 ==========
    
    // 假设主应用有这些组件（无需修改它们的代码）：
    // - ChatWindow
    // - SettingsPage
    // - UserProfile
    // - MessageList
    
    // 我们可以直接注入，无需它们预留任何插槽
    
    // 注入1：在ChatWindow顶部添加横幅
    context.injectComponent('ChatWindow', {
      setup() {
        return () => h('div', {
          style: {
            padding: '15px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textAlign: 'center',
            fontWeight: 'bold',
            borderRadius: '8px',
            margin: '10px'
          }
        }, [
          h('span', '🎉 '),
          h('span', '这是动态注入的横幅 - 主应用无需修改！'),
          h('span', ' 🎉')
        ])
      }
    }, {
      position: 'before',
      order: 1
    })
    
    // 注入2：在ChatWindow底部添加工具栏
    context.injectComponent('ChatWindow', {
      setup() {
        const buttons = [
          { label: '📎 附件', action: () => alert('附件功能') },
          { label: '😊 表情', action: () => alert('表情功能') },
          { label: '🎤 语音', action: () => alert('语音功能') },
          { label: '📍 位置', action: () => alert('位置功能') }
        ]
        
        return () => h('div', {
          style: {
            display: 'flex',
            gap: '10px',
            padding: '10px',
            background: '#f5f5f5',
            borderTop: '2px solid #e0e0e0'
          }
        }, buttons.map(btn => 
          h('button', {
            onClick: btn.action,
            style: {
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            },
            onMouseover: (e: any) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            },
            onMouseout: (e: any) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }
          }, btn.label)
        ))
      }
    }, {
      position: 'after',
      order: 1
    })
    
    // ========== 证明2：可以注入到多个组件 ==========
    
    // 在SettingsPage添加插件设置区域
    context.injectComponent('SettingsPage', {
      setup() {
        return () => h('div', {
          style: {
            padding: '20px',
            margin: '10px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px'
          }
        }, [
          h('h3', { style: { margin: '0 0 10px 0' } }, '🔧 插件设置'),
          h('p', { style: { margin: '0' } }, '这个区域是插件动态注入的，主应用代码无需修改！')
        ])
      }
    }, {
      position: 'after',
      order: 10
    })
    
    // ========== 证明3：条件渲染 ==========
    
    let showNotification = true
    
    context.injectComponent('ChatWindow', {
      setup() {
        return () => h('div', {
          style: {
            padding: '10px',
            background: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            margin: '10px'
          }
        }, '💡 提示：这个通知5秒后会自动消失（条件渲染演示）')
      }
    }, {
      position: 'before',
      order: 0,  // 最先显示
      condition: () => showNotification
    })
    
    // 5秒后隐藏通知
    setTimeout(() => {
      showNotification = false
      context.debug('✅ 通知已隐藏（条件渲染生效）')
    }, 5000)
    
    // ========== 证明4：多个插件可以共存 ==========
    
    // 模拟另一个插件也注入到ChatWindow
    context.injectComponent('ChatWindow', {
      setup() {
        return () => h('div', {
          style: {
            padding: '5px 10px',
            background: '#e3f2fd',
            fontSize: '12px',
            textAlign: 'right'
          }
        }, '📊 在线用户: 42 | 消息数: 1,234')
      }
    }, {
      position: 'after',
      order: 2  // 在工具栏之后
    })
    
    // ========== 证明5：可以访问原组件的props ==========
    
    context.injectComponent('UserProfile', {
      props: {
        userId: String
      },
      setup(props: any) {
        return () => h('div', {
          style: {
            padding: '10px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6'
          }
        }, `🔍 插件检测到用户ID: ${props.userId || '未知'}`)
      }
    }, {
      position: 'before'
    })
    
    // ========== 统计信息 ==========
    
    setTimeout(() => {
      const { componentInjectionManager } = require('../../core/componentInjection')
      const stats = componentInjectionManager.getStats()
      
      context.debug('📊 注入统计:', {
        目标组件数: stats.targetComponents,
        总注入数: stats.totalInjections,
        包装组件数: stats.wrappedComponents
      })
      
      context.debug('✅ 所有注入完成！主应用无需修改任何代码！')
    }, 1000)
  },
  
  async onUnload(context) {
    context.debug('🔄 插件卸载，所有注入自动清理')
  }
})
