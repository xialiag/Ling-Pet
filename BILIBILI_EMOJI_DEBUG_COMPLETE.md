# bilibili-emoji 插件 - 调试功能完成

## ✅ 完成内容

### 1. 通用调试控制台 (`pluginLoader/core/debugConsole.ts`)

提供完整的插件调试能力：

**插件管理**:
- `debug.listPlugins()` - 列出所有插件
- `debug.getPluginInfo(id)` - 获取插件信息
- `debug.loadPlugin(id)` - 加载插件
- `debug.unloadPlugin(id)` - 卸载插件
- `debug.reloadPlugin(id)` - 重新加载插件

**工具管理**:
- `debug.listTools()` - 列出所有工具
- `debug.getToolDetail(name)` - 获取工具详情
- `debug.callTool(name, args)` - 调用工具
- `debug.getToolHistory(limit)` - 获取调用历史
- `debug.getToolStats()` - 获取统计信息

**桌宠工具**:
- `debug.getPetToolPrompt()` - 获取工具提示词
- `debug.getPetToolList()` - 获取工具列表
- `debug.testToolCall(name, args)` - 测试工具调用
- `debug.simulateLLMToolCall(response)` - 模拟 LLM 调用

### 2. bilibili-emoji 专用调试工具 (`pluginLoader/plugins/bilibili-emoji/debug.ts`)

提供针对性的测试命令：

**基础测试**:
- `emojiDebug.testScan()` - 测试扫描表情包
- `emojiDebug.testSearchLocal(query, limit)` - 测试搜索本地
- `emojiDebug.testSearchBilibili(keyword)` - 测试搜索 B站
- `emojiDebug.testDownload(suitId, suitType)` - 测试下载
- `emojiDebug.testRandom(category)` - 测试随机表情包
- `emojiDebug.listCategories()` - 列出所有分类

**完整测试**:
- `emojiDebug.runFullTest()` - 运行完整测试流程
- `emojiDebug.testLLMCall()` - 测试 LLM 工具调用

### 3. 文档

- **完整指南**: `pluginLoader/plugins/bilibili-emoji/DEBUG_GUIDE.md`
- **速查表**: `pluginLoader/DEBUG_CHEATSHEET.md`

## 🎯 使用方法

### 快速开始

1. 打开浏览器控制台（F12）
2. 输入 `debug.help()` 查看通用命令
3. 输入 `emojiDebug.help()` 查看专用命令

### 基础测试

```javascript
// 扫描表情包
await emojiDebug.testScan()

// 搜索本地表情包
await emojiDebug.testSearchLocal('开心', 5)

// 搜索 B站表情包
await emojiDebug.testSearchBilibili('鸽宝')
```

### 完整测试流程

```javascript
// 运行所有测试
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

### 模拟 LLM 调用

```javascript
// 测试 LLM 工具调用流程
await emojiDebug.testLLMCall()
```

## 📊 功能特性

### 通用调试控制台

✅ **插件管理**: 加载/卸载/重新加载插件
✅ **工具管理**: 列出/调用/查看工具
✅ **历史记录**: 查看工具调用历史
✅ **统计信息**: 工具使用统计
✅ **LLM 集成**: 模拟 LLM 工具调用

### bilibili-emoji 专用工具

✅ **快速测试**: 一键测试各项功能
✅ **完整流程**: 自动化测试流程
✅ **LLM 模拟**: 测试 LLM 工具调用
✅ **详细输出**: 清晰的测试结果
✅ **错误处理**: 完整的错误信息

## 🔍 调试场景

### 场景 1: 测试插件功能

```javascript
// 1. 检查插件是否加载
debug.listPlugins()

// 2. 查看插件信息
debug.getPluginInfo('bilibili-emoji')

// 3. 测试扫描功能
await emojiDebug.testScan()

// 4. 测试搜索功能
await emojiDebug.testSearchLocal('开心')
```

### 场景 2: 测试下载流程

```javascript
// 1. 搜索 B站表情包
const result = await emojiDebug.testSearchBilibili('鸽宝')

// 2. 获取装扮信息
const suit = result.result.suits[0]
console.log('装扮:', suit.name, suit.id)

// 3. 下载装扮
await emojiDebug.testDownload(suit.id, suit.type)

// 4. 验证下载
await emojiDebug.testScan()
await emojiDebug.testSearchLocal('鸽宝')
```

### 场景 3: 测试 LLM 集成

```javascript
// 1. 查看工具提示词
debug.getPetToolPrompt()

// 2. 模拟 LLM 调用
const llmResponse = `
\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": { "query": "开心", "limit": 5 }
}
\`\`\`
`
await debug.simulateLLMToolCall(llmResponse)

// 3. 查看调用历史
debug.getToolHistory(5)
```

### 场景 4: 性能测试

```javascript
// 测试扫描性能
console.time('scan')
await emojiDebug.testScan()
console.timeEnd('scan')

// 测试搜索性能
console.time('search')
await emojiDebug.testSearchLocal('开心', 100)
console.timeEnd('search')

// 批量测试
const keywords = ['开心', '哭', '笑', '生气', '惊讶']
for (const keyword of keywords) {
  console.time(keyword)
  await emojiDebug.testSearchLocal(keyword, 10)
  console.timeEnd(keyword)
}
```

## 🛠️ 故障排除

### 问题 1: 找不到 debug 或 emojiDebug

**原因**: 插件系统未初始化或插件未加载

**解决**:
```javascript
// 检查插件加载器
console.log(window.__pluginLoader)

// 检查插件是否加载
debug.listPlugins()

// 重新加载插件
await debug.reloadPlugin('bilibili-emoji')
```

### 问题 2: 工具调用失败

**原因**: 参数错误或功能异常

**解决**:
```javascript
// 查看工具详情
debug.getToolDetail('search_local_emoji')

// 查看错误信息
const result = await debug.callTool('search_local_emoji', { query: '开心' })
console.log('错误:', result.error)

// 查看调用历史
debug.getToolHistory(5)
```

### 问题 3: 表情包扫描失败

**原因**: 目录不存在或权限问题

**解决**:
```javascript
// 检查表情包目录
const appDataDir = await window.__pluginLoader
  .getPluginContext('bilibili-emoji')
  ?.getAppDataDir()
console.log('表情包目录:', `${appDataDir}/emojis`)

// 重新扫描
await emojiDebug.testScan()
```

## 📚 相关文档

- [完整调试指南](pluginLoader/plugins/bilibili-emoji/DEBUG_GUIDE.md)
- [调试速查表](pluginLoader/DEBUG_CHEATSHEET.md)
- [插件文档](pluginLoader/plugins/bilibili-emoji/README.md)
- [实现文档](pluginLoader/plugins/bilibili-emoji/IMPLEMENTATION.md)

## 🎉 总结

现在 bilibili-emoji 插件具备完整的调试能力：

✅ **通用调试控制台** - 管理所有插件和工具
✅ **专用调试工具** - 针对性的测试命令
✅ **完整测试流程** - 自动化测试
✅ **LLM 模拟** - 测试 LLM 集成
✅ **详细文档** - 完整的使用指南
✅ **速查表** - 快速参考

在浏览器控制台输入 `debug.help()` 或 `emojiDebug.help()` 即可开始调试！🚀
