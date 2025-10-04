# 插件设置 API 增强

## 🎯 功能概述

为插件加载器添加了完整的插件设置 API，让插件可以在设置页面提供丰富的配置界面，包括各种类型的表单控件。

## ✨ 新增功能

### 支持的配置类型

1. **字符串输入** (`string`) - 文本输入框
2. **多行文本** (`textarea`) - 多行文本区域
3. **数字输入** (`number`) - 数字输入框
4. **范围滑块** (`range`) - 数值范围选择器
5. **布尔开关** (`boolean`) - 开关按钮
6. **单选下拉** (`select`) - 下拉选择菜单
7. **多选下拉** (`multiselect`) - 多选下拉菜单
8. **颜色选择** (`color`) - 颜色选择器
9. **文件选择** (`file`) - 文件上传选择器
10. **配置分组** (`group`) - 配置项分组容器

### 高级特性

- **条件显示** - 根据其他配置项的值动态显示/隐藏
- **数据验证** - 内置和自定义验证规则
- **帮助链接** - 配置项帮助文档链接
- **分组管理** - 可折叠的配置分组
- **实时保存** - 配置更改立即保存

## 🔧 API 详细说明

### PluginConfigSchema 接口

```typescript
export interface PluginConfigSchema {
  // 基础属性
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'color' | 'file' | 'range' | 'group'
  label: string                    // 显示标签
  description?: string             // 描述信息
  default?: any                    // 默认值
  required?: boolean               // 是否必填
  disabled?: boolean               // 是否禁用
  hidden?: boolean                 // 是否隐藏
  
  // 验证规则
  validation?: {
    min?: number                   // 最小值/最小长度
    max?: number                   // 最大值/最大长度
    pattern?: string               // 正则表达式
    validator?: (value: any) => boolean | string  // 自定义验证
  }
  
  // 字符串类型特有
  secret?: boolean                 // 密码字段
  placeholder?: string             // 占位符
  
  // 文本区域特有
  rows?: number                    // 行数
  
  // 数字/范围类型特有
  min?: number                     // 最小值
  max?: number                     // 最大值
  step?: number                    // 步长
  unit?: string                    // 单位
  
  // 选择类型特有
  options?: Array<{
    label: string
    value: any
    disabled?: boolean
    icon?: string
  }>
  multiple?: boolean               // 是否多选
  
  // 文件类型特有
  accept?: string                  // 文件类型
  multipleFiles?: boolean          // 多文件选择
  
  // 分组类型特有
  children?: Record<string, PluginConfigSchema>  // 子配置项
  collapsible?: boolean            // 可折叠
  expanded?: boolean               // 默认展开
  icon?: string                    // 分组图标
  
  // 高级功能
  condition?: (config: Record<string, any>) => boolean  // 条件显示
  class?: string                   // 自定义样式
  helpUrl?: string                 // 帮助链接
}
```

## 📝 使用示例

### 基础配置

```typescript
export default definePlugin({
    name: 'my-plugin',
    version: '1.0.0',
    
    configSchema: {
        // 字符串输入
        apiKey: {
            type: 'string',
            label: 'API 密钥',
            description: '用于访问外部服务的密钥',
            secret: true,
            required: true,
            placeholder: '请输入API密钥'
        },
        
        // 布尔开关
        enabled: {
            type: 'boolean',
            label: '启用插件',
            description: '是否启用插件功能',
            default: true
        },
        
        // 数字输入
        maxRetries: {
            type: 'number',
            label: '最大重试次数',
            description: '网络请求失败时的重试次数',
            default: 3,
            min: 0,
            max: 10,
            unit: '次'
        }
    },
    
    async onLoad(context) {
        // 读取配置
        const apiKey = context.getConfig('apiKey')
        const enabled = context.getConfig('enabled', true)
        const maxRetries = context.getConfig('maxRetries', 3)
        
        // 使用配置...
    }
})
```

### 高级配置示例

```typescript
configSchema: {
    // 配置分组
    basic: {
        type: 'group',
        label: '基础设置',
        icon: 'mdi-cog',
        expanded: true,
        children: {
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
            
            primaryColor: {
                type: 'color',
                label: '主色调',
                description: '界面的主要颜色',
                default: '#1976d2'
            }
        }
    },
    
    // 条件显示
    debugLevel: {
        type: 'select',
        label: '调试级别',
        options: [
            { label: '错误', value: 'error' },
            { label: '警告', value: 'warn' },
            { label: '信息', value: 'info' },
            { label: '调试', value: 'debug' }
        ],
        condition: (config) => config.basic?.debugMode === true
    },
    
    // 数据验证
    customConfig: {
        type: 'textarea',
        label: '自定义配置',
        description: 'JSON 格式的自定义配置',
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
}
```

## 🎨 UI 组件特性

### 字符串输入 (`string`)
- 支持密码字段 (`secret: true`)
- 占位符文本
- 长度验证
- 正则表达式验证
- 清除按钮

### 多行文本 (`textarea`)
- 可设置行数
- 自动增长
- 字符计数
- 清除按钮

### 数字输入 (`number`)
- 最小/最大值限制
- 步长控制
- 单位显示
- 数值验证

### 范围滑块 (`range`)
- 可视化数值选择
- 实时预览
- 步长控制
- 数值输入框联动

### 布尔开关 (`boolean`)
- Material Design 开关样式
- 状态指示
- 禁用状态支持

### 选择菜单 (`select`/`multiselect`)
- 图标支持
- 禁用选项
- 搜索过滤
- 多选芯片显示

### 颜色选择 (`color`)
- 颜色预览
- 十六进制输入
- 原生颜色选择器

### 文件选择 (`file`)
- 文件类型限制
- 多文件选择
- 文件大小显示
- 拖拽上传支持

### 配置分组 (`group`)
- 可折叠面板
- 图标支持
- 嵌套分组
- 条件显示

## 🔄 配置管理

### 自动保存
配置更改会立即保存到插件存储中，无需手动保存操作。

### 配置读取
```typescript
// 在插件中读取配置
const value = context.getConfig('configKey', defaultValue)

// 读取分组配置
const groupValue = context.getConfig('group.childKey', defaultValue)
```

### 配置监听
```typescript
// 插件会自动收到配置更改通知
// 通过 pluginLoader.notifyConfigChange() 触发
```

## 🎯 最佳实践

### 1. 配置结构设计
- 使用分组组织相关配置
- 提供合理的默认值
- 添加清晰的描述信息

### 2. 用户体验
- 使用条件显示避免界面混乱
- 提供验证反馈
- 添加帮助链接

### 3. 数据验证
- 使用内置验证规则
- 提供友好的错误信息
- 验证关键配置项

### 4. 性能考虑
- 避免过于复杂的条件逻辑
- 合理使用默认值
- 优化配置读取频率

## 📦 示例插件

创建了 `settings-demo` 插件来演示所有配置类型的使用：

```bash
# 查看示例插件
pluginLoader/plugins/settings-demo/
├── index.ts          # 插件实现
├── package.json      # 插件配置
└── README.md         # 使用说明
```

该插件展示了：
- 所有配置类型的使用
- 分组和条件显示
- 数据验证
- 配置读取和应用

## 🚀 使用方法

### 1. 定义配置Schema
在插件定义中添加 `configSchema` 属性：

```typescript
export default definePlugin({
    name: 'my-plugin',
    configSchema: {
        // 配置项定义...
    },
    async onLoad(context) {
        // 读取和使用配置...
    }
})
```

### 2. 在设置页面查看
1. 打开应用设置
2. 进入插件管理页面
3. 展开插件详情
4. 查看和修改配置

### 3. 在插件中使用
```typescript
// 读取配置值
const value = context.getConfig('configKey', defaultValue)

// 配置会自动保存，插件会收到更改通知
```

## 🔧 技术实现

### 核心组件
- `PluginConfigField.vue` - 通用配置字段组件
- `PluginSettings.vue` - 插件设置页面
- `PluginConfigSchema` - 配置Schema类型定义

### 特性支持
- TypeScript 类型安全
- Vue 3 Composition API
- Vuetify 3 UI 组件
- 响应式数据绑定
- 实时验证反馈

---

**插件设置 API 增强完成！现在插件可以提供丰富的配置界面，大大提升用户体验。** 🎉