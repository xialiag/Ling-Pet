# B站表情包插件 v3.0 快速开始

## 🚀 5分钟快速测试

### 1. 编译插件（1分钟）

```bash
npm run plugin:compile pluginLoader/plugins/bilibili-emoji
```

### 2. 启动应用（1分钟）

启动你的桌宠应用，等待插件加载。

### 3. 打开控制台（10秒）

在应用中按 `F12` 打开浏览器开发者工具，切换到 Console 标签。

### 4. 测试下载（2-3分钟）

```javascript
// 下载雪狐桑生日纪念装扮（Normal类型）
await emojiDebug.testDownload(42484, 'normal')
```

### 5. 验证结果（30秒）

检查控制台输出，应该看到：
```
🔍 开始下载装扮 42484 (normal)...
📦 准备下载 56 个文件...
⬇️ 已下载 10/56
⬇️ 已下载 20/56
...
✅ 下载完成，开始扫描表情包...
🔍 扫描完成，找到 25 个表情包
✅ 成功
```

## ✅ 成功标志

如果看到以下内容，说明升级成功：

1. ✅ 下载进度显示（每10个文件显示一次）
2. ✅ 提取表情包数量（约25个）
3. ✅ 没有错误信息
4. ✅ 临时目录自动清理

## 📁 查看结果

打开应用数据目录：

**Windows:**
```
C:\Users\{用户名}\AppData\Roaming\com.lingpet.app\emojis\雪狐桑生日纪念\
```

应该看到约25个表情包文件，文件名类似：
- `雪狐桑生日纪念_开心.png`
- `雪狐桑生日纪念_委屈.png`
- `雪狐桑生日纪念_思考.png`

## 🎯 更多测试

### 测试DLC装扮
```javascript
await emojiDebug.testDownload(8249, 'dlc')
```

### 测试搜索
```javascript
await emojiDebug.testSearch('鸽宝')
```

### 查看帮助
```javascript
emojiDebug.help()
```

## 🐛 遇到问题？

### 问题1：编译失败
```bash
# 清理并重新安装依赖
npm install
npm run plugin:compile pluginLoader/plugins/bilibili-emoji
```

### 问题2：下载失败
- 检查网络连接
- 确认装扮ID正确
- 查看控制台错误信息

### 问题3：没有提取到表情包
- 检查该装扮是否真的包含表情包
- 查看控制台日志
- 检查临时目录是否有文件

## 📚 详细文档

- `BILIBILI_EMOJI_V3_TEST_GUIDE.md` - 完整测试指南
- `BILIBILI_EMOJI_V3_SUMMARY.md` - 升级总结
- `BILIBILI_EMOJI_V3_UPGRADE_GUIDE.md` - 升级指南

## 🎉 完成！

如果测试通过，恭喜你成功升级到 v3.0！

现在你可以：
- ✅ 下载Normal装扮
- ✅ 下载DLC装扮
- ✅ 智能提取表情包
- ✅ 自动过滤非表情包文件

---

**需要帮助？** 查看 `BILIBILI_EMOJI_V3_TEST_GUIDE.md` 获取详细测试说明。
