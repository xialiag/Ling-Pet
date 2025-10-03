# 插件编译打包工具 - 快速入门

## 🎯 5 分钟上手

### 1. 安装依赖

```bash
npm install
```

这会安装以下工具：
- `esbuild` - 快速 JavaScript/TypeScript 编译器
- `archiver` - ZIP 打包工具
- `chokidar` - 文件监听工具
- `fs-extra` - 增强的文件系统操作

### 2. 编译单个插件

```bash
# 方式 1: 使用 npm script
npm run plugin:compile pluginLoader/plugins/bilibili-emoji

# 方式 2: 直接使用工具
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/bilibili-emoji
```

编译后的文件在 `dist/plugins/bilibili-emoji/`

### 3. 开发模式（推荐）

```bash
npm run plugin:build:watch pluginLoader/plugins/bilibili-emoji
```

这会：
- ✅ 监听文件变化
- ✅ 自动重新编译
- ✅ 不压缩代码（方便调试）
- ✅ 生成 source map

### 4. 编译所有插件

```bash
npm run plugin:build
```

### 5. 打包发布

```bash
# 编译并打包所有插件
npm run plugin:package

# 输出在 releases/plugins/ 目录
# - bilibili-emoji-1.0.0.zip
# - bilibili-emoji-1.0.0.json
```

## 📋 常用命令速查

| 命令 | 说明 |
|------|------|
| `npm run plugin:compile <path>` | 编译单个插件 |
| `npm run plugin:build` | 编译所有插件 |
| `npm run plugin:build:watch <path>` | 监听模式 |
| `npm run plugin:package` | 编译并打包 |
| `npm run plugin:clean` | 清理构建产物 |
| `npm run plugin:check` | 检查插件完整性 |
| `npm run plugin:release` | 准备发布 |

## 🔧 工具说明

### compiler.cjs - 编译工具

**功能：**
- TypeScript → JavaScript
- 代码打包（bundle）
- 代码压缩（minify）
- Rust 后端编译

**示例：**
```bash
# 基本编译
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin

# 不压缩（开发模式）
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --no-minify

# 监听模式
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --watch
```

### packager.cjs - 打包工具

**功能：**
- 创建 .zip 压缩包
- 生成 SHA256 校验和
- 生成元数据文件

**示例：**
```bash
# 打包已编译的插件
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin

# 自定义输出目录
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin --out-dir ./releases
```

### dev-watch.cjs - 开发监听

**功能：**
- 监听文件变化
- 自动重新编译
- 实时反馈

**示例：**
```bash
node pluginLoader/tools/dev-watch.cjs pluginLoader/plugins/my-plugin
```

### build-all.cjs - 批量构建

**功能：**
- 批量编译所有插件
- 可选自动打包
- 构建报告

**示例：**
```bash
# 编译所有
node pluginLoader/tools/build-all.cjs

# 编译并打包
node pluginLoader/tools/build-all.cjs --package

# 包含示例插件
node pluginLoader/tools/build-all.cjs --include-examples
```

### tasks.cjs - 任务运行器

**功能：**
- 清理构建产物
- 检查插件完整性
- 准备发布

**示例：**
```bash
# 清理
node pluginLoader/tools/tasks.cjs clean

# 检查
node pluginLoader/tools/tasks.cjs check

# 准备发布
node pluginLoader/tools/tasks.cjs release
```

## 🎨 开发工作流

### 日常开发

```bash
# 1. 启动监听模式
npm run plugin:build:watch pluginLoader/plugins/my-plugin

# 2. 修改代码
# 3. 自动重新编译
# 4. 在主应用中测试
npm run dev
```

### 发布新版本

```bash
# 1. 更新版本号
# 编辑 plugins/my-plugin/package.json

# 2. 准备发布
npm run plugin:release

# 3. 检查输出
ls releases/plugins/

# 4. 上传到服务器
```

## 🐛 常见问题

### Q: 编译失败怎么办？

```bash
# 1. 检查 TypeScript 错误
cd pluginLoader/plugins/my-plugin
npx tsc --noEmit

# 2. 查看详细错误
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --verbose
```

### Q: Rust 后端编译失败？

```bash
# 1. 检查 Rust 工具链
rustc --version
cargo --version

# 2. 手动编译
cd pluginLoader/plugins/my-plugin/backend
cargo build --release
```

### Q: 监听模式不工作？

```bash
# Linux: 增加文件监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 检查文件是否在忽略列表中
# node_modules/, target/, dist/ 会被忽略
```

### Q: 打包后的文件太大？

```bash
# 1. 检查是否包含了不必要的文件
unzip -l releases/plugins/my-plugin-1.0.0.zip

# 2. 使用外部依赖
# 在 compiler.js 中配置 external

# 3. 压缩资源文件
# 使用工具压缩图片、字体等
```

## 📚 下一步

- 阅读 [完整文档](./README.md)
- 查看 [插件开发指南](../docs/plugin-development-guide.md)
- 了解 [插件架构](../docs/plugin-architecture.md)

## 💡 提示

1. **开发时使用 `--no-minify`**
   - 代码更易读
   - 调试更方便
   - 编译更快

2. **发布前运行 `plugin:check`**
   - 验证插件完整性
   - 检查必需文件
   - 避免发布错误

3. **使用监听模式提高效率**
   - 自动编译
   - 即时反馈
   - 专注开发

4. **定期清理构建产物**
   ```bash
   npm run plugin:clean
   ```

5. **使用版本控制**
   - 遵循语义化版本
   - 记录变更日志
   - 打标签发布
