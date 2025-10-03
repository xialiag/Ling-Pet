# 插件安装问题修复

## 🐛 发现的问题

### 问题 1：pluginId 为 undefined
**症状**：
```
[PackageManager] Plugin undefined installed successfully
```

**原因**：
- Rust 结构体使用蛇形命名 `plugin_id`
- TypeScript 期望驼峰命名 `pluginId`
- serde 默认不转换命名风格

**修复**：
在 Rust 结构体上添加 `#[serde(rename_all = "camelCase")]`：
```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // ← 添加这行
pub struct PluginInstallResult {
    pub success: bool,
    pub plugin_id: String,
    pub error: Option<String>,
}
```

### 问题 2：插件 ID 包含 `/` 导致路径问题
**症状**：
- 插件 ID 为 `@ling-pet/plugin-bilibili-emoji`
- Windows 将 `/` 解释为路径分隔符
- 创建了嵌套目录：`@ling-pet/plugin-bilibili-emoji/`
- `scanInstalledPlugins` 无法找到插件

**原因**：
Rust 代码直接使用插件 ID 作为目录名，没有处理特殊字符。

**修复**：
将插件 ID 中的特殊字符替换为安全字符：
```rust
// 创建插件目录（将 / 替换为 - 以避免路径问题）
let safe_plugin_id = plugin_id.replace("/", "-").replace("@", "");
let plugin_dir = PathBuf::from(&target_dir).join(&safe_plugin_id);
```

现在插件会被安装到：`ling-pet-plugin-bilibili-emoji/`

### 问题 3：scanInstalledPlugins 只扫描一层目录
**症状**：
即使插件被安装到嵌套目录，也无法被发现。

**原因**：
`scanInstalledPlugins` 只扫描 `plugins/` 的直接子目录。

**修复**：
添加递归扫描功能：
```typescript
private async scanPluginDirectory(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 3) return  // 限制递归深度
    
    const entries = await readDir(dirPath)
    for (const entry of entries) {
        if (entry.isDirectory) {
            const pluginPath = await join(dirPath, entry.name)
            const manifestPath = await join(pluginPath, 'manifest.json')
            
            if (await exists(manifestPath)) {
                // 找到插件
            } else {
                // 继续递归扫描
                await this.scanPluginDirectory(pluginPath, depth + 1)
            }
        }
    }
}
```

## 📝 修改的文件

### 1. `src-tauri/src/plugin_manager.rs`
```rust
// 添加 serde 属性
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResult {
    pub success: bool,
    pub plugin_id: String,
    pub error: Option<String>,
}

// 处理插件 ID 中的特殊字符
let safe_plugin_id = plugin_id.replace("/", "-").replace("@", "");
let plugin_dir = PathBuf::from(&target_dir).join(&safe_plugin_id);
```

### 2. `pluginLoader/core/packageManager.ts`
```typescript
// 添加递归扫描方法
private async scanPluginDirectory(dirPath: string, depth: number = 0): Promise<void> {
    // 递归扫描插件目录，支持嵌套结构
}
```

## 🧪 测试步骤

### 1. 重新编译 Rust 后端
```bash
# 在项目根目录
cargo build
```

### 2. 清理旧的插件目录
```bash
# Windows
Remove-Item "$env:APPDATA\com.lingpet.app\plugins\*" -Recurse -Force

# macOS/Linux
rm -rf ~/Library/Application\ Support/com.lingpet.app/plugins/*
```

### 3. 重启应用
```bash
pnpm tauri dev
```

### 4. 安装插件
1. 打开设置 > 插件管理
2. 点击"安装插件"
3. 选择 `releases/plugins/bilibili-emoji-2.0.0.zip`
4. 查看控制台输出

### 预期结果
```
[PackageManager] Installing plugin from: ...
[Rust] Plugin @ling-pet/plugin-bilibili-emoji installed to ...
[PackageManager] Plugin @ling-pet/plugin-bilibili-emoji installed successfully
[PackageManager] Found plugin: @ling-pet/plugin-bilibili-emoji
```

插件应该出现在插件列表中。

## 📂 插件目录结构

### 修复前（错误）
```
plugins/
└── @ling-pet/
    └── plugin-bilibili-emoji/
        ├── manifest.json
        ├── index.js
        └── ...
```

### 修复后（正确）
```
plugins/
└── ling-pet-plugin-bilibili-emoji/
    ├── manifest.json
    ├── index.js
    └── ...
```

## 🎯 插件 ID 命名建议

为了避免路径问题，建议插件 ID 使用以下格式：

### ✅ 推荐
```json
{
  "id": "ling-pet-plugin-bilibili-emoji",
  "name": "Bilibili Emoji Plugin"
}
```

### ⚠️ 可以但需要处理
```json
{
  "id": "@ling-pet/plugin-bilibili-emoji",
  "name": "Bilibili Emoji Plugin"
}
```
会被转换为：`ling-pet-plugin-bilibili-emoji`

### ❌ 避免
```json
{
  "id": "plugin:bilibili:emoji",  // 包含 :
  "id": "plugin\\bilibili",       // 包含 \
  "id": "plugin<>emoji"           // 包含 < >
}
```

## 🔧 额外改进建议

### 1. 验证插件 ID
在打包时验证插件 ID 是否包含非法字符：
```javascript
const invalidChars = /[\/\\:*?"<>|]/g;
if (invalidChars.test(manifest.id)) {
    console.warn(`Plugin ID contains invalid characters: ${manifest.id}`);
}
```

### 2. 统一命名转换
在 `packager.cjs` 中添加 ID 清理函数：
```javascript
function sanitizePluginId(id) {
    return id
        .replace(/@/g, '')
        .replace(/\//g, '-')
        .replace(/[\\:*?"<>|]/g, '-')
        .toLowerCase();
}
```

### 3. 文档说明
在插件开发指南中说明：
- 插件 ID 的命名规范
- 哪些字符是安全的
- 如何避免路径问题

## ✅ 修复完成

修复后，插件安装流程应该正常工作：
1. ✅ Rust 正确返回 pluginId
2. ✅ 插件安装到正确的目录
3. ✅ scanInstalledPlugins 能找到插件
4. ✅ 插件出现在设置页面
5. ✅ 可以启用/禁用插件
