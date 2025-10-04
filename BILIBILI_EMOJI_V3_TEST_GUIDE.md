# B站表情包插件 v3.0 测试指南

## 🧪 快速测试

### 1. 编译插件

```bash
# 编译插件
npm run plugin:compile pluginLoader/plugins/bilibili-emoji

# 或使用监听模式
npm run plugin:build:watch pluginLoader/plugins/bilibili-emoji
```

### 2. 启动应用

启动你的应用，确保插件已加载。

### 3. 打开浏览器控制台

在应用中打开浏览器开发者工具（F12），切换到Console标签。

### 4. 运行测试命令

#### 查看调试帮助
```javascript
emojiDebug.help()
```

#### 测试搜索功能
```javascript
// 搜索雪狐桑相关装扮
await emojiDebug.testSearch('雪狐桑')

// 搜索鸽宝相关装扮
await emojiDebug.testSearch('鸽宝')
```

#### 测试Normal装扮下载
```javascript
// 下载雪狐桑生日纪念装扮（ID: 42484）
await emojiDebug.testDownload(42484, 'normal')

// 预期结果：
// - 下载所有装扮资源到临时目录
// - 智能识别并提取约25个表情包
// - 自动清理临时目录
// - 表情包保存在 emojis/雪狐桑生日纪念/ 目录
```

#### 测试DLC装扮下载
```javascript
// 下载早凉·双镜溯游 DLC装扮（ID: 8249）
await emojiDebug.testDownload(8249, 'dlc')

// 预期结果：
// - 获取DLC基本信息和详细信息
// - 下载所有DLC资源
// - 提取DLC表情包
// - 保存到对应目录
```

## 📊 验证结果

### 1. 检查下载日志

在控制台中查看详细的下载日志：
```
🔍 开始下载装扮 42484 (normal)...
📦 准备下载 56 个文件...
⬇️ 已下载 10/56
⬇️ 已下载 20/56
...
✅ 下载完成，开始扫描表情包...
🔍 扫描完成，找到 25 个表情包
✅ 成功下载 25 个表情包到分类 雪狐桑生日纪念
```

### 2. 检查文件系统

打开应用数据目录，验证表情包文件：

**Windows:**
```
C:\Users\{用户名}\AppData\Roaming\com.lingpet.app\emojis\雪狐桑生日纪念\
```

**macOS:**
```
~/Library/Application Support/com.lingpet.app/emojis/雪狐桑生日纪念/
```

**Linux:**
```
~/.local/share/com.lingpet.app/emojis/雪狐桑生日纪念/
```

### 3. 验证表情包内容

确认目录中只包含表情包文件，没有以下文件：
- ❌ `act_*.png` - 活动图片
- ❌ `app_*.png` - 应用图片
- ❌ `*head_bg*` - 头部背景
- ❌ `*tail_icon*` - 底部图标
- ❌ `*space_bg*` - 空间背景
- ❌ `*loading*` - 加载动画

应该只有：
- ✅ `雪狐桑生日纪念_开心.png`
- ✅ `雪狐桑生日纪念_委屈.png`
- ✅ `雪狐桑生日纪念_思考.png`
- ✅ 等表情包文件

### 4. 测试LLM工具

在应用中测试LLM工具调用：

```javascript
// 搜索本地表情包
await petToolManager.callTool('search_local_emoji', ['开心'])

// 列出所有分类
await petToolManager.callTool('list_emoji_categories', [])

// 重新扫描
await petToolManager.callTool('rescan_emojis', [])
```

## 🐛 常见问题

### 问题1：下载失败
**症状**: 控制台显示"下载装扮失败"

**解决方案**:
1. 检查网络连接
2. 确认装扮ID正确
3. 检查装扮类型（normal/dlc）是否正确
4. 查看详细错误日志

### 问题2：没有提取到表情包
**症状**: 下载完成但提取数量为0

**解决方案**:
1. 检查该装扮是否真的包含表情包
2. 查看临时目录是否有文件（如果清理失败）
3. 检查表情包识别规则是否需要调整

### 问题3：提取了错误的文件
**症状**: emojis目录中包含非表情包文件

**解决方案**:
1. 检查 `isEmojiFile` 函数的排除规则
2. 添加新的排除模式
3. 报告问题以便改进识别规则

### 问题4：临时目录未清理
**症状**: temp目录中残留文件

**解决方案**:
1. 手动删除临时目录
2. 检查文件系统权限
3. 查看清理失败的错误日志

## 📈 性能测试

### 测试不同大小的装扮

#### 小型装扮（<20个文件）
```javascript
await emojiDebug.testDownload(42484, 'normal')
// 预期时间：10-30秒
```

#### 中型装扮（20-50个文件）
```javascript
await emojiDebug.testDownload(xxxxx, 'normal')
// 预期时间：30-60秒
```

#### 大型装扮（>50个文件）
```javascript
await emojiDebug.testDownload(xxxxx, 'dlc')
// 预期时间：60-120秒
```

## ✅ 测试清单

完成以下测试项目：

- [ ] 编译插件成功
- [ ] 插件加载成功
- [ ] 调试工具可用（emojiDebug.help()）
- [ ] 搜索功能正常
- [ ] Normal装扮下载成功
- [ ] DLC装扮下载成功
- [ ] 表情包提取准确（只有表情包）
- [ ] 临时目录自动清理
- [ ] 表情包扫描正常
- [ ] LLM工具调用正常
- [ ] 错误处理正常
- [ ] 日志输出清晰

## 🎯 测试用例

### 用例1：Normal装扮（雪狐桑生日纪念）
```javascript
await emojiDebug.testDownload(42484, 'normal')
```
**预期**:
- 下载约56个文件
- 提取约25个表情包
- 文件名格式：`雪狐桑生日纪念_*.png`

### 用例2：DLC装扮（早凉·双镜溯游）
```javascript
await emojiDebug.testDownload(8249, 'dlc')
```
**预期**:
- 获取DLC信息成功
- 下载DLC资源
- 提取DLC表情包

### 用例3：搜索功能
```javascript
await emojiDebug.testSearch('鸽宝')
```
**预期**:
- 返回搜索结果列表
- 包含装扮ID、名称、类型

### 用例4：错误处理
```javascript
// 测试无效ID
await emojiDebug.testDownload(99999999, 'normal')
```
**预期**:
- 显示清晰的错误信息
- 不会崩溃

## 📝 测试报告模板

```markdown
## 测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: [姓名]
**插件版本**: v3.0.0

### 测试环境
- 操作系统: [Windows/macOS/Linux]
- 浏览器: [Chrome/Firefox/Safari]
- 应用版本: [版本号]

### 测试结果

#### Normal装扮测试
- 装扮ID: 42484
- 装扮名称: 雪狐桑生日纪念
- 下载文件数: [数量]
- 提取表情包数: [数量]
- 结果: ✅ 通过 / ❌ 失败
- 备注: [问题描述]

#### DLC装扮测试
- 装扮ID: 8249
- 装扮名称: 早凉·双镜溯游
- 下载文件数: [数量]
- 提取表情包数: [数量]
- 结果: ✅ 通过 / ❌ 失败
- 备注: [问题描述]

#### 功能测试
- [ ] 搜索功能
- [ ] 下载功能
- [ ] 提取功能
- [ ] 清理功能
- [ ] 扫描功能
- [ ] LLM工具

### 发现的问题
1. [问题描述]
2. [问题描述]

### 改进建议
1. [建议内容]
2. [建议内容]
```

## 🚀 下一步

测试通过后：
1. 提交代码到版本控制
2. 更新文档
3. 发布新版本
4. 通知用户升级

---

**祝测试顺利！** 🎉
