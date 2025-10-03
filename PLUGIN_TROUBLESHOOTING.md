# 插件系统故障排查指南

## 常见问题

### 1. 插件安装失败

#### 症状
```
[PackageManager] Failed to install plugin
```

#### 可能原因
- manifest.json 不存在或格式错误
- 插件 ID 包含非法字符
- 目标目录权限不足

#### 解决方案
1. 检查 zip 文件内容：
```bash
tar -tzf plugin.zip
```

2. 验证 manifest.json：
```bash
tar -xOf plugin.zip manifest.json
```

3. 检查插件目录权限

### 2. 后端加载失败

#### 症状
```
Dynamic library not found: plugin.dll
系统找不到指定的路径 (os error 3)
```

#### 可能原因
- 动态库文件不存在
- 路径构建错误
- 文件权限问题
- 依赖库缺失

#### 解决方案

**步骤 1**: 检查文件是否存在
```powershell
$appData = [Environment]::GetFolderPath('ApplicationData')
Test-Path "$appData\com.lingpet.app\plugins\<plugin-dir>\backend\plugin.dll"
```

**步骤 2**: 检查路径
在浏览器控制台查看日志：
```
[PackageManager] Plugin path: ...
[PackageManager] Backend entry: ...
[PackageManager] Full backend path: ...
```

**步骤 3**: 检查依赖
```powershell
dumpbin /DEPENDENTS plugin.dll
```

**步骤 4**: 检查权限
确保应用有读取和执行权限

### 3. 插件代码执行失败

#### 症状
```
SyntaxError: Unexpected token 'export'
```

#### 原因
编译后的代码包含 ES 模块语法，但执行环境不支持

#### 解决方案
已在 `pluginLoader.ts` 中修复，自动转换 export 语句

### 4. 插件列表为空

#### 症状
```
已加载插件列表: Proxy(Array) {}
```

#### 可能原因
- 插件目录为空
- scanInstalledPlugins 失败
- manifest.json 解析失败

#### 解决方案

**步骤 1**: 检查插件目录
```powershell
$appData = [Environment]::GetFolderPath('ApplicationData')
Get-ChildItem "$appData\com.lingpet.app\plugins" -Recurse
```

**步骤 2**: 检查日志
查找 `[PackageManager] Found plugin:` 消息

**步骤 3**: 手动扫描
```typescript
const pluginLoader = (window as any).__pluginLoader
await pluginLoader.packageManager.scanInstalledPlugins()
```

### 5. 插件功能不工作

#### 症状
插件加载成功，但功能不响应

#### 可能原因
- Tauri 命令未实现
- 权限不足
- 后端函数调用失败

#### 解决方案

**步骤 1**: 检查 Tauri 命令
确保在 `main.rs` 中注册了所需命令

**步骤 2**: 检查权限
在 `capabilities/default.json` 中添加权限

**步骤 3**: 查看后端日志
Rust 后端的 `println!` 会输出到控制台

## 调试技巧

### 1. 启用详细日志

在浏览器控制台：
```javascript
localStorage.setItem('debug', 'plugin:*')
```

### 2. 检查全局对象

```javascript
// 检查插件加载器
console.log(window.__pluginLoader)

// 检查已加载的插件
console.log(window.__pluginLoader.getLoadedPlugins())

// 检查已安装的插件
console.log(window.__pluginLoader.packageManager.getInstalledPlugins())
```

### 3. 手动加载插件

```javascript
const pluginLoader = window.__pluginLoader
await pluginLoader.loadPlugin('@ling-pet/plugin-bilibili-emoji')
```

### 4. 检查后端状态

在 Rust 控制台查看：
```
[Rust] Loading backend for plugin: ...
[Rust] Backend path: ...
[Bilibili Emoji Backend] Plugin initialized!
```

### 5. 测试后端函数

```javascript
// 调用 Tauri 命令
const result = await invoke('plugin_bilibili_emoji_scan', {
    emojiDir: 'C:\\path\\to\\emojis'
})
console.log(result)
```

## 路径问题

### Windows 路径

Windows 使用反斜杠 `\`，但在 JavaScript 中需要转义：
```javascript
const path = 'C:\\Users\\...\\plugins'
```

或使用正斜杠（Tauri 会自动转换）：
```javascript
const path = 'C:/Users/.../plugins'
```

### 路径构建

使用 Tauri 的 `join` 函数：
```typescript
import { join } from '@tauri-apps/api/path'
const fullPath = await join(basePath, relativePath)
```

### 路径验证

使用 `exists` 检查：
```typescript
import { exists } from '@tauri-apps/plugin-fs'
const fileExists = await exists(path)
```

## 权限问题

### 检查权限配置

`src-tauri/capabilities/default.json`:
```json
{
  "permissions": [
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "store:default",
    "store:allow-load",
    "store:allow-save"
  ]
}
```

### 常见权限

- `fs:*` - 文件系统操作
- `store:*` - 数据存储
- `shell:*` - 执行命令
- `http:*` - 网络请求

## 性能问题

### 插件加载慢

**原因**:
- 大量文件扫描
- 后端编译慢
- 网络请求超时

**解决方案**:
- 使用缓存
- 异步加载
- 延迟初始化

### 内存泄漏

**原因**:
- 未释放事件监听器
- 未清理定时器
- 循环引用

**解决方案**:
- 在 `onUnload` 中清理资源
- 使用 WeakMap/WeakSet
- 定期检查内存使用

## 开发工具

### 1. 浏览器开发者工具

- Console: 查看日志
- Network: 检查请求
- Sources: 调试代码
- Performance: 性能分析

### 2. Rust 调试

```bash
# 启用调试日志
$env:RUST_LOG="debug"
pnpm tauri dev
```

### 3. 插件检查工具

```bash
# 检查插件结构
npm run plugin:check bilibili-emoji

# 验证插件包
tar -tzf plugin.zip
```

## 常用命令

### 清理插件

```powershell
# 删除所有插件
$appData = [Environment]::GetFolderPath('ApplicationData')
Remove-Item "$appData\com.lingpet.app\plugins\*" -Recurse -Force
```

### 重新安装插件

```bash
# 重新构建
npm run plugin:release bilibili-emoji

# 在应用中重新安装
```

### 查看日志

```bash
# Tauri 日志
pnpm tauri dev

# 浏览器控制台
F12 -> Console
```

## 获取帮助

### 1. 检查文档

- [插件开发指南](docs/plugin-development-guide.md)
- [后端集成指南](PLUGIN_BACKEND_INTEGRATION.md)
- [构建指南](pluginLoader/docs/BUILD_GUIDE.md)

### 2. 查看示例

- [Bilibili Emoji 插件](pluginLoader/plugins/bilibili-emoji/)
- [LLM Service 插件](pluginLoader/plugins/llm-service/)
- [Example Native 插件](pluginLoader/plugins/example-native/)

### 3. 常见错误代码

- `os error 2`: 文件不存在
- `os error 3`: 路径不存在
- `os error 5`: 权限被拒绝
- `os error 32`: 文件被占用

## 总结

大多数问题都与路径、权限或配置有关。按照以下步骤排查：

1. ✅ 检查文件是否存在
2. ✅ 验证路径是否正确
3. ✅ 确认权限配置
4. ✅ 查看详细日志
5. ✅ 测试单个功能

如果问题仍然存在，收集以下信息：
- 完整的错误消息
- 浏览器控制台日志
- Rust 控制台输出
- 插件目录结构
- manifest.json 内容
