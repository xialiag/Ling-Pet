# 跨窗口插件注入解决方案

## 🎯 问题分析

### 当前状况

1. ✅ 插件在设置窗口成功显示
2. ❌ 插件无法在 Live2D 窗口显示
3. ⚠️ 禁用插件后 DOM 元素可能残留

### 原因

- **设置窗口** 和 **Live2D 窗口** 是独立的
- 插件系统只在设置窗口初始化
- DOM 操作只影响当前窗口

## ✅ 解决方案

### 方案1：在所有窗口初始化插件系统（推荐）

#### 1.1 查找 Live2D 窗口入口

首先需要找到 Live2D 窗口的入口文件。可能的位置：

```
src/
├── main.ts              # 主窗口入口
├── live2d-window.ts     # Live2D 窗口入口（如果存在）
└── windows/
    └── live2d.ts        # 或者在这里
```

#### 1.2 在 Live2D 窗口初始化插件系统

```typescript
// src/live2d-window.ts 或类似文件
import { createApp } from 'vue'
import { createRouter } from 'vue-router'
import { initializePluginSystem } from './pluginLoader/init'
import App from './Live2DApp.vue'

const app = createApp(App)
const router = createRouter({...})

// ✅ 在 Live2D 窗口也初始化插件系统
await initializePluginSystem(app, router)

app.use(router)
app.mount('#app')
```

#### 1.3 优点

- ✅ 插件在所有窗口都能工作
- ✅ 每个窗口独立管理插件
- ✅ 支持窗口特定的插件功能

### 方案2：使用 Tauri 窗口通信

如果不想在每个窗口初始化插件系统，可以使用窗口间通信。

#### 2.1 创建窗口通信命令

```rust
// src-tauri/src/commands.rs
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn execute_in_window(
    app: AppHandle,
    window_label: String,
    script: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .eval(&script)
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Window {} not found", window_label))
    }
}

// 在 main.rs 中注册
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            execute_in_window,
            // ... 其他命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 2.2 在插件中使用

```typescript
// pluginLoader/plugins/hook-test/index.ts
async onLoad(context: PluginContext) {
    // 在当前窗口注入
    const hookElement = document.createElement('div')
    hookElement.id = 'hook-test-element'
    hookElement.className = 'hook-test-overlay'
    hookElement.textContent = 'hook组件成功 ✨'
    document.body.appendChild(hookElement)
    
    // 在 Live2D 窗口注入
    try {
        await context.invokeTauri('execute_in_window', {
            window_label: 'live2d',  // Live2D 窗口的标签
            script: `
                const hookElement = document.createElement('div');
                hookElement.id = 'hook-test-element';
                hookElement.className = 'hook-test-overlay';
                hookElement.textContent = 'hook组件成功 ✨';
                hookElement.style.cssText = \`
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
                \`;
                document.body.appendChild(hookElement);
            `
        })
        context.debug('已在 Live2D 窗口注入元素')
    } catch (error) {
        context.debug('在 Live2D 窗口注入失败:', error)
    }
}

async onUnload(context: PluginContext) {
    // 清理当前窗口
    document.getElementById('hook-test-element')?.remove()
    
    // 清理 Live2D 窗口
    try {
        await context.invokeTauri('execute_in_window', {
            window_label: 'live2d',
            script: `document.getElementById('hook-test-element')?.remove();`
        })
    } catch (error) {
        context.debug('清理 Live2D 窗口失败:', error)
    }
}
```

### 方案3：使用全局事件总线

#### 3.1 创建跨窗口事件系统

```typescript
// src/utils/crossWindowEvents.ts
import { emit, listen } from '@tauri-apps/api/event'

export const crossWindowEvents = {
    // 发送事件到所有窗口
    async emit(event: string, payload: any) {
        await emit(event, payload)
    },
    
    // 监听事件
    async listen(event: string, handler: (payload: any) => void) {
        return await listen(event, (event) => {
            handler(event.payload)
        })
    }
}
```

#### 3.2 在插件中使用

```typescript
async onLoad(context: PluginContext) {
    // 在当前窗口注入
    injectElement()
    
    // 发送事件到其他窗口
    await crossWindowEvents.emit('plugin:inject', {
        pluginId: 'hook-test',
        action: 'inject',
        html: '<div class="hook-test-overlay">hook组件成功 ✨</div>',
        styles: '...'
    })
}
```

#### 3.3 在 Live2D 窗口监听

```typescript
// src/live2d-window.ts
import { crossWindowEvents } from './utils/crossWindowEvents'

// 监听插件注入事件
crossWindowEvents.listen('plugin:inject', (payload) => {
    if (payload.action === 'inject') {
        const element = document.createElement('div')
        element.innerHTML = payload.html
        element.id = `plugin-${payload.pluginId}`
        document.body.appendChild(element)
    }
})

crossWindowEvents.listen('plugin:remove', (payload) => {
    document.getElementById(`plugin-${payload.pluginId}`)?.remove()
})
```

## 🐛 修复：禁用插件后组件残留

### 问题诊断

检查 `onUnload` 是否被调用：

```typescript
async onUnload(context: PluginContext) {
    console.log('🔴 onUnload 被调用了！')  // 添加日志
    context.debug('Hook测试插件卸载中...')
    
    // 移除元素
    const hookElement = document.getElementById('hook-test-element')
    console.log('🔴 找到的元素:', hookElement)  // 检查是否找到
    if (hookElement) {
        hookElement.remove()
        console.log('🔴 元素已移除')
        context.debug('Hook元素已移除')
    } else {
        console.log('🔴 未找到元素')
    }
}
```

### 解决方案

#### 方案A：强制刷新页面

```typescript
async onUnload(context: PluginContext) {
    // 移除元素
    document.getElementById('hook-test-element')?.remove()
    document.getElementById('hook-test-live2d-element')?.remove()
    document.getElementById('hook-test-styles')?.remove()
    
    // 如果元素仍然存在，强制刷新
    setTimeout(() => {
        if (document.getElementById('hook-test-element')) {
            console.warn('元素未被移除，建议刷新页面')
        }
    }, 100)
}
```

#### 方案B：使用 MutationObserver 确保移除

```typescript
async onUnload(context: PluginContext) {
    const removeElement = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            element.remove()
            
            // 确保移除
            const observer = new MutationObserver(() => {
                const stillExists = document.getElementById(id)
                if (stillExists) {
                    stillExists.remove()
                    observer.disconnect()
                }
            })
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            })
            
            setTimeout(() => observer.disconnect(), 1000)
        }
    }
    
    removeElement('hook-test-element')
    removeElement('hook-test-live2d-element')
    removeElement('hook-test-styles')
}
```

#### 方案C：添加清理标记

```typescript
// 在 onLoad 中
const hookElement = document.createElement('div')
hookElement.id = 'hook-test-element'
hookElement.dataset.plugin = 'hook-test'  // 添加标记
hookElement.dataset.cleanupOnUnload = 'true'
document.body.appendChild(hookElement)

// 在 onUnload 中
async onUnload(context: PluginContext) {
    // 移除所有带有插件标记的元素
    document.querySelectorAll('[data-plugin="hook-test"]').forEach(el => {
        el.remove()
    })
    
    // 移除样式
    document.querySelectorAll('style[id^="hook-test"]').forEach(el => {
        el.remove()
    })
}
```

## 📋 推荐实施步骤

### 短期方案（快速验证）

1. **使用方案2（Tauri窗口通信）**
   - 添加 `execute_in_window` 命令
   - 修改插件使用窗口通信
   - 测试跨窗口注入

2. **修复清理问题**
   - 使用方案C（添加清理标记）
   - 添加调试日志
   - 测试禁用/启用循环

### 长期方案（最佳实践）

1. **在所有窗口初始化插件系统**
   - 找到 Live2D 窗口入口
   - 添加插件系统初始化
   - 测试所有窗口的插件功能

2. **统一插件管理**
   - 创建跨窗口插件管理器
   - 同步插件状态
   - 统一清理机制

## 🎯 测试清单

- [ ] 插件在设置窗口显示
- [ ] 插件在 Live2D 窗口显示
- [ ] 禁用插件后元素被移除
- [ ] 重新启用插件正常工作
- [ ] 刷新页面后插件状态正确
- [ ] 多次启用/禁用循环正常

## 📚 相关文档

- [Tauri 窗口管理](https://tauri.app/v1/guides/features/window)
- [Tauri 事件系统](https://tauri.app/v1/guides/features/events)
- [插件系统文档](./pluginLoader/README.md)

---

**建议：先使用方案2（Tauri窗口通信）快速验证跨窗口注入，然后逐步迁移到方案1（在所有窗口初始化）。**
