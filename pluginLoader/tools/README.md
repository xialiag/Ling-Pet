# 插件编译和打包工具

完整的插件开发工具链，支持 TypeScript/JavaScript 编译、Rust 后端构建和插件打包。

## 🚀 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 编译单个插件

```bash
# 使用 npm scripts
npm run plugin:compile pluginLoader/plugins/my-plugin

# 或直接使用工具
node pluginLoader/tools/compiler.js pluginLoader/plugins/my-plugin
```

### 编译所有插件

```bash
npm run plugin:build
```

### 开发模式（监听文件变化）

```bash
npm run plugin:build:watch pluginLoader/plugins/my-plugin
```

### 打包插件（生成 .zip）

```bash
# 编译并打包所有插件
npm run plugin:package

# 打包单个已编译的插件
node pluginLoader/tools/packager.js dist/plugins/my-plugin
```

## 📦 工具说明

### 1. compiler.cjs - 编译工具

基于 esbuild 的快速编译工具，支持：

- ✅ TypeScript/JavaScript 编译
- ✅ 代码打包（bundle）
- ✅ 代码压缩（minify）
- ✅ Source Map 生成
- ✅ Rust 后端编译
- ✅ 资源文件复制

**用法：**

```bash
node compiler.cjs <plugin-path> [options]

选项：
  --watch          监听模式，文件变化时自动重新编译
  --no-minify      不压缩代码（开发模式推荐）
  --no-sourcemap   不生成 sourcemap
  --out-dir <dir>  指定输出目录
  --verbose        显示详细信息
```

**示例：**

```bash
# 编译插件
node compiler.cjs ../plugins/bilibili-emoji

# 开发模式（不压缩，带 sourcemap）
node compiler.cjs ../plugins/bilibili-emoji --no-minify

# 自定义输出目录
node compiler.cjs ../plugins/bilibili-emoji --out-dir ./build
```

### 2. packager.cjs - 打包工具

将编译后的插件打包成 .zip 文件，用于分发和安装。

**功能：**

- ✅ 创建压缩包
- ✅ 生成 SHA256 校验和
- ✅ 生成元数据文件（.json）
- ✅ 验证插件完整性

**用法：**

```bash
node packager.cjs <plugin-dir> [options]

选项：
  --out-dir <dir>    指定输出目录（默认：releases/plugins）
  --include-source   包含源代码
```

**示例：**

```bash
# 打包插件
node packager.cjs dist/plugins/bilibili-emoji

# 自定义输出目录
node packager.cjs dist/plugins/bilibili-emoji --out-dir ./releases
```

**输出文件：**

```
releases/plugins/
├── bilibili-emoji-1.0.0.zip      # 插件压缩包
└── bilibili-emoji-1.0.0.json     # 元数据文件
```

**元数据格式：**

```json
{
  "name": "bilibili-emoji",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者",
  "file": "bilibili-emoji-1.0.0.zip",
  "size": 12345,
  "checksum": "sha256-hash",
  "algorithm": "sha256",
  "createdAt": "2025-03-10T12:00:00.000Z",
  "dependencies": {},
  "permissions": []
}
```

### 3. build-all.cjs - 批量构建工具

批量编译和打包所有插件。

**用法：**

```bash
node build-all.cjs [options]

选项：
  --package            编译后自动打包
  --include-examples   包含示例插件
  --no-minify          不压缩代码
  --no-sourcemap       不生成 sourcemap
```

**示例：**

```bash
# 编译所有插件
node build-all.cjs

# 编译并打包
node build-all.cjs --package

# 包含示例插件
node build-all.cjs --include-examples
```

### 4. dev-watch.cjs - 开发监听工具

监听插件文件变化，自动重新编译。

**用法：**

```bash
node dev-watch.cjs <plugin-path>
```

**示例：**

```bash
# 监听插件
node dev-watch.cjs ../plugins/bilibili-emoji

# 修改文件后会自动重新编译
```

**监听的文件类型：**

- `.ts`, `.js` - TypeScript/JavaScript 文件
- `.vue` - Vue 组件
- `.json` - 配置文件
- `.css`, `.scss` - 样式文件
- `Cargo.toml`, `.rs` - Rust 文件

**忽略的目录：**

- `node_modules/`
- `target/`
- `dist/`
- `.git/`

### 5. plugin-cli.js - 命令行工具

> 注意：plugin-cli.js 保持 .js 扩展名，因为它是独立的 CLI 工具

统一的插件管理 CLI。

**用法：**

```bash
node plugin-cli.js <command> [options]

命令：
  create <name>      创建新插件
  build [name]       构建插件
  validate <name>    验证插件
  list               列出所有插件
  test               测试插件加载器
  help               显示帮助信息
```

## 🔧 插件结构

### 编译前（源代码）

```
plugins/my-plugin/
├── package.json          # 插件配置
├── index.ts              # 入口文件
├── README.md             # 说明文档
├── assets/               # 资源文件
│   └── icon.png
├── components/           # Vue 组件
│   └── MyComponent.vue
├── backend/              # Rust 后端（可选）
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
└── tsconfig.json         # TypeScript 配置
```

### 编译后（dist）

```
dist/plugins/my-plugin/
├── package.json          # 清理后的配置
├── index.js              # 编译后的代码
├── index.js.map          # Source map
├── README.md
├── assets/
│   └── icon.png
├── components/
│   └── MyComponent.js
└── backend/              # 编译后的后端
    └── plugin.dll        # Windows
    └── libplugin.dylib   # macOS
    └── libplugin.so      # Linux
```

### 打包后（releases）

```
releases/plugins/
├── my-plugin-1.0.0.zip   # 压缩包
└── my-plugin-1.0.0.json  # 元数据
```

## 🎯 工作流程

### 开发流程

1. **创建插件**
   ```bash
   node plugin-cli.js create my-plugin
   ```

2. **开发插件**
   ```bash
   # 启动监听模式
   node dev-watch.js plugins/my-plugin
   
   # 修改代码，自动重新编译
   ```

3. **测试插件**
   ```bash
   # 在主应用中测试
   npm run dev
   ```

### 发布流程

1. **编译插件**
   ```bash
   node compiler.js plugins/my-plugin
   ```

2. **验证插件**
   ```bash
   node plugin-cli.js validate my-plugin
   ```

3. **打包插件**
   ```bash
   node packager.js dist/plugins/my-plugin
   ```

4. **发布**
   - 上传 `.zip` 文件到服务器
   - 上传 `.json` 元数据文件
   - 更新插件市场

### CI/CD 流程

```bash
# 批量构建和打包
npm run plugin:package

# 输出在 releases/plugins/ 目录
```

## ⚙️ 配置

### package.json 配置

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "main": "index.js",
  "type": "module",
  "author": "作者",
  "license": "MIT",
  "permissions": [
    "hook:component",
    "storage:read",
    "storage:write"
  ],
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Cargo.toml 配置（Rust 后端）

```toml
[package]
name = "plugin"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
# 你的依赖
```

## 🐛 故障排除

### 编译失败

**问题：** TypeScript 编译错误

**解决：**
```bash
# 检查 TypeScript 配置
cat tsconfig.json

# 手动编译查看详细错误
npx tsc --noEmit
```

**问题：** Rust 编译失败

**解决：**
```bash
# 检查 Rust 工具链
rustc --version
cargo --version

# 手动编译查看详细错误
cd backend
cargo build --release
```

### 打包失败

**问题：** 缺少必需文件

**解决：**
```bash
# 检查编译输出
ls -la dist/plugins/my-plugin/

# 确保有 package.json 和 index.js
```

**问题：** 权限错误

**解决：**
```bash
# Windows
icacls releases /grant Users:F

# Linux/macOS
chmod -R 755 releases/
```

### 监听模式问题

**问题：** 文件变化未触发重新编译

**解决：**
```bash
# 检查文件是否在忽略列表中
# 检查文件系统监听限制（Linux）
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 📚 最佳实践

1. **开发时使用监听模式**
   ```bash
   node dev-watch.js plugins/my-plugin
   ```

2. **发布前验证插件**
   ```bash
   node plugin-cli.js validate my-plugin
   ```

3. **使用语义化版本**
   - 主版本号：不兼容的 API 修改
   - 次版本号：向下兼容的功能性新增
   - 修订号：向下兼容的问题修正

4. **保持插件体积小**
   - 避免打包大型依赖
   - 使用外部依赖（external）
   - 压缩资源文件

5. **提供完整的文档**
   - README.md 说明功能和用法
   - 代码注释
   - 示例代码

## 🔗 相关文档

- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构](../docs/plugin-architecture.md)
- [API 文档](../types/api.ts)
