# LLM工具系统

## 概述

插件系统现在支持LLM工具注册和调用，允许：
1. 插件注册工具供LLM调用
2. 插件调用LLM服务
3. LLM自动选择和调用工具

## 架构

```
┌─────────────────────────────────────────┐
│          桌宠LLM / 其他插件              │
├─────────────────────────────────────────┤
│                                         │
│  调用工具 ←→ ToolManager ←→ 注册工具    │
│                                         │
└─────────────────────────────────────────┘
           ↓                    ↑
    ┌──────────────┐    ┌──────────────┐
    │  LLM Service │    │  插件工具     │
    │  - chat      │    │  - weather   │
    │  - complete  │    │  - search    │
    │  - function  │    │  - calculate │
    └──────────────┘    └──────────────┘
```

## 核心API

### 1. 注册工具

```typescript
context.registerTool({
  name: 'get_weather',
  description: '获取天气信息',
  category: 'utility',
  parameters: [
    {
      name: 'city',
      type: 'string',
      description: '城市名称',
      required: true
    }
  ],
  handler: async (city: string) => {
    // 实现逻辑
    return { temperature: 22, condition: '晴天' }
  }
})
```

### 2. 调用工具

```typescript
const result = await context.callTool('get_weather', {
  city: '北京'
})

if (result.success) {
  console.log(result.result)
}
```

### 3. 获取可用工具

```typescript
const tools = context.getAvailableTools()
console.log(tools.map(t => t.name))
```

## LLM服务插件

### 提供的工具

1. **llm_chat** - 聊天补全
   ```typescript
   await context.callTool('llm_chat', {
     messages: [
       { role: 'user', content: '你好' }
     ]
   })
   ```

2. **llm_complete** - 文本补全
   ```typescript
   await context.callTool('llm_complete', {
     prompt: '写一首诗：'
   })
   ```

3. **llm_function_call** - 函数调用
   ```typescript
   await context.callTool('llm_function_call', {
     messages: [...],
     tools: [...]
   })
   ```

4. **llm_embedding** - 嵌入向量
   ```typescript
   await context.callTool('llm_embedding', {
     text: '这是一段文本'
   })
   ```

## 完整示例

### 创建智能助手

```typescript
export default definePlugin({
  name: 'smart-assistant',
  
  async onLoad(context) {
    // 1. 注册工具
    context.registerTool({
      name: 'get_weather',
      description: '获取天气',
      parameters: [
        { name: 'city', type: 'string', required: true }
      ],
      handler: async (city) => {
        return { city, temperature: 22, condition: '晴天' }
      }
    })
    
    // 2. 创建助手
    const assistant = async (userMessage: string) => {
      // 获取所有工具
      const tools = context.getAvailableTools()
        .map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: {
              type: 'object',
              properties: t.parameters.reduce((acc, p) => {
                acc[p.name] = {
                  type: p.type,
                  description: p.description
                }
                return acc
              }, {})
            }
          }
        }))
      
      // 调用LLM
      const result = await context.callTool('llm_function_call', {
        messages: [
          { role: 'system', content: '你是助手' },
          { role: 'user', content: userMessage }
        ],
        tools
      })
      
      // 如果LLM决定调用工具
      if (result.result.type === 'tool_calls') {
        const toolCalls = result.result.toolCalls
        
        // 执行工具
        const toolResults = []
        for (const call of toolCalls) {
          const toolResult = await context.callTool(
            call.name,
            call.arguments
          )
          toolResults.push(toolResult)
        }
        
        return { toolCalls, toolResults }
      }
      
      // 否则返回文本回复
      return { message: result.result.content }
    }
    
    // 3. 注册为RPC
    context.registerRPC('assistant', assistant)
  }
})
```

### 使用助手

```typescript
// 其他插件或桌宠调用
const response = await context.callRPC('smart-assistant', 'assistant', '北京天气怎么样？')

// LLM会自动：
// 1. 识别需要调用 get_weather 工具
// 2. 提取参数 { city: '北京' }
// 3. 调用工具获取结果
// 4. 返回结果
```

## 工具定义格式

### 参数类型

```typescript
interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  enum?: string[]           // 枚举值
  properties?: Record<...>  // 对象属性
  items?: ToolParameter     // 数组项类型
}
```

### 完整示例

```typescript
{
  name: 'search',
  description: '搜索信息',
  category: 'utility',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词',
      required: true
    },
    {
      name: 'filters',
      type: 'object',
      description: '过滤条件',
      properties: {
        date: {
          name: 'date',
          type: 'string',
          description: '日期'
        },
        type: {
          name: 'type',
          type: 'string',
          description: '类型',
          enum: ['article', 'video', 'image']
        }
      }
    }
  ],
  handler: async (query, filters) => {
    // 实现
  }
}
```

## OpenAI格式转换

工具会自动转换为OpenAI格式：

```typescript
const tools = toolManager.getToolsForLLM()
// 返回：
[
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取天气',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称'
          }
        },
        required: ['city']
      }
    }
  }
]
```

## 工具历史

```typescript
// 获取调用历史
const history = toolManager.getHistory(10)

history.forEach(({ call, result }) => {
  console.log(`工具: ${call.name}`)
  console.log(`参数: ${JSON.stringify(call.arguments)}`)
  console.log(`结果: ${result.success ? '成功' : '失败'}`)
  console.log(`耗时: ${result.duration}ms`)
})
```

## 统计信息

```typescript
const stats = toolManager.getStats()
console.log(stats)
// {
//   totalTools: 10,
//   byPlugin: {
//     'llm-service': 4,
//     'example-llm-tools': 4,
//     'weather-plugin': 2
//   },
//   byCategory: {
//     'llm': 4,
//     'utility': 6
//   },
//   historySize: 45
// }
```

## 最佳实践

### 1. 工具命名

```typescript
// ✅ 好的命名
'get_weather'
'search_articles'
'calculate_distance'

// ❌ 不好的命名
'weather'
'search'
'calc'
```

### 2. 参数描述

```typescript
// ✅ 清晰的描述
{
  name: 'city',
  type: 'string',
  description: '城市名称，例如：北京、上海、深圳'
}

// ❌ 模糊的描述
{
  name: 'city',
  type: 'string',
  description: '城市'
}
```

### 3. 错误处理

```typescript
handler: async (city: string) => {
  try {
    const data = await fetchWeather(city)
    return data
  } catch (error) {
    throw new Error(`获取天气失败: ${error.message}`)
  }
}
```

### 4. 参数验证

```typescript
handler: async (city: string) => {
  if (!city || city.trim() === '') {
    throw new Error('城市名称不能为空')
  }
  
  if (city.length > 50) {
    throw new Error('城市名称过长')
  }
  
  // 继续处理
}
```

## 文件位置

- 核心实现: `pluginLoader/core/toolManager.ts`
- LLM服务: `pluginLoader/plugins/llm-service/`
- 示例插件: `pluginLoader/plugins/example-llm-tools/`

## 总结

LLM工具系统提供了：

✅ 统一的工具注册接口
✅ 自动参数验证
✅ OpenAI格式转换
✅ 工具调用历史
✅ 统计信息
✅ 自动清理

插件可以轻松注册工具供LLM调用，实现智能助手功能！
