# B站表情包插件

为桌宠LLM提供B站表情包管理、下载和发送功能。

## 功能特性

### 1. 本地表情包管理
- ✅ 自动扫描本地表情包
- ✅ 按分类组织表情包
- ✅ 支持静态图片和GIF
- ✅ 快速搜索表情包

### 2. 在线下载
- ✅ 搜索B站表情包装扮
- ✅ 一键下载装扮到本地
- ✅ 支持普通装扮和DLC装扮
- ✅ 自动分类管理

### 3. LLM集成
- ✅ 为LLM提供表情包搜索工具
- ✅ 支持通过关键词查找表情包
- ✅ 支持发送表情包到聊天
- ✅ 支持随机表情包

### 4. 聊天集成
- ✅ Hook聊天组件显示表情包
- ✅ 自动注入表情包样式
- ✅ 支持表情包预览

## 安装

插件会自动安装到用户数据目录。表情包存储在：
```
<用户数据目录>/plugins/bilibili-emoji/data/emojis/
```

## 使用方法

### CLI 工具

```bash
# 扫描本地表情包
node cli.js scan

# 搜索B站装扮
node cli.js search-online 鸽宝

# 下载装扮
node cli.js download 114156001 normal

# 下载DLC装扮
node cli.js download 123456 dlc 789
```

### LLM 工具

插件为LLM提供以下工具：

#### 1. search_local_emoji
搜索本地已下载的表情包
```typescript
search_local_emoji("开心")
search_local_emoji("哭", 5)
```

#### 2. search_bilibili_emoji
在B站搜索表情包装扮
```typescript
search_bilibili_emoji("鸽宝")
search_bilibili_emoji("清凉豹豹")
```

#### 3. download_emoji_suit
下载表情包装扮到本地
```typescript
download_emoji_suit(114156001, "normal")
download_emoji_suit(123456, "dlc", 789)
```

#### 4. send_emoji
在下一条消息中附带表情包
```typescript
send_emoji("开心")
send_emoji("抱抱")
```

#### 5. random_emoji
获取随机表情包
```typescript
random_emoji()
random_emoji("鸽宝")
```

#### 6. list_emoji_categories
列出所有表情包分类
```typescript
list_emoji_categories()
```

#### 7. rescan_emojis
重新扫描表情包目录
```typescript
rescan_emojis()
```

## 使用示例

### 场景1：搜索并下载表情包

```
用户: 帮我找一些鸽宝的表情包
LLM: 
1. 调用 search_bilibili_emoji("鸽宝")
2. 显示搜索结果
3. 询问用户要下载哪个
4. 调用 download_emoji_suit(id, type)
5. 下载完成后调用 rescan_emojis()
```

### 场景2：发送表情包

```
用户: 发个开心的表情
LLM:
1. 调用 search_local_emoji("开心")
2. 选择合适的表情包
3. 调用 send_emoji("开心")
4. 回复消息（表情包会自动显示）
```

### 场景3：随机表情包

```
用户: 来个随机表情包
LLM:
1. 调用 random_emoji()
2. 调用 send_emoji(表情包名称)
3. 回复消息
```

## 数据结构

### 表情包信息
```typescript
interface EmojiInfo {
    name: string          // 表情包名称
    path: string          // 文件路径
    type: 'static' | 'gif' // 类型
    category: string      // 分类
    size?: number         // 文件大小
}
```

### 装扮搜索结果
```typescript
interface SuitSearchResult {
    id: number            // 装扮ID
    name: string          // 装扮名称
    type: 'normal' | 'dlc' // 装扮类型
    lotteryId?: number    // 抽奖ID（DLC需要）
}
```

## 目录结构

```
bilibili-emoji/
├── index.ts              # 插件主文件
├── cli.js                # CLI工具（下载功能）
├── package.json          # 插件配置
├── README.md             # 说明文档
└── data/                 # 数据目录（运行时创建）
    └── emojis/           # 表情包存储
        ├── 鸽宝/         # 分类1
        │   ├── 开心.png
        │   └── 哭泣.gif
        └── 清凉豹豹/     # 分类2
            └── ...
```

## 权限说明

插件需要以下权限：
- `storage:read` - 读取表情包文件
- `storage:write` - 保存下载的表情包
- `network:request` - 从B站下载表情包
- `command:execute` - 执行CLI命令
- `hook:component` - Hook聊天组件
- `hook:store` - Hook聊天Store

## 开发

### 编译
```bash
npm run plugin:compile pluginLoader/plugins/bilibili-emoji
```

### 监听模式
```bash
npm run plugin:build:watch pluginLoader/plugins/bilibili-emoji
```

### 测试
```bash
# 测试扫描
node cli.js scan

# 测试搜索
node cli.js search-online 鸽宝

# 测试下载（鸽宝装扮）
node cli.js download 114156001 normal
```

## 常见问题

### Q: 表情包存储在哪里？
A: 表情包存储在插件数据目录下的 `data/emojis/` 文件夹中。

### Q: 如何添加新的表情包？
A: 使用 `search_bilibili_emoji` 搜索，然后使用 `download_emoji_suit` 下载。

### Q: 下载失败怎么办？
A: 检查网络连接，确保可以访问 B站 API。

### Q: 如何更新表情包列表？
A: 调用 `rescan_emojis()` 工具重新扫描。

## 更新日志

### v3.0.0
- 🎉 **重大更新**：全量下载+智能提取架构
- ✅ 支持DLC装扮下载
- ✅ 全量下载所有装扮资源到临时目录
- ✅ 智能识别并提取表情包文件
- ✅ 自动过滤非表情包资源（背景、皮肤、UI组件等）
- ✅ 支持多种表情包结构（emoji_package、DLC表情包等）
- ✅ 完整的错误处理和日志
- ✅ 自动清理临时文件

### v2.0.1
- 🐛 修复下载问题：现在只下载表情包，不再下载装扮的背景和组件贴图
- ✅ 改进文件命名：去除表情包名称中的方括号
- ✅ 添加下载进度日志

### v2.0.0
- ✅ 重构为新的插件架构
- ✅ 添加在线搜索和下载功能
- ✅ 表情包存储在插件数据目录
- ✅ 改进CLI工具
- ✅ 添加更多LLM工具

### v1.0.0
- ✅ 初始版本
- ✅ 本地表情包扫描
- ✅ 基本搜索功能

## 许可证

MIT
