# 插件调试速查表

## 🚀 快速开始

打开浏览器控制台（F12），输入：

```javascript
debug.help()          // 查看通用调试命令
emojiDebug.help()     // 查看 bilibili-emoji 专用命令
```

## 📦 插件管理

```javascript
debug.listPlugins()                    // 列出所有插件
debug.getPluginInfo('plugin-id')       // 获取插件信息
await debug.loadPlugin('plugin-id')    // 加载插件
await debug.unloadPlugin('plugin-id')  // 卸载插件
await debug.reloadPlugin('plugin-id')  // 重新加载插件
```

## 🛠️ 工具管理

```javascript
debug.listTools()                      // 列出所有工具
debug.getToolDetail('tool-name')       // 获取工具详情
await debug.callTool('tool', {...})    // 调用工具
debug.getToolHistory(10)               // 获取调用历史
debug.getToolStats()                   // 获取统计信息
```

## 🤖 桌宠工具

```javascript
debug.getPetToolPrompt()               // 获取工具提示词
debug.getPetToolList()                 // 获取工具列表
await debug.testToolCall('tool', {})   // 测试工具调用
await debug.simulateLLMToolCall(resp)  // 模拟 LLM 调用
```

## 🎨 bilibili-emoji 专用

```javascript
// 基础测试
await emojiDebug.testScan()                          // 扫描表情包
await emojiDebug.testSearchLocal('开心', 5)          // 搜索本地
await emojiDebug.testSearchBilibili('鸽宝')          // 搜索 B站
await emojiDebug.testDownload(114156001, 'normal')   // 下载装扮
await emojiDebug.testRandom()                        // 随机表情包
await emojiDebug.listCategories()                    // 列出分类

// 完整测试
await emojiDebug.runFullTest()                       // 运行完整测试
await emojiDebug.testLLMCall()                       // 测试 LLM 调用
```

## 💡 常用示例

### 搜索和下载

```javascript
// 搜索 B站表情包
const result = await emojiDebug.testSearchBilibili('鸽宝')

// 下载第一个
const suit = result.result.suits[0]
await emojiDebug.testDownload(suit.id, suit.type)

// 重新扫描
await emojiDebug.testScan()
```

### 模拟 LLM 调用

```javascript
const llmResponse = `
\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": { "query": "开心", "limit": 5 }
}
\`\`\`
`

await debug.simulateLLMToolCall(llmResponse)
```

### 查看工具信息

```javascript
// 列出所有工具
debug.listTools()

// 查看特定工具
debug.getToolDetail('search_local_emoji')

// 查看调用历史
debug.getToolHistory(10)
```

## 🔍 调试技巧

```javascript
// 性能测试
console.time('test')
await emojiDebug.testScan()
console.timeEnd('test')

// 批量测试
for (const keyword of ['开心', '哭', '笑']) {
  await emojiDebug.testSearchLocal(keyword, 3)
}

// 查看统计
debug.getToolStats()
```

## 📚 更多信息

- 完整文档: `pluginLoader/plugins/bilibili-emoji/DEBUG_GUIDE.md`
- 插件文档: `pluginLoader/plugins/bilibili-emoji/README.md`
- 系统文档: `PLUGIN_DOCUMENTATION_INDEX.md`
