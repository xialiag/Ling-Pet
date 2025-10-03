# 自动构建功能完成

## ✅ 实现内容

已成功实现插件的自动构建功能，包括 Rust 后端的自动编译。

## 🚀 一键构建命令

### 构建所有插件
```bash
npm run plugin:release
```

### 构建指定插件
```bash
npm run plugin:release bilibili-emoji
npm run plugin:release example-native
```

### 构建多个插件
```bash
npm run plugin:release bilibili-emoji llm-service
```

## 🔧 自动处理的步骤

当你运行 `npm run plugin:release` 时，构建工具会自动：

### 1. TypeScript 编译
- ✅ 自动检测 `index.ts`
- ✅ 使用 esbuild 快速编译
- ✅ 打包依赖
- ✅ 生成 sourcemap

### 2. Rust 后端编译（如果存在）
- ✅ 自动检测 `backend/Cargo.toml`
- ✅ 运行 `cargo build --release`
- ✅ 复制编译后的动态库
  - Windows: `plugin.dll`
  - macOS: `libplugin.dylib`
  - Linux: `libplugin.so`

### 3. 资源文件处理
- ✅ 复制 README.md
- ✅ 复制 LICENSE
- ✅ 复制 assets/ 目录
- ✅ 复制 components/ 目录
- ✅ 复制其他资源

### 4. 元数据生成
- ✅ 从 package.json 生成 manifest.json
- ✅ 自动转换 .ts 入口为 .js
- ✅ 生成 package.json（清理开发依赖）

### 5. 打包
- ✅ 创建 .zip 文件
- ✅ 自动添加平台后缀（如果有后端）
- ✅ 生成 SHA256 校验和
- ✅ 创建元数据 .json 文件

## 📦 输出示例

### 纯前端插件
```
releases/plugins/
├── bilibili-emoji-2.0.0.zip       # 通用包，10.34 KB
├── bilibili-emoji-2.0.0.json      # 元数据
├── llm-service-1.0.0.zip          # 通用包，7.24 KB
└── llm-service-1.0.0.json         # 元数据
```

### 带 Rust 后端的插件
```
releases/plugins/
├── example-native-1.0.0-win32.zip    # Windows 专用，68.43 KB
└── example-native-1.0.0-win32.json   # 元数据
```

## 🎯 使用场景

### 场景 1：开发纯前端插件
```bash
# 创建插件
mkdir -p pluginLoader/plugins/my-plugin
cd pluginLoader/plugins/my-plugin

# 创建文件
cat > package.json << EOF
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.ts"
}
EOF

cat > index.ts << EOF
export default {
  name: '@ling-pet/plugin-my-plugin',
  version: '1.0.0',
  onLoad(context) {
    context.debug('Plugin loaded!');
  }
}
EOF

# 一键构建和打包
npm run plugin:release my-plugin
```

### 场景 2：开发带 Rust 后端的插件
```bash
# 创建插件结构
mkdir -p pluginLoader/plugins/my-native-plugin
cd pluginLoader/plugins/my-native-plugin

# 创建 package.json
cat > package.json << EOF
{
  "name": "@ling-pet/plugin-my-native-plugin",
  "version": "1.0.0",
  "main": "index.ts",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll"
  }
}
EOF

# 创建 Rust 后端
mkdir backend
cd backend
cargo init --lib
# 编辑 Cargo.toml 和 src/lib.rs

# 一键构建和打包（自动编译 Rust）
npm run plugin:release my-native-plugin
```

## 📊 构建统计

运行 `npm run plugin:release` 后，会显示构建总结：

```
============================================================
📊 构建总结
============================================================
总计: 2
✅ 成功: 2
❌ 失败: 0

成功的插件:
  ✓ bilibili-emoji
  ✓ llm-service
```

## 🔍 构建选项

### 包含示例插件
```bash
npm run plugin:release -- --include-examples
```

### 不压缩代码（调试）
```bash
npm run plugin:release -- --no-minify
```

### 不生成 sourcemap
```bash
npm run plugin:release -- --no-sourcemap
```

### 自定义输出目录
```bash
npm run plugin:release -- --out-dir ./my-releases
```

## 🛠️ 新增的工具

### 1. `build-and-package.cjs`
一键构建和打包工具，整合了编译和打包流程。

**功能**：
- 自动编译 TypeScript
- 自动编译 Rust 后端
- 自动打包成 .zip
- 生成元数据

**使用**：
```bash
node pluginLoader/tools/build-and-package.cjs <plugin-name>
```

### 2. 改进的 `compiler.cjs`
增强的编译工具，支持 Rust 后端。

**功能**：
- TypeScript/JavaScript 编译
- Rust 后端编译
- 资源文件复制
- package.json 生成

**使用**：
```bash
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/<plugin-name>
```

### 3. 改进的 `packager.cjs`
智能打包工具，自动检测后端。

**功能**：
- 自动检测 Rust 后端
- 添加平台后缀
- 生成 manifest.json
- 计算 SHA256 校验和

**使用**：
```bash
node pluginLoader/tools/packager.cjs dist/plugins/<plugin-name>
```

## 📚 相关文档

- [构建指南](pluginLoader/docs/BUILD_GUIDE.md) - 详细的构建说明
- [跨平台构建](pluginLoader/docs/CROSS_PLATFORM_BUILD.md) - 多平台构建指南
- [平台特定插件](PLATFORM_SPECIFIC_PLUGINS.md) - 平台特定包说明

## 🎉 优势

### 开发者体验
- ✅ **一键构建**：无需手动运行多个命令
- ✅ **自动检测**：自动识别插件类型和后端
- ✅ **快速编译**：使用 esbuild 快速编译 TypeScript
- ✅ **清晰输出**：友好的进度提示和错误信息

### 构建效率
- ✅ **并行处理**：TypeScript 和 Rust 编译可以优化
- ✅ **增量构建**：Rust 后续编译更快
- ✅ **智能缓存**：esbuild 自动缓存

### 质量保证
- ✅ **自动验证**：检查必需文件
- ✅ **校验和**：生成 SHA256 确保完整性
- ✅ **元数据**：完整的插件信息

## 🔄 工作流程

```
开发者编写代码
       ↓
运行 npm run plugin:release
       ↓
┌──────────────────────────┐
│  自动编译 TypeScript      │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  自动编译 Rust 后端       │ ← 如果存在
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  复制资源文件             │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  生成元数据               │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  打包成 .zip              │
└──────────┬───────────────┘
           ↓
    releases/plugins/
    └── plugin-1.0.0.zip
```

## 🚀 下一步

### 建议的改进

1. **CI/CD 集成**
   - 创建 GitHub Actions workflow
   - 自动在多平台上构建
   - 自动发布到 Release

2. **增量构建**
   - 只重新编译修改的文件
   - 缓存编译结果

3. **并行构建**
   - 同时构建多个插件
   - 提高构建速度

4. **构建缓存**
   - 缓存 Rust 编译产物
   - 缓存 node_modules

5. **构建报告**
   - 生成详细的构建报告
   - 包含编译时间、文件大小等

## 📝 总结

自动构建功能已完全实现，开发者现在可以：

1. ✅ 使用一个命令构建和打包插件
2. ✅ 自动编译 TypeScript 代码
3. ✅ 自动编译 Rust 后端（如果存在）
4. ✅ 自动生成平台特定的包
5. ✅ 自动生成元数据和校验和

**核心命令**：
```bash
npm run plugin:release [plugin-name]
```

这个命令会自动处理所有构建步骤，无需手动干预！🎉
