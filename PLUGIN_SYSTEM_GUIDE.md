# 插件系统使用指南

## 🚀 快速开始

### 安装插件
1. 下载插件包（.zip 文件）
2. 打开应用 > 设置 > 插件管理
3. 点击"安装插件"，选择zip文件
4. 启用插件

### 开发插件
```bash
# 1. 创建插件目录
mkdir -p pluginLoader/plugins/my-plugin

# 2. 创建基本文件
cat > pluginLoader/plugins/my-plugin/package.json << EOF
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.ts"
}
EOF

# 3. 创建插件代码
cat > pluginLoader/plugins/my-plugin/index.ts << EOF
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    async onLoad(context) {
        context.debug('插件加载成功!')
    }
})
EOF

# 4. 构建插件
npm run plugin:release my-plugin
```

## 📚 核心API

### 基础API
```typescript
// 调试日志
context.debug('消息')

// 配置管理
const value = context.getConfig('key', defaultValue)
await context.setConfig('key', value)

// Tauri命令
const result = await context.invokeTauri('command', args)
```

### Vue组件注入
```typescript
// 注入到Vue组件
const cleanup = context.injectComponent('Live2DAvatar', MyComponent, {
    position: 'before' // before | after | replace
})

// 清理注入
cleanup()
```

### DOM注入
```typescript
// 注入HTML
const cleanup = context.injectHTML('.selector', '<div>内容</div>', {
    position: 'after'
})

// 注入CSS
const cleanup = context.injectCSS(`
    .my-style { color: red; }
`)

// 注入Vue组件到DOM
const cleanup = await context.injectVueComponent(
    '.selector', 
    MyComponent, 
    { message: 'Hello' }
)
```

### 工具注册
```typescript
// 注册LLM工具
const cleanup = context.registerTool({
    name: 'my_tool',
    description: '我的工具',
    parameters: [
        { name: 'input', type: 'string', description: '输入参数' }
    ],
    handler: async (args) => {
        return `处理结果: ${args.input}`
    }
})
```

### 插件通信
```typescript
// 监听事件
const cleanup = context.on('my-event', (data) => {
    console.log('收到事件:', data)
})

// 发送事件
context.emit('my-event', { message: 'Hello' })

// RPC调用
const cleanup = context.registerRPC('my-method', async (params) => {
    return { result: 'success' }
})

const result = await context.callRPC('other-plugin', 'their-method', params)
```

## 🎨 实际示例

### 简单插件
```typescript
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
    name: 'hello-world',
    version: '1.0.0',
    async onLoad(context) {
        // 添加页面横幅
        const cleanup = context.injectHTML('body', `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #4CAF50;
                color: white;
                text-align: center;
                padding: 10px;
                z-index: 9999;
            ">
                Hello World 插件已激活！
            </div>
        `, { position: 'prepend' })
        
        return cleanup
    }
})
```

### Vue组件插件
```typescript
import { definePlugin } from '../../core/pluginApi'
import { defineComponent, h, ref } from 'vue'

const CounterComponent = defineComponent({
    setup() {
        const count = ref(0)
        return () => h('div', {
            style: {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: '#2196F3',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                cursor: 'pointer'
            },
            onClick: () => count.value++
        }, `点击次数: ${count.value}`)
    }
})

export default definePlugin({
    name: 'counter-plugin',
    version: '1.0.0',
    async onLoad(context) {
        const cleanup = await context.injectVueComponent(
            'body',
            CounterComponent,
            {},
            { position: 'append' }
        )
        
        return cleanup
    }
})
```

### LLM工具插件
```typescript
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
    name: 'weather-tool',
    version: '1.0.0',
    async onLoad(context) {
        const cleanup = context.registerTool({
            name: 'get_weather',
            description: '获取天气信息',
            parameters: [
                {
                    name: 'city',
                    type: 'string',
                    description: '城市名称',
                    required: true
                }
            ],
            handler: async (args) => {
                // 模拟天气API调用
                return {
                    city: args.city,
                    temperature: '25°C',
                    condition: '晴天',
                    humidity: '60%'
                }
            }
        })
        
        return cleanup
    }
})
```

## 🔧 调试技巧

### 浏览器控制台
```javascript
// 查看插件状态
__pluginLoader.getLoadedPlugins()

// 查看DOM注入统计
__domInjectionManager.getStats()

// 手动触发注入检查
forceCheckInjections()
```

### 插件调试
```typescript
export default definePlugin({
    name: 'debug-plugin',
    async onLoad(context) {
        // 使用debug输出
        context.debug('插件开始加载')
        context.debug('配置值:', context.getConfig('myKey'))
        
        // 错误处理
        try {
            // 插件逻辑
        } catch (error) {
            context.debug('插件错误:', error)
        }
    }
})
```

## ⚠️ 注意事项

1. **清理资源**: 插件卸载时会自动清理，但复杂逻辑需要手动清理
2. **性能考虑**: 避免频繁的DOM操作和事件监听
3. **命名冲突**: 使用插件特定的类名和ID前缀
4. **错误处理**: 妥善处理异步操作和API调用错误

## 🎯 最佳实践

1. **模块化设计**: 将功能拆分为独立的模块
2. **配置驱动**: 使用配置文件控制插件行为
3. **用户友好**: 提供清晰的用户界面和反馈
4. **文档完善**: 为插件编写使用说明

## 📦 插件打包

```bash
# 构建单个插件
npm run plugin:release my-plugin

# 构建所有插件
npm run plugin:build

# 监听模式开发
npm run plugin:build:watch
```

## 🔗 相关资源

- 插件API类型定义: `pluginLoader/types/api.ts`
- 示例插件: `pluginLoader/plugins/`
- 构建工具: `pluginLoader/tools/`