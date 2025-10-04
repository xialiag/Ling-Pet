# B站表情包插件 - 更新日志

## v2.0.0 (2025-03-10)

### 🎉 重大更新

完全重构插件，采用新的插件加载器架构。

### ✨ 新功能

1. **在线搜索和下载**
   - ✅ 搜索B站表情包装扮
   - ✅ 一键下载装扮到本地
   - ✅ 支持普通装扮和DLC装扮
   - ✅ 自动分类管理

2. **改进的存储**
   - ✅ 表情包存储在插件数据目录
   - ✅ 自动创建分类文件夹
   - ✅ 支持多种图片格式

3. **增强的LLM工具**
   - ✅ `search_local_emoji` - 搜索本地表情包
   - ✅ `search_bilibili_emoji` - 搜索B站装扮
   - ✅ `download_emoji_suit` - 下载装扮
   - ✅ `send_emoji` - 发送表情包
   - ✅ `random_emoji` - 随机表情包
   - ✅ `list_emoji_categories` - 列出分类
   - ✅ `rescan_emojis` - 重新扫描

4. **CLI工具增强**
   - ✅ `scan` - 扫描本地表情包
   - ✅ `search-online` - 搜索B站装扮
   - ✅ `download` - 下载装扮

### 🔧 技术改进

1. **架构升级**
   - 采用新的插件API
   - 使用 Tauri 命令进行文件操作
   - 改进的错误处理

2. **性能优化**
   - 异步扫描表情包
   - 缓存机制
   - 减少文件系统操作

3. **代码质量**
   - TypeScript 类型安全
   - 模块化设计
   - 完善的注释

### 📚 文档

- ✅ 完整的 README
- ✅ 详细的使用示例
- ✅ API 文档
- ✅ 更新日志

### 🔄 迁移指南

从 v1.0 升级到 v2.0：

1. **数据迁移**
   ```bash
   # 旧版本数据在 BilibiliSuitDownload/data
   # 新版本数据在 <用户数据目录>/plugins/bilibili-emoji/data/emojis
   # 需要手动复制或重新下载
   ```

2. **API 变更**
   - `search_emoji` → `search_local_emoji`
   - 新增 `search_bilibili_emoji`
   - 新增 `download_emoji_suit`

3. **配置变更**
   - 移除 `dataPath` 配置
   - 表情包自动存储在插件数据目录

### ⚠️ 破坏性变更

1. **数据路径变更**
   - 旧版本：`BilibiliSuitDownload/data`
   - 新版本：插件数据目录

2. **工具名称变更**
   - `search_emoji` → `search_local_emoji`

3. **CLI 命令变更**
   - `search` → `search-online`

---

## v1.0.0 (2024-XX-XX)

### ✨ 初始版本

- ✅ 本地表情包扫描
- ✅ 基本搜索功能
- ✅ LLM 工具集成
- ✅ 聊天组件 Hook
