# bilibili-emoji 插件调试指南

## 浏览器控制台调试

### 快速开始

打开浏览器控制台（F12），输入：

```javascript
// 查看帮助
debug.help()

// 查看 bilibili-emoji 专用帮助
emojiDebug.help()
```

## 通用调试命令

### 1. 插件管理

```javascript
// 列出所有插件
debug.listPlugins()

// 获取插件信息
debug.getPluginInfo('bilibili-emoji')

// 重新加载插件
await debug.reloadPlugin('bilibili-emoji')
```

### 2. 工具管理

```javascript
// 列出所有工具
debug.listTools()

// 获取工具详情
debug.getToolDetail('search_local_emoji')

// 查看工具调用历史
debug.getToolHistory(10)

// 获取统计信息
debug.getToolStats()
```

### 3. 桌宠工具

```javascript
// 获取工具提示词（用于 LLM）
debug.getPetToolPrompt()

// 获取工具列表
debug.getPetToolList()
```

## bilibili-emoji 专用命令

### 1. 基础测试

```javascript
// 扫描表情包
await emojiDebug.testScan()

// 搜索本地表情包
await emojiDebug.testSearchLocal('开心', 5)

// 搜索 B站表情包
await emojiDebug.testSearchBilibili('鸽宝')

// 下载表情包
await emojiDebug.testDownload(114156001, 'normal')

// 获取随机表情包
await emojiDebug.testRandom()

// 列出所有分类
await emojiDebug.listCategories()
```

### 2. 完整测试流程

```javascript
// 运行完整测试
await emojiDebug.runFullTest()
```

输出示例：
```
🧪 开始完整测试流程

1️⃣ 扫描表情包
   找到 24 个表情包

2️⃣ 列出分类
   共 3 个分类

3️⃣ 搜索本地表情包
   找到 5 个结果

4️⃣ 获取随机表情包
   随机表情: 开心笑脸

✅ 测试完成！
```

### 3. LLM 工具调用测试

```javascript
// 测试 LLM 工具调用
await emojiDebug.testLLMCall()
```

## 详细示例

### 示例 1: 搜索和下载表情包

```javascript
// 1. 搜索 B站表情包
const searchResult = await emojiDebug.testSearchBilibili('鸽宝')
console.log('搜索结果:', searchResult.result)

// 2. 获取第一个装扮的 ID
const suitId = searchResult.result.suits[0].id
const suitType = searchResult.result.suits[0].type

// 3. 下载装扮
const downloadResult = await emojiDebug.testDownload(suitId, suitType)
console.log('下载结果:', downloadResult.result)

// 4. 重新扫描
const scanResult = await emojiDebug.testScan()
console.log('新增表情包:', scanResult.result.added)
```

### 示例 2: 搜索本地表情包

```javascript
// 搜索开心的表情包
const result = await emojiDebug.testSearchLocal('开心', 10)

// 查看结果
console.log('找到表情包:', result.result.count)
console.table(result.result.emojis)
```

### 示例 3: 模拟 LLM 调用

```javascript
// 模拟 LLM 生成的工具调用
const llmResponse = `
好的，我来帮你搜索开心的表情包。

\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
\`\`\`
`

// 模拟执行
const result = await debug.simulateLLMToolCall(llmResponse)
console.log('工具执行结果:', result)
```

### 示例 4: 直接调用工具

```javascript
// 方式 1: 使用 debug.callTool
await debug.callTool('search_local_emoji', {
  query: '开心',
  limit: 5
})

// 方式 2: 使用 debug.testToolCall（桌宠工具）
await debug.testToolCall('search_local_emoji', {
  query: '开心',
  limit: 5
})

// 方式 3: 使用 emojiDebug（专用工具）
await emojiDebug.testSearchLocal('开心', 5)
```

## 工具列表

### search_local_emoji
搜索本地已下载的表情包

```javascript
await debug.callTool('search_local_emoji', {
  query: '开心',    // 搜索关键词
  limit: 10        // 返回数量（可选）
})
```

### search_bilibili_emoji
搜索 B站表情包装扮

```javascript
await debug.callTool('search_bilibili_emoji', {
  keyword: '鸽宝'  // 搜索关键词
})
```

### download_emoji_suit
下载 B站表情包装扮

```javascript
await debug.callTool('download_emoji_suit', {
  suitId: 114156001,      // 装扮 ID
  suitType: 'normal',     // 装扮类型：normal 或 dlc
  lotteryId: undefined    // 抽奖 ID（dlc 类型需要）
})
```

### send_emoji
在下一条消息中附带表情包

```javascript
await debug.callTool('send_emoji', {
  emojiName: '开心'  // 表情包名称
})
```

### random_emoji
获取随机表情包

```javascript
await debug.callTool('random_emoji', {
  category: '鸽宝'  // 指定分类（可选）
})
```

### list_emoji_categories
列出所有表情包分类

```javascript
await debug.callTool('list_emoji_categories', {})
```

### rescan_emojis
重新扫描表情包目录

```javascript
await debug.callTool('rescan_emojis', {})
```

## 常见问题

### Q: 找不到 debug 或 emojiDebug？
A: 确保插件系统已初始化。刷新页面后等待几秒钟。

### Q: 工具调用失败？
A: 检查参数是否正确，查看 `result.error` 获取错误信息。

### Q: 表情包目录在哪里？
A: 在 `AppData/emojis/` 目录下，按分类组织。

### Q: 如何查看详细日志？
A: 打开控制台的 Verbose 级别，查看 `[Plugin bilibili-emoji]` 开头的日志。

## 调试技巧

### 1. 查看工具调用历史

```javascript
// 查看最近 10 次调用
debug.getToolHistory(10)

// 查看统计信息
debug.getToolStats()
```

### 2. 测试工具链

```javascript
// 搜索 -> 下载 -> 扫描 -> 搜索本地
async function testWorkflow() {
  // 1. 搜索 B站
  const search = await emojiDebug.testSearchBilibili('鸽宝')
  
  // 2. 下载第一个
  const suit = search.result.suits[0]
  await emojiDebug.testDownload(suit.id, suit.type)
  
  // 3. 重新扫描
  await emojiDebug.testScan()
  
  // 4. 搜索本地
  await emojiDebug.testSearchLocal('鸽宝')
}

await testWorkflow()
```

### 3. 性能测试

```javascript
// 测试扫描性能
console.time('scan')
await emojiDebug.testScan()
console.timeEnd('scan')

// 测试搜索性能
console.time('search')
await emojiDebug.testSearchLocal('开心', 100)
console.timeEnd('search')
```

### 4. 批量测试

```javascript
// 批量搜索
const keywords = ['开心', '哭', '笑', '生气', '惊讶']
for (const keyword of keywords) {
  const result = await emojiDebug.testSearchLocal(keyword, 3)
  console.log(`${keyword}: ${result.result.count} 个结果`)
}
```

## 高级用法

### 访问插件内部状态

```javascript
// 获取插件加载器
const loader = window.__pluginLoader

// 获取工具管理器
const toolMgr = window.__petToolManager

// 获取插件上下文（需要插件暴露）
// 注意：这需要插件自己实现
```

### 监听插件事件

```javascript
// 监听表情包准备事件
window.__pluginLoader.getEventBus().on('emoji:prepared', (data) => {
  console.log('表情包已准备:', data)
})
```

### 调用 RPC 方法

```javascript
// 调用插件的 RPC 方法
const result = await window.__pluginLoader
  .getPluginContext('bilibili-emoji')
  ?.callRPC('bilibili-emoji', 'searchEmoji', '开心', 5)
```

## 总结

使用调试工具可以：

✅ 快速测试插件功能
✅ 验证工具调用
✅ 模拟 LLM 交互
✅ 排查问题
✅ 性能分析

记住两个主要命令：
- `debug.help()` - 通用调试工具
- `emojiDebug.help()` - bilibili-emoji 专用工具

祝调试愉快！🎉
