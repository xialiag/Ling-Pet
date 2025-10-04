# 表情包文件修复测试指南

## 🚀 快速测试（5分钟）

### 1. 编译Rust后端（2分钟）

```bash
cd src-tauri
cargo build
cd ..
```

### 2. 启动应用（1分钟）

启动你的应用，等待加载完成。

### 3. 测试下载（2分钟）

打开浏览器控制台（F12），运行：

```javascript
// 下载雪狐桑生日纪念装扮
await emojiDebug.testDownload(42484, 'normal')
```

### 4. 验证结果（30秒）

#### 检查日志
应该看到：
```
✅ 下载完成，开始扫描表情包...
📁 已提取 5 个表情包
📁 已提取 10 个表情包
...
🔍 扫描完成，找到 25 个表情包
🗑️ 清理临时目录...
✓ 临时目录已清理
```

#### 检查文件
打开目录：
```
Windows: C:\Users\{用户名}\AppData\Roaming\com.lingpet.app\emojis\雪狐桑生日纪念\
macOS: ~/Library/Application Support/com.lingpet.app/emojis/雪狐桑生日纪念/
Linux: ~/.local/share/com.lingpet.app/emojis/雪狐桑生日纪念/
```

#### 验证文件
1. ✅ 约25个PNG文件
2. ✅ 文件可以正常打开
3. ✅ 图片显示正常
4. ✅ 文件大小合理（不是0字节）

#### 验证清理
1. ✅ temp目录不存在或为空
2. ✅ 没有残留文件

## ✅ 成功标志

如果看到以下情况，说明修复成功：

1. ✅ 图片文件可以用图片查看器打开
2. ✅ 图片显示正常，没有损坏
3. ✅ temp目录被清理
4. ✅ 日志显示"临时目录已清理"

## ❌ 失败标志

如果遇到以下情况，说明有问题：

1. ❌ 图片文件无法打开
2. ❌ 文件大小为0或异常小
3. ❌ temp目录仍然存在
4. ❌ 控制台显示错误

## 🐛 问题排查

### 问题1：Rust编译失败

```bash
# 检查Rust版本
rustc --version

# 更新Rust
rustup update

# 清理并重新编译
cd src-tauri
cargo clean
cargo build
```

### 问题2：图片仍然损坏

检查：
1. Rust是否重新编译
2. 应用是否重启
3. Tauri命令是否注册

### 问题3：temp目录未清理

检查：
1. 文件系统权限
2. 控制台错误日志
3. temp目录路径是否正确

## 📝 详细测试

### 测试不同装扮

```javascript
// Normal装扮
await emojiDebug.testDownload(42484, 'normal')

// DLC装扮（如果支持）
await emojiDebug.testDownload(8249, 'dlc')
```

### 验证文件完整性

```javascript
// 在控制台运行
const fs = require('fs')
const path = 'C:\\Users\\{用户名}\\AppData\\Roaming\\com.lingpet.app\\emojis\\雪狐桑生日纪念\\雪狐桑生日纪念_开心.png'

// 检查文件大小
const stats = fs.statSync(path)
console.log('文件大小:', stats.size, '字节')

// 文件大小应该 > 1000 字节
```

## 📊 测试清单

- [ ] Rust编译成功
- [ ] 应用启动正常
- [ ] 下载命令执行成功
- [ ] 日志显示正常
- [ ] 表情包文件存在
- [ ] 文件可以打开
- [ ] 图片显示正常
- [ ] 文件大小正常
- [ ] temp目录被清理
- [ ] 无错误日志

## 🎉 测试通过

如果所有测试都通过，恭喜！修复成功！

现在你可以：
- ✅ 正常下载表情包
- ✅ 文件完整无损
- ✅ 自动清理临时文件

## 📞 需要帮助？

查看详细文档：
- `EMOJI_FILE_FIX_REPORT.md` - 修复详情
- `BILIBILI_EMOJI_V3_TEST_GUIDE.md` - 完整测试指南

---

**测试版本**: v3.0.0
**最后更新**: 2025-10-04
