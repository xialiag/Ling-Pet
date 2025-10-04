# 插件系统API参考

## 📋 PluginContext API

### 基础API

#### debug(...args: any[])
输出调试日志
```typescript
context.debug('插件加载', { status: 'success' })
```

#### getConfig<T>(key: string, defaultValue?: T): T
获取插件配置
```typescript
const apiKey = context.getConfig('apiKey', '')
const maxRetries = context.getConfig('maxRetries', 3)
```

#### setConfig(key: string, value: any): Promise<void>
保存插件配置
```typescript
await context.setConfig('lastUpdate', Date.now())
```

#### invokeTauri<T>(command: string, args?: Record<string, any>): Promise<T>
调用Tauri命令
```typescript
const result = await context.invokeTauri('get_system_info')
```

### Vue组件注入API

#### injectComponent(target: string, component: Component, options?: InjectOptions): UnhookFunction
向Vue组件注入内容
```typescript
const cleanup = context.injectComponent('Live2DAvatar', MyComponent, {
    position: 'before',  // 'before' | 'after' | 'replace'
    props: { message: 'Hello' },
    order: 1
})
```

**InjectOptions**:
```typescript
interface InjectOptions {
    position?: 'before' | 'after' | 'replace'
    props?: Record<string, any>
    condition?: () => boolean
    order?: number
}
```

### DOM注入API

#### injectHTML(selector: string, html: string, options?: DOMInjectionOptions): () => void
注入HTML内容
```typescript
const cleanup = context.injectHTML('.target', '<div>内容</div>', {
    position: 'after',
    className: 'my-injection',
    style: { color: 'red' }
})
```

#### injectText(selector: string, text: string, options?: DOMInjectionOptions): () => void
注入文本内容
```typescript
const cleanup = context.injectText('title', ' - 插件扩展', {
    position: 'append'
})
```

#### injectVueComponent(selector: string, component: Component, props?: Record<string, any>, options?: DOMInjectionOptions): Promise<() => void>
注入Vue组件到DOM
```typescript
const cleanup = await context.injectVueComponent(
    '.container',
    MyComponent,
    { message: 'Hello' },
    { position: 'prepend' }
)
```

#### injectCSS(css: string, options?: { id?: string }): () => void
注入CSS样式
```typescript
const cleanup = context.injectCSS(`
    .my-style {
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        padding: 10px;
    }
`, { id: 'my-plugin-styles' })
```

#### querySelector(selector: string): Element | null
查询DOM元素
```typescript
const element = context.querySelector('.target')
```

#### querySelectorAll(selector: string): NodeListOf<Element>
查询所有匹配元素
```typescript
const elements = context.querySelectorAll('div')
```

#### waitForElement(selector: string, timeout?: number): Promise<Element>
等待元素出现
```typescript
try {
    const element = await context.waitForElement('.dynamic-content', 5000)
} catch (error) {
    context.debug('元素未在5秒内出现')
}
```

**DOMInjectionOptions**:
```typescript
interface DOMInjectionOptions {
    position?: 'before' | 'after' | 'prepend' | 'append' | 'replace'
    className?: string
    style?: Record<string, string> | string
    attributes?: Record<string, string>
    condition?: () => boolean
    order?: number
    autoRemove?: boolean
}
```

### 工具注册API

#### registerTool(tool: ToolRegistration): UnhookFunction
注册LLM工具
```typescript
const cleanup = context.registerTool({
    name: 'calculate',
    description: '执行数学计算',
    parameters: [
        {
            name: 'expression',
            type: 'string',
            description: '数学表达式',
            required: true
        }
    ],
    handler: async (args) => {
        return eval(args.expression)
    },
    category: 'math',
    examples: ['2 + 2', 'Math.sqrt(16)']
})
```

**ToolRegistration**:
```typescript
interface ToolRegistration {
    name: string
    description: string
    parameters: ToolParameter[]
    handler: (...args: any[]) => Promise<any> | any
    category?: string
    examples?: string[]
}

interface ToolParameter {
    name: string
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    description: string
    required?: boolean
    enum?: string[]
    properties?: Record<string, ToolParameter>
    items?: ToolParameter
}
```

#### callTool<T>(name: string, args: Record<string, any>): Promise<ToolCallResult<T>>
调用工具
```typescript
const result = await context.callTool('calculate', { expression: '2 + 2' })
if (result.success) {
    context.debug('计算结果:', result.result)
}
```

#### getAvailableTools(): ToolInfo[]
获取可用工具列表
```typescript
const tools = context.getAvailableTools()
tools.forEach(tool => {
    context.debug(`工具: ${tool.name} - ${tool.description}`)
})
```

### 插件通信API

#### on(event: string, handler: Function): UnhookFunction
监听事件
```typescript
const cleanup = context.on('user-action', (data) => {
    context.debug('用户操作:', data)
})
```

#### emit(event: string, ...args: any[]): void
发送事件
```typescript
context.emit('plugin-ready', { pluginName: 'my-plugin' })
```

#### off(event: string, handler?: Function): void
取消监听
```typescript
context.off('user-action', handler)
context.off('user-action') // 取消所有监听
```

#### registerRPC(method: string, handler: Function): UnhookFunction
注册RPC方法
```typescript
const cleanup = context.registerRPC('getData', async (params) => {
    return { data: 'some data', timestamp: Date.now() }
})
```

#### callRPC<T>(pluginId: string, method: string, ...params: any[]): Promise<T>
调用其他插件的RPC方法
```typescript
try {
    const result = await context.callRPC('other-plugin', 'processData', { input: 'test' })
    context.debug('RPC结果:', result)
} catch (error) {
    context.debug('RPC调用失败:', error)
}
```

#### createSharedState<T>(key: string, initialValue: T, options?: SharedStateOptions): T
创建共享状态
```typescript
const sharedCounter = context.createSharedState('counter', 0, {
    readonly: false,
    persistent: true
})
```

#### getSharedState<T>(pluginId: string, key: string): T | undefined
获取其他插件的共享状态
```typescript
const otherPluginState = context.getSharedState('other-plugin', 'settings')
```

### 文件系统API

#### fs.readFile(path: string): Promise<string>
读取文件
```typescript
const content = await context.fs.readFile('/path/to/file.txt')
```

#### fs.writeFile(path: string, content: string | Uint8Array): Promise<void>
写入文件
```typescript
await context.fs.writeFile('/path/to/file.txt', 'Hello World')
```

#### fs.readDir(path: string): Promise<Array<{name: string, isFile: boolean, isDirectory: boolean}>>
读取目录
```typescript
const entries = await context.fs.readDir('/path/to/directory')
entries.forEach(entry => {
    context.debug(`${entry.name} - ${entry.isFile ? '文件' : '目录'}`)
})
```

#### fs.exists(path: string): Promise<boolean>
检查文件/目录是否存在
```typescript
if (await context.fs.exists('/path/to/file.txt')) {
    context.debug('文件存在')
}
```

#### fs.mkdir(path: string, options?: {recursive?: boolean}): Promise<void>
创建目录
```typescript
await context.fs.mkdir('/path/to/new/directory', { recursive: true })
```

#### fs.remove(path: string): Promise<void>
删除文件/目录
```typescript
await context.fs.remove('/path/to/file.txt')
```

### HTTP请求API

#### fetch(url: string, options?: RequestInit): Promise<Response>
发送HTTP请求
```typescript
const response = await context.fetch('https://api.example.com/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
})
const data = await response.json()
```

### 路径API

#### getAppDataDir(): Promise<string>
获取应用数据目录
```typescript
const dataDir = await context.getAppDataDir()
const configPath = `${dataDir}/my-plugin-config.json`
```

## 🎯 插件定义

### definePlugin(definition: PluginDefinition): PluginDefinition
定义插件
```typescript
export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    description: '我的插件',
    author: '作者名',
    
    async onLoad(context) {
        // 插件加载逻辑
        context.debug('插件加载完成')
        
        // 返回清理函数
        return () => {
            context.debug('插件清理完成')
        }
    },
    
    async onUnload(context) {
        // 插件卸载逻辑
        context.debug('插件卸载完成')
    }
})
```

**PluginDefinition**:
```typescript
interface PluginDefinition {
    name: string
    version: string
    description?: string
    author?: string
    onLoad: (context: PluginContext) => Promise<void | (() => void)> | void | (() => void)
    onUnload?: (context: PluginContext) => Promise<void> | void
    configSchema?: Record<string, PluginConfigSchema>
    settingsActions?: PluginSettingsAction[]
}
```

**PluginConfigSchema** - 插件配置项定义:
```typescript
interface PluginConfigSchema {
    type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'color' | 'file' | 'range' | 'group'
    label: string
    description?: string
    default?: any
    required?: boolean
    disabled?: boolean
    hidden?: boolean
    
    // 验证规则
    validation?: {
        min?: number
        max?: number
        pattern?: string
        validator?: (value: any) => boolean | string
    }
    
    // 类型特有属性
    secret?: boolean              // string: 密码字段
    placeholder?: string          // string: 占位符
    rows?: number                 // textarea: 行数
    min?: number                  // number/range: 最小值
    max?: number                  // number/range: 最大值
    step?: number                 // number/range: 步长
    unit?: string                 // number/range: 单位
    options?: Array<{             // select/multiselect: 选项
        label: string
        value: any
        disabled?: boolean
        icon?: string
    }>
    multiple?: boolean            // select: 多选
    accept?: string               // file: 文件类型
    multipleFiles?: boolean       // file: 多文件
    children?: Record<string, PluginConfigSchema>  // group: 子项
    collapsible?: boolean         // group: 可折叠
    expanded?: boolean            // group: 默认展开
    icon?: string                 // group: 图标
    
    // 高级功能
    condition?: (config: Record<string, any>) => boolean
    class?: string
    helpUrl?: string
}
```

## 🔧 类型定义

### UnhookFunction
```typescript
type UnhookFunction = () => void
```

### ToolCallResult<T>
```typescript
interface ToolCallResult<T = any> {
    success: boolean
    result?: T
    error?: string
    duration: number
}
```

### SharedStateOptions
```typescript
interface SharedStateOptions {
    readonly?: boolean
    persistent?: boolean
}
```

## 📝 使用示例

## 🎛️ 插件配置 API

### 配置Schema定义
```typescript
export default definePlugin({
    name: 'my-plugin',
    configSchema: {
        // 字符串输入
        apiKey: {
            type: 'string',
            label: 'API密钥',
            description: '用于访问外部服务',
            secret: true,
            required: true,
            validation: {
                min: 10,
                pattern: '^[a-zA-Z0-9]+$'
            }
        },
        
        // 布尔开关
        enabled: {
            type: 'boolean',
            label: '启用功能',
            default: true
        },
        
        // 选择菜单
        theme: {
            type: 'select',
            label: '主题',
            default: 'auto',
            options: [
                { label: '自动', value: 'auto', icon: 'mdi-brightness-auto' },
                { label: '浅色', value: 'light', icon: 'mdi-brightness-7' },
                { label: '深色', value: 'dark', icon: 'mdi-brightness-4' }
            ]
        },
        
        // 配置分组
        advanced: {
            type: 'group',
            label: '高级设置',
            collapsible: true,
            children: {
                debugMode: {
                    type: 'boolean',
                    label: '调试模式',
                    default: false
                },
                logLevel: {
                    type: 'select',
                    label: '日志级别',
                    options: [
                        { label: '错误', value: 'error' },
                        { label: '信息', value: 'info' },
                        { label: '调试', value: 'debug' }
                    ],
                    condition: (config) => config.advanced?.debugMode === true
                }
            }
        }
    },
    
    async onLoad(context) {
        // 读取配置
        const apiKey = context.getConfig('apiKey')
        const enabled = context.getConfig('enabled', true)
        const theme = context.getConfig('theme', 'auto')
        const debugMode = context.getConfig('advanced.debugMode', false)
        
        // 使用配置...
    }
})
```

### 支持的配置类型

#### 1. 字符串输入 (`string`)
```typescript
{
    type: 'string',
    label: '文本输入',
    placeholder: '请输入...',
    secret: false,           // 是否为密码字段
    validation: {
        min: 5,              // 最小长度
        max: 100,            // 最大长度
        pattern: '^[a-z]+$'  // 正则验证
    }
}
```

#### 2. 多行文本 (`textarea`)
```typescript
{
    type: 'textarea',
    label: '多行文本',
    rows: 4,                 // 行数
    placeholder: '请输入详细描述...'
}
```

#### 3. 数字输入 (`number`)
```typescript
{
    type: 'number',
    label: '数字',
    min: 0,
    max: 100,
    step: 1,
    unit: '个',              // 单位显示
    default: 10
}
```

#### 4. 范围滑块 (`range`)
```typescript
{
    type: 'range',
    label: '范围选择',
    min: 0,
    max: 100,
    step: 5,
    unit: '%',
    default: 50
}
```

#### 5. 布尔开关 (`boolean`)
```typescript
{
    type: 'boolean',
    label: '开关',
    description: '启用或禁用功能',
    default: true
}
```

#### 6. 单选下拉 (`select`)
```typescript
{
    type: 'select',
    label: '选择项',
    options: [
        { label: '选项1', value: 'option1', icon: 'mdi-star' },
        { label: '选项2', value: 'option2', disabled: true }
    ],
    default: 'option1'
}
```

#### 7. 多选下拉 (`multiselect`)
```typescript
{
    type: 'multiselect',
    label: '多选项',
    options: [
        { label: '功能A', value: 'featureA' },
        { label: '功能B', value: 'featureB' }
    ],
    default: ['featureA']
}
```

#### 8. 颜色选择 (`color`)
```typescript
{
    type: 'color',
    label: '颜色',
    description: '选择主题颜色',
    default: '#1976d2'
}
```

#### 9. 文件选择 (`file`)
```typescript
{
    type: 'file',
    label: '文件',
    accept: '.json,.txt',    // 允许的文件类型
    multipleFiles: false     // 是否允许多文件
}
```

#### 10. 配置分组 (`group`)
```typescript
{
    type: 'group',
    label: '分组名称',
    icon: 'mdi-cog',
    collapsible: true,       // 可折叠
    expanded: false,         // 默认展开
    children: {
        // 子配置项...
    }
}
```

### 高级功能

#### 条件显示
```typescript
{
    type: 'select',
    label: '日志级别',
    condition: (config) => config.debugMode === true,  // 仅在调试模式下显示
    options: [...]
}
```

#### 数据验证
```typescript
{
    type: 'textarea',
    label: 'JSON配置',
    validation: {
        validator: (value) => {
            if (!value) return true
            try {
                JSON.parse(value)
                return true
            } catch {
                return '请输入有效的JSON格式'
            }
        }
    }
}
```

#### 帮助链接
```typescript
{
    type: 'string',
    label: 'API密钥',
    helpUrl: 'https://example.com/help/api-key'  // 帮助文档链接
}
```

### 完整插件示例
```typescript
import { definePlugin } from '../../core/pluginApi'
import { defineComponent, h, ref } from 'vue'

const StatusComponent = defineComponent({
    setup() {
        const status = ref('运行中')
        return () => h('div', {
            style: {
                position: 'fixed',
                top: '10px',
                right: '10px',
                background: '#4CAF50',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '12px'
            }
        }, `状态: ${status.value}`)
    }
})

export default definePlugin({
    name: 'status-plugin',
    version: '1.0.0',
    description: '状态显示插件',
    
    async onLoad(context) {
        const cleanupFunctions: Array<() => void> = []
        
        // 1. 注入CSS样式
        const cleanupCSS = context.injectCSS(`
            .status-plugin { font-family: Arial, sans-serif; }
        `)
        cleanupFunctions.push(cleanupCSS)
        
        // 2. 注入Vue组件
        const cleanupComponent = await context.injectVueComponent(
            'body',
            StatusComponent,
            {},
            { position: 'append' }
        )
        cleanupFunctions.push(cleanupComponent)
        
        // 3. 注册工具
        const cleanupTool = context.registerTool({
            name: 'get_status',
            description: '获取插件状态',
            parameters: [],
            handler: async () => {
                return { status: 'running', timestamp: Date.now() }
            }
        })
        cleanupFunctions.push(cleanupTool)
        
        // 4. 监听事件
        const cleanupEvent = context.on('status-check', () => {
            context.debug('状态检查请求')
        })
        cleanupFunctions.push(cleanupEvent)
        
        context.debug('状态插件加载完成')
        
        // 返回统一清理函数
        return () => {
            cleanupFunctions.forEach(cleanup => cleanup())
            context.debug('状态插件清理完成')
        }
    }
})
```