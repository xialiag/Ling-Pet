# B站表情包插件 - 快速开始

## 5分钟快速上手

### 1️⃣ 下载表情包（2分钟）

```bash
# 进入下载器目录
cd BilibiliSuitDownload

# 运行下载器
./BilibiliSuitDownload_v0.4.0_alpha_fix1.exe

# 选择模式2（搜索）
2

# 输入关键词，例如：清凉豹豹
清凉豹豹

# 选择装扮并下载
```

表情包会保存到 `BilibiliSuitDownload/data/suit/` 目录。

### 2️⃣ 扫描表情包（30秒）

```bash
# 进入插件目录
cd pluginLoader/plugins/bilibili-emoji

# 扫描表情包
npm run scan
```

输出示例：
```
🔍 扫描表情包...
✅ 扫描完成
📊 找到 156 个表情包
📁 5 个分类:
   - 清凉豹豹
   - 雪狐桑
   - 眠眠兔
   - 青青
   - 小猫女仆
```

### 3️⃣ 测试搜索（30秒）

```bash
# 搜索表情包
npm run search 开心
```

输出示例：
```
🔍 搜索: 开心
✅ 找到 8 个结果:
1. 开心 (static) - 清凉豹豹
   D:\repos\Ling-Pet-Exp\BilibiliSuitDownload\data\suit\清凉豹豹\emoji_package\开心.png
2. 超开心 (gif) - 雪狐桑
   ...
```

### 4️⃣ 启用插件（1分钟）

在主程序的插件配置中添加：

```typescript
// src/main.ts 或 src/plugins.ts
import { registerBilibiliEmojiPlugin } from './pluginLoader/plugins/bilibili-emoji/register'

// 启动时注册插件
await registerBilibiliEmojiPlugin()
```

或者在配置文件中启用：

```json
// .kiro/settings/plugins.json
{
  "enabled": [
    "llm-service",
    "bilibili-emoji"
  ]
}
```

### 5️⃣ 开始使用（1分钟）

#### LLM自动使用

```
用户: 今天心情真好！

LLM内部:
1. search_emoji("开心")
2. send_emoji("开心")
3. 回复: "我也很开心呢！"

用户看到: "我也很开心呢！" + [开心表情包]
```

#### 配置LLM系统提示词

```typescript
const systemPrompt = `你是一个可爱的桌宠，可以使用表情包。

使用方法：
1. 用 search_emoji 搜索表情包
2. 用 send_emoji 发送表情包
3. 继续你的回复

表情包会自动显示在你的回复中。`
```

#### 在代码中使用

```typescript
// 1. 搜索表情包
const result = await context.callTool('search_emoji', {
  query: '开心',
  limit: 5
})

// 2. 发送表情包（使用名称）
if (result.success && result.result.emojis.length > 0) {
  await context.callTool('send_emoji', {
    emojiName: result.result.emojis[0].name
  })
}

// 3. 发送消息（表情包会自动附加）
await sendMessage('我也很开心呢！')
```

## 常用命令

```bash
# 扫描表情包
npm run scan

# 搜索表情包
npm run search <关键词>

# 列出所有分类
npm run categories

# 测试插件
npm run test
```

## 目录结构

```
BilibiliSuitDownload/data/
└── suit/
    ├── 清凉豹豹/
    │   └── emoji_package/
    │       ├── 开心.png
    │       ├── 难过.png
    │       ├── 生气.gif
    │       └── ...
    ├── 雪狐桑/
    │   └── emoji_package/
    │       └── ...
    └── ...
```

## 配置选项

编辑 `package.json` 中的 `pluginConfig`：

```json
{
  "pluginConfig": {
    "dataPath": "BilibiliSuitDownload/data",
    "enableAutoScan": true,
    "maxCacheSize": 10000,
    "supportedFormats": [".png", ".jpg", ".jpeg", ".gif", ".webp"]
  }
}
```

## 故障排除

### 找不到表情包？

1. 检查数据目录是否存在
2. 运行 `npm run scan` 查看扫描结果
3. 确认表情包在正确的目录结构中

### 搜索不到结果？

1. 尝试不同的关键词
2. 运行 `npm run categories` 查看所有分类
3. 检查文件名是否包含关键词

### 插件加载失败？

1. 检查依赖插件（llm-service）是否已加载
2. 查看控制台错误信息
3. 确认配置文件格式正确

## 下一步

- 📖 阅读 [完整文档](./README.md)
- 🔧 查看 [集成指南](./INTEGRATION.md)
- 💡 查看 [使用示例](./examples/pet-integration.ts)
- 🐛 [报告问题](https://github.com/your-repo/issues)

## 提示

💡 **推荐表情包**：清凉豹豹、雪狐桑、眠眠兔等都有丰富的表情包

💡 **批量下载**：使用 BilibiliSuitDownloader 可以一次下载整个装扮的所有资源

💡 **自定义关键词**：编辑 `example-config.json` 添加自定义情感关键词映射

💡 **性能优化**：如果表情包很多，可以设置 `enableAutoScan: false`，手动触发扫描

## 支持

如有问题，请：
1. 查看 [FAQ](./README.md#常见问题)
2. 搜索 [已知问题](https://github.com/your-repo/issues)
3. 提交 [新问题](https://github.com/your-repo/issues/new)

---

🎉 **享受使用表情包的乐趣吧！**
