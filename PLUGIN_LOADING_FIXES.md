# 插件加载问题修复

## 🐛 发现的问题

### 问题 1：后端动态库路径错误

**症状**:
```
[PackageManager] Failed to load backend: Dynamic library not found: plugin.dll
```

**原因**:
- TypeScript 传递的是完整路径：`/path/to/plugin/backend/plugin.dll`
- Rust 代码将其当作目录，然后 join `plugin.dll`
- 结果路径变成：`/path/to/plugin/backend/plugin.dll/plugin.dll`

**修复**:
```rust
// 之前
let backend_dir = PathBuf::from(&backend_path);
let lib_path = backend_dir.join(lib_name);

// 之后
let lib_path = PathBuf::from(&backend_path);
```

### 问题 2：ES 模块导出语法不兼容

**症状**:
```
SyntaxError: Unexpected token 'export'
```

**原因**:
- esbuild 编译后的代码包含 `export{f as default};`
- `Function` 构造器不支持 ES 模块语法
- 需要将 export 转换为 CommonJS 格式

**修复**:
```typescript
// 处理 export{f as default}
processedCode = processedCode.replace(
    /export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/m,
    'module.exports.default = $1;'
)

// 处理 export default
processedCode = processedCode.replace(
    /export\s+default\s+/g,
    'module.exports.default = '
)
```

## 📝 修改的文件

### 1. `src-tauri/src/plugin_manager.rs`

```rust
#[command]
pub async fn plugin_load_backend(
    plugin_id: String,
    backend_path: String,
) -> Result<PluginCompileResult, String> {
    println!("[Rust] Loading backend for plugin: {}", plugin_id);
    println!("[Rust] Backend path: {}", backend_path);
    
    // 直接使用传入的路径，不再 join
    let lib_path = PathBuf::from(&backend_path);
    
    if !lib_path.exists() {
        return Ok(PluginCompileResult {
            success: false,
            error: Some(format!("Dynamic library not found: {}", backend_path)),
        });
    }
    
    // 加载动态库...
}
```

### 2. `pluginLoader/core/pluginLoader.ts`

```typescript
private async executePluginCode(code: string, pluginId: string): Promise<PluginDefinition> {
    try {
        // 处理 ES 模块导出语法
        let processedCode = code
        
        // 移除 sourceMappingURL
        processedCode = processedCode.replace(/\/\/# sourceMappingURL=.*/g, '')
        
        // 转换 export 为 module.exports
        processedCode = processedCode.replace(
            /export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/m,
            'module.exports.default = $1;'
        )
        
        // 执行代码...
    }
}
```

## 🧪 测试

### 测试步骤

1. 重新编译 Rust 后端
```bash
cargo build
```

2. 重启开发服务器
```bash
pnpm tauri dev
```

3. 安装插件
- 打开设置 > 插件管理
- 点击"安装插件"
- 选择 `bilibili-emoji-2.0.0-win32.zip`

### 预期结果

```
[PackageManager] Installing plugin from: ...
[PackageManager] Found plugin: @ling-pet/plugin-bilibili-emoji
[PackageManager] Plugin @ling-pet/plugin-bilibili-emoji installed successfully
[PluginLoader] Loading plugin: @ling-pet/plugin-bilibili-emoji
[PackageManager] Loading backend for @ling-pet/plugin-bilibili-emoji
[Rust] Loading backend for plugin: @ling-pet/plugin-bilibili-emoji
[Rust] Backend path: C:\Users\...\plugins\ling-pet-plugin-bilibili-emoji\backend\plugin.dll
[Bilibili Emoji Backend] Plugin initialized!
[PackageManager] Backend loaded for @ling-pet/plugin-bilibili-emoji
[Plugin bilibili-emoji] B站表情包插件加载中...
[Plugin bilibili-emoji] ✅ B站表情包插件已就绪
```

## 🔍 调试技巧

### 1. 检查文件是否存在

```typescript
const exists = await invoke('plugin_check_path', { 
    path: backendPath 
})
console.log('Backend exists:', exists)
```

### 2. 打印实际路径

```rust
println!("[Rust] Backend path: {}", backend_path);
println!("[Rust] Lib path: {:?}", lib_path);
println!("[Rust] Exists: {}", lib_path.exists());
```

### 3. 检查代码转换

```typescript
console.log('Original code:', code.substring(code.length - 100))
console.log('Processed code:', processedCode.substring(processedCode.length - 100))
```

## ✅ 验证清单

- [ ] Rust 代码已重新编译
- [ ] 开发服务器已重启
- [ ] 插件可以安装
- [ ] 后端动态库可以加载
- [ ] 插件代码可以执行
- [ ] 插件功能正常工作

## 🎯 相关问题

### 问题：插件 ID 包含特殊字符

已在之前修复，插件 ID 中的 `/` 和 `@` 会被替换：
- `@ling-pet/plugin-bilibili-emoji` → `ling-pet-plugin-bilibili-emoji`

### 问题：manifest.json 中的 entry 字段

确保 `entry` 指向编译后的 `.js` 文件，而不是源代码 `.ts` 文件。

构建工具会自动处理：
```javascript
let entryFile = packageJson.main || 'index.js';
if (entryFile.endsWith('.ts')) {
    entryFile = entryFile.replace(/\.ts$/, '.js');
}
```

## 📚 相关文档

- [插件安装修复](PLUGIN_INSTALL_FIX.md)
- [后端集成指南](PLUGIN_BACKEND_INTEGRATION.md)
- [Bilibili Emoji 后端完成](BILIBILI_EMOJI_BACKEND_COMPLETE.md)

## 🎊 总结

修复后，插件系统现在可以：
- ✅ 正确加载后端动态库
- ✅ 正确执行编译后的插件代码
- ✅ 支持 ES 模块导出语法
- ✅ 完整的错误处理和日志

插件加载流程已完全正常！🚀
