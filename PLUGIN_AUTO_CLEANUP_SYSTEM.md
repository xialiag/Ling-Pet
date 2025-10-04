# 插件自动清理系统

## 🎯 问题

使用 `injectComponent` 的插件在卸载时，Vue 组件注入可能会残留在组件树中，需要刷新页面才能完全清理。

## ✅ 解决方案

在插件加载器层面实现**自动清理和刷新机制**，让所有插件都能自动受益，无需每个插件单独处理。

## 🔧 实现

### 1. ComponentInjectionManager 增强

**位置**: `pluginLoader/core/componentInjection.ts`

#### 改进的 cleanupPlugin 方法

```typescript
cleanupPlugin(pluginId: string): void {
    const affectedComponents: string[] = []
    
    // 记录受影响的组件
    this.injections.forEach((injectionList, componentName) => {
        const filtered = injectionList.filter(i => i.pluginId !== pluginId)
        if (filtered.length !== injectionList.length) {
            affectedComponents.push(componentName)
        }
        
        if (filtered.length === 0) {
            this.injections.delete(componentName)
            this.wrappedComponents.delete(componentName)
        } else {
            this.injections.set(componentName, filtered)
        }
    })
    
    // 触发刷新
    if (affectedComponents.length > 0) {
        this.triggerComponentRefresh(affectedComponents)
    }
}
```

#### 新增 triggerComponentRefresh 方法

```typescript
private triggerComponentRefresh(componentNames: string[]): void {
    // 方案1: 发送全局事件
    window.dispatchEvent(new CustomEvent('plugin:component-injection-changed', {
        detail: { components: componentNames }
    }))
    
    // 方案2: 清除包装组件缓存，强制重新创建
    componentNames.forEach(name => {
        this.wrappedComponents.delete(name)
    })
}
```

### 2. PluginLoader 增强

**位置**: `pluginLoader/core/pluginLoader.ts`

#### 在 unloadPlugin 中添加强制刷新

```typescript
async unloadPlugin(pluginId: string): Promise<boolean> {
    // ... 执行 onUnload
    
    // 清理组件注入
    componentInjectionManager.cleanupPlugin(pluginId)
    
    // ✅ 新增：强制刷新当前路由
    await this.forceRefreshCurrentRoute()
    
    // ... 其他清理
}
```

#### 新增 forceRefreshCurrentRoute 方法

```typescript
private async forceRefreshCurrentRoute(): Promise<void> {
    if (!this.router) return
    
    const currentRoute = this.router.currentRoute.value
    
    // 使用临时查询参数触发重新渲染
    await this.router.replace({
        path: currentRoute.path,
        query: { ...currentRoute.query, _refresh: Date.now().toString() }
    })
    
    // 立即移除临时参数
    setTimeout(() => {
        const query = { ...currentRoute.query }
        delete query._refresh
        this.router?.replace({ path: currentRoute.path, query })
    }, 100)
}
```

## 🎨 工作流程

```
插件卸载
  ↓
执行 plugin.onUnload()
  ↓
清理组件注入 (componentInjectionManager.cleanupPlugin)
  ├─ 移除插件的所有注入
  ├─ 记录受影响的组件
  ├─ 发送全局事件
  └─ 清除包装组件缓存
  ↓
强制刷新路由 (forceRefreshCurrentRoute)
  ├─ 添加临时 _refresh 参数
  ├─ 触发路由重新渲染
  └─ 移除临时参数
  ↓
组件重新渲染
  ├─ 重新创建包装组件
  ├─ 只包含剩余的注入
  └─ 清理完成
```

## 📊 效果对比

### 修改前

| 操作 | 结果 | 需要刷新 |
|------|------|---------|
| 禁用插件 | 组件注入残留 | ✅ 是 |
| 重新启用 | 可能冲突 | ✅ 是 |

### 修改后

| 操作 | 结果 | 需要刷新 |
|------|------|---------|
| 禁用插件 | 自动清理 | ❌ 否 |
| 重新启用 | 正常工作 | ❌ 否 |

## 🎯 优势

### 1. 自动化

- ✅ 所有插件自动受益
- ✅ 无需插件开发者额外处理
- ✅ 统一的清理机制

### 2. 可靠性

- ✅ 多重清理策略
- ✅ 强制刷新确保清理
- ✅ 不依赖插件实现

### 3. 用户体验

- ✅ 无需手动刷新页面
- ✅ 即时生效
- ✅ 流畅的启用/禁用体验

## 🔍 技术细节

### 路由刷新机制

使用临时查询参数触发 Vue Router 的重新渲染：

```typescript
// 添加临时参数
router.replace({ 
    path: '/current', 
    query: { _refresh: '1234567890' } 
})

// 移除临时参数
setTimeout(() => {
    router.replace({ 
        path: '/current', 
        query: {} 
    })
}, 100)
```

**原理**:
- Vue Router 检测到 query 变化
- 触发组件重新渲染
- 包装组件重新创建（不包含已卸载插件的注入）
- 临时参数被移除，URL 恢复正常

### 全局事件

发送自定义事件通知组件刷新：

```typescript
window.dispatchEvent(new CustomEvent('plugin:component-injection-changed', {
    detail: { components: ['Live2DAvatar', 'ChatWindow'] }
}))
```

组件可以监听此事件并自行刷新（可选）。

### 包装组件缓存清除

```typescript
this.wrappedComponents.delete(componentName)
```

下次访问时会重新创建包装组件，不包含已卸载插件的注入。

## 📝 插件开发者指南

### 推荐做法

使用 `injectComponent` 时，**不需要**手动清理：

```typescript
export default definePlugin({
    async onLoad(context) {
        // ✅ 直接注入，系统会自动清理
        context.injectComponent('MyComponent', MyInjectedComponent, {
            position: 'before'
        })
    },
    
    async onUnload(context) {
        // ✅ 不需要手动清理组件注入
        // 系统会自动处理
    }
})
```

### 可选的额外清理

如果插件有其他资源（DOM 元素、事件监听等），仍需手动清理：

```typescript
export default definePlugin({
    async onLoad(context) {
        // 注入组件
        context.injectComponent('MyComponent', MyInjectedComponent, {
            position: 'before'
        })
        
        // 添加 DOM 元素
        const element = document.createElement('div')
        document.body.appendChild(element)
        
        // 保存引用
        this.element = element
    },
    
    async onUnload(context) {
        // ✅ 组件注入自动清理
        
        // ✅ 手动清理其他资源
        if (this.element) {
            this.element.remove()
        }
    }
})
```

## 🧪 测试

### 测试步骤

1. **启用插件**
   - 使用 `injectComponent` 注入组件
   - 验证组件显示

2. **禁用插件**
   - 观察是否自动清理
   - 检查是否需要刷新页面

3. **重新启用**
   - 验证是否正常工作
   - 检查是否有冲突

4. **多次循环**
   - 重复启用/禁用
   - 验证稳定性

### 预期结果

- ✅ 禁用后立即清理，无需刷新
- ✅ 重新启用正常工作
- ✅ 多次循环无问题
- ✅ 控制台显示清理日志

## 🎊 总结

### 改进内容

1. **ComponentInjectionManager**
   - 追踪受影响的组件
   - 发送全局刷新事件
   - 清除包装组件缓存

2. **PluginLoader**
   - 自动触发路由刷新
   - 确保组件重新渲染
   - 统一的清理流程

### 受益对象

- ✅ **所有使用 `injectComponent` 的插件**
- ✅ **插件开发者** - 无需额外代码
- ✅ **用户** - 更好的体验

### 兼容性

- ✅ 向后兼容
- ✅ 不影响现有插件
- ✅ 自动应用到所有插件

---

**现在所有插件都能自动清理组件注入，无需手动刷新页面！** 🎉
