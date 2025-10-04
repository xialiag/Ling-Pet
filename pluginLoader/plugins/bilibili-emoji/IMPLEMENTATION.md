# B站表情包插件 - 完整实现

## 概述

这是一个功能完整的 B站表情包插件，可以搜索、下载和管理 B站装扮中的表情包。

## 架构

### 前端 (TypeScript)
- `index.ts` - 插件主逻辑
  - 注册 LLM 工具
  - 注册设置页面操作
  - 管理表情包缓存

### 后端 (Rust)
- `src-tauri/src/bilibili_emoji.rs` - Tauri 命令实现
  - `plugin_bilibili_emoji_scan` - 扫描本地表情包
  - `plugin_bilibili_emoji_search` - 搜索 B站装扮
  - `plugin_bilibili_emoji_download` - 下载装扮

## 功能特性

### 1. 本地表情包扫描
- 自动扫描 `AppData/emojis` 目录
- 支持 PNG, JPG, GIF, WEBP 格式
- 按目录自动分类
- 区分静态图和动图

### 2. B站装扮搜索
- 通过关键词搜索装扮
- 支持普通装扮和收藏集
- 返回装扮 ID、名称、类型

### 3. 装扮下载
- 下载普通装扮的所有资源
- 自动创建分类目录
- 并发下载提高速度
- 自动清理文件名非法字符

### 4. LLM 工具集成
提供 7 个 LLM 工具：
- `search_local_emoji` - 搜索本地表情包
- `search_bilibili_emoji` - 搜索 B站装扮
- `download_emoji_suit` - 下载装扮
- `send_emoji` - 发送表情包
- `random_emoji` - 随机表情包
- `list_emoji_categories` - 列出分类
- `rescan_emojis` - 重新扫描

### 5. 设置页面集成
- 通过 `registerSettingsAction` API 注册"下载表情包"按钮
- 支持搜索和下载流程
- 显示加载状态

## API 调用流程

### 搜索装扮
```
用户输入关键词
  ↓
plugin_bilibili_emoji_search
  ↓
GET https://api.bilibili.com/x/garb/v2/mall/home/search?key_word={keyword}
  ↓
解析返回的装扮列表
  ↓
返回给前端显示
```

### 下载装扮
```
用户选择装扮
  ↓
plugin_bilibili_emoji_download
  ↓
GET https://api.bilibili.com/x/garb/mall/item/suit/v2?item_id={id}
  ↓
解析装扮资源列表
  ↓
并发下载所有资源
  ↓
保存到 AppData/emojis/{装扮名}/
  ↓
返回下载结果
```

## 数据结构

### EmojiInfo
```typescript
{
  name: string        // 表情包名称
  path: string        // 文件路径
  type: 'static' | 'gif'  // 类型
  category: string    // 分类
}
```

### SuitInfo
```typescript
{
  id: number          // 装扮ID
  name: string        // 装扮名称
  type: 'normal' | 'dlc'  // 类型
  lottery_id?: number // 卡池ID（收藏集）
}
```

### DownloadResult
```typescript
{
  success: boolean    // 是否成功
  count: number       // 下载数量
  category: string    // 分类名称
}
```

## 目录结构

```
AppData/
└── emojis/
    ├── 鸽宝/
    │   ├── 开心.png
    │   ├── 哭泣.gif
    │   └── ...
    ├── 清凉豹豹/
    │   └── ...
    └── ...
```

## 使用示例

### 在 LLM 对话中使用

**用户**: 帮我找个开心的表情包

**LLM**: 
```javascript
search_local_emoji("开心")
// 返回: { count: 5, emojis: [...] }
```

**用户**: 下载鸽宝表情包

**LLM**:
```javascript
search_bilibili_emoji("鸽宝")
// 返回: { suits: [{ id: 114156001, name: "鸽宝", type: "normal" }] }

download_emoji_suit(114156001, "normal")
// 返回: { success: true, count: 24, category: "鸽宝" }
```

### 在设置页面使用

1. 打开设置 → 插件管理
2. 找到 "bilibili-emoji" 插件
3. 点击 "下载表情包" 按钮
4. 输入关键词搜索
5. 选择要下载的装扮
6. 等待下载完成

## 技术细节

### 文件名清理
```rust
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}
```

### 并发下载
使用 `reqwest::Client` 复用连接，提高下载速度。

### 错误处理
所有 API 调用都有完整的错误处理，返回友好的错误信息。

## 限制和未来改进

### 当前限制
- ❌ 不支持 DLC 收藏集下载（API 较复杂）
- ❌ 不支持表情包预览
- ❌ 不支持表情包删除

### 未来改进
- ✅ 实现 DLC 收藏集下载
- ✅ 添加表情包预览功能
- ✅ 添加表情包管理界面
- ✅ 支持表情包导入/导出
- ✅ 添加下载进度显示

## 编译和打包

### 编译后端
```bash
cd pluginLoader/plugins/bilibili-emoji/backend
cargo build --release
```

### 打包插件
```bash
cd pluginLoader/tools
node packager.cjs bilibili-emoji
```

生成的插件包位于 `releases/plugins/bilibili-emoji-{version}-{platform}.zip`

## 测试

### 测试扫描
```typescript
const result = await context.invokeTauri('plugin_bilibili_emoji_scan')
console.log('扫描结果:', result)
```

### 测试搜索
```typescript
const result = await context.invokeTauri('plugin_bilibili_emoji_search', { 
  keyword: '鸽宝' 
})
console.log('搜索结果:', result)
```

### 测试下载
```typescript
const result = await context.invokeTauri('plugin_bilibili_emoji_download', {
  suitId: 114156001,
  suitType: 'normal'
})
console.log('下载结果:', result)
```

## 参考资料

- [BilibiliSuitDownload](https://github.com/boxie123/BilibiliSuitDownload) - Go 实现参考
- [B站装扮 API 文档](https://github.com/SocialSisterYi/bilibili-API-collect)
- [插件开发指南](../../docs/plugin-development-guide.md)
