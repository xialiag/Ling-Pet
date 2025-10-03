# 桌宠工具系统 - 完整实现

## 概述

实现了一套完整的工具管理系统，让桌宠 LLM 能够调用插件提供的工具来完成用户的请求。

## 核心组件

### 1. PetToolManager (`pluginLoader/core/petToolManager.ts`)

桌宠工具管理器，负责：
- 扫描插件注册的工具
- 生成工具列表提示词
- 解析 LLM 的工具调用请求
- 执行工具并返回结果
- 提供工具统计和文档

**主要方法**:
```typescript
// 生成工具提示词
generateToolPrompt(): string

// 提取工具调用
extractToolCall(llmResponse: string): PetToolCall | null

// 执行工具
executeToolCall(toolCall: PetToolCall): Promise<PetToolResult>

// 格式化结果
formatToolResult(result: PetToolResult): string

// 获取工具列表
getToolList(): ToolInfo[]

// 生成文档
generateToolDocumentation(): string
```

### 2. PetLLMIntegration (`pluginLoader/core/petLLMIntegration.ts`)

桌宠 LLM 集成层，提供：
- 自动注入工具提示词
- 处理 LLM 响应中的工具调用
- 包装聊天函数

### 3. 初始化和导出 (`pluginLoader/init.ts`)

提供便捷的 API：
```typescript
// 获取工具提示词
getPetToolPrompt(): string

// 提取工具调用
extractToolCallFromResponse(response: string)

// 执行工具
executePetToolCall(toolName: string, args: Record<string, any>)

// 获取工具列表
getPetToolList()

// 获取工具文档
getPetToolDocumentation(): string
```

## 工作流程

```
1. 插件注册工具
   ↓
2. PetToolManager 扫描并管理工具
   ↓
3. 生成工具提示词
   ↓
4. 注入到桌宠 LLM 的系统提示词
   ↓
5. 用户发送消息
   ↓
6. LLM 理解并决定是否使用工具
   ↓
7. LLM 生成工具调用（```tool 代码块）
   ↓
8. PetToolManager 解析工具调用
   ↓
9. 执行工具
   ↓
10. 将结果注入回对话
   ↓
11. LLM 基于结果生成最终回复
```

## 工具调用格式

LLM 使用以下格式调用工具：

```
\`\`\`tool
{
  "tool": "工具名称",
  "args": {
    "参数名": "参数值"
  }
}
\`\`\`
```

## 使用示例

### 基础使用

```typescript
import {
  getPetToolPrompt,
  extractToolCallFromResponse,
  executePetToolCall
} from '@/pluginLoader/init'

// 1. 构建系统提示词
const systemPrompt = `你是桌宠助手。\n\n${getPetToolPrompt()}`

// 2. 调用 LLM
const llmResponse = await callLLM([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '帮我搜索开心的表情包' }
])

// 3. 检查工具调用
const toolCall = extractToolCallFromResponse(llmResponse)

if (toolCall) {
  // 4. 执行工具
  const result = await executePetToolCall(toolCall.tool, toolCall.args)
  
  // 5. 处理结果
  console.log('工具结果:', result)
}
```

### 完整对话管理

参见 `pluginLoader/examples/pet-tool-integration.ts` 中的 `PetChatManager` 类。

## 插件开发

插件注册工具示例：

```typescript
export default definePlugin({
  name: 'my-plugin',
  
  async onLoad(context) {
    // 注册工具
    context.registerTool({
      name: 'my_tool',
      description: '工具描述',
      category: 'utility',
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: '参数描述',
          required: true
        }
      ],
      examples: ['my_tool("example")'],
      handler: async (param1: string) => {
        // 实现逻辑
        return { result: 'success' }
      }
    })
  }
})
```

## 对话示例

**用户**: 帮我搜索一个开心的表情包

**LLM**: 好的，我来帮你搜索开心的表情包。

```tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
```

**系统**: [工具执行结果]
工具: search_local_emoji
结果: { "count": 5, "emojis": [...] }

**LLM**: 我找到了 5 个开心的表情包：
1. 开心笑脸 (静态图)
2. 开心跳舞 (动图)
3. 开心鼓掌 (动图)
4. 开心庆祝 (静态图)
5. 开心比心 (静态图)

你想要哪一个呢？

## 文件结构

```
pluginLoader/
├── core/
│   ├── petToolManager.ts          # 桌宠工具管理器
│   ├── petLLMIntegration.ts       # LLM 集成层
│   └── toolManager.ts             # 底层工具管理器
├── docs/
│   └── PET_TOOL_SYSTEM.md         # 详细文档
├── examples/
│   └── pet-tool-integration.ts    # 集成示例
└── init.ts                         # 初始化和导出
```

## 特性

✅ **自动扫描**: 自动扫描所有插件注册的工具
✅ **动态提示词**: 根据可用工具动态生成提示词
✅ **标准格式**: 使用标准的 JSON 格式调用工具
✅ **错误处理**: 完整的错误处理和反馈
✅ **工具文档**: 自动生成工具文档
✅ **统计信息**: 提供工具使用统计
✅ **热加载**: 支持插件热加载，工具列表自动更新
✅ **类型安全**: 完整的 TypeScript 类型定义

## 优势

### 对比传统方案

| 特性 | 传统方案 | 桌宠工具系统 |
|------|---------|-------------|
| 工具发现 | ❌ 手动配置 | ✅ 自动扫描 |
| 提示词生成 | ❌ 手动编写 | ✅ 自动生成 |
| 工具调用 | ❌ 需要解析 | ✅ 标准格式 |
| 错误处理 | ❌ 需要实现 | ✅ 内置支持 |
| 插件集成 | ❌ 复杂 | ✅ 简单 |
| 热加载 | ❌ 不支持 | ✅ 支持 |

## 调试

### 查看可用工具

```typescript
const tools = getPetToolList()
console.log('可用工具:', tools)
```

### 查看工具提示词

```typescript
const prompt = getPetToolPrompt()
console.log('工具提示词:', prompt)
```

### 测试工具调用

```typescript
const result = await executePetToolCall('search_local_emoji', {
  query: '开心',
  limit: 5
})
console.log('测试结果:', result)
```

### 查看统计信息

```typescript
const stats = (window as any).__petToolManager.getToolStats()
console.log('工具统计:', stats)
```

## 扩展

### 添加新工具类型

可以扩展 `PetToolManager` 来支持：
- 可执行文件工具
- 外部 API 工具
- 复合工具（工具链）

### 自定义提示词格式

可以修改 `generateToolPrompt()` 方法来自定义提示词格式。

### 工具权限控制

可以添加权限检查来控制哪些工具可以被调用。

## 总结

桌宠工具系统提供了一套完整的解决方案，让桌宠 LLM 能够：

1. **自动发现**插件提供的工具
2. **动态生成**工具列表提示词
3. **标准化调用**工具
4. **处理结果**并继续对话

这使得桌宠能够真正利用插件的能力，完成更复杂的任务！🎉

## 下一步

1. 在桌宠的 LLM 调用中集成工具系统
2. 测试工具调用流程
3. 优化提示词以提高工具使用准确率
4. 添加更多实用工具
5. 实现工具调用的可视化反馈
