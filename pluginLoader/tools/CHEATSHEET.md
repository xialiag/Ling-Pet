# 插件工具速查表

## 🚀 常用命令

| 命令 | 说明 |
|------|------|
| `npm run plugin:compile <path>` | 编译单个插件 |
| `npm run plugin:build` | 编译所有插件 |
| `npm run plugin:build:watch <path>` | 监听模式（开发） |
| `npm run plugin:package` | 编译并打包所有 |
| `npm run plugin:clean` | 清理构建产物 |
| `npm run plugin:check` | 检查插件完整性 |
| `npm run plugin:release` | 准备发布 |

## 📝 快速开始

### 开发新插件
```bash
# 1. 创建
node pluginLoader/tools/plugin-cli.js create my-plugin

# 2. 开发（监听模式）
npm run plugin:build:watch pluginLoader/plugins/my-plugin

# 3. 测试
npm run dev
```

### 发布插件
```bash
# 1. 更新版本号（编辑 package.json）

# 2. 准备发布
npm run plugin:release

# 3. 上传
# releases/plugins/my-plugin-1.0.0.zip
```

## 🔧 直接使用工具

### 编译工具
```bash
# 基本编译
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin

# 开发模式（不压缩）
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --no-minify

# 监听模式
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --watch
```

### 打包工具
```bash
# 打包
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin

# 自定义输出
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin --out-dir ./releases
```

### 批量构建
```bash
# 编译所有
node pluginLoader/tools/build-all.cjs

# 编译并打包
node pluginLoader/tools/build-all.cjs --package

# 包含示例
node pluginLoader/tools/build-all.cjs --include-examples
```

### 任务运行器
```bash
# 清理
node pluginLoader/tools/tasks.cjs clean

# 检查
node pluginLoader/tools/tasks.cjs check

# 发布
node pluginLoader/tools/tasks.cjs release
```

## 📁 输出目录

```
dist/plugins/           # 编译后的插件
releases/plugins/       # 打包后的插件（.zip）
```

## 🎯 开发工作流

```
创建 → 开发 → 编译 → 测试 → 发布
  ↓      ↓      ↓      ↓      ↓
create  watch  build   dev  package
```

## 🐛 常见问题

### 编译失败
```bash
# 查看详细错误
node pluginLoader/tools/compiler.cjs <path> --verbose

# 检查 TypeScript
cd pluginLoader/plugins/my-plugin
npx tsc --noEmit
```

### Rust 编译失败
```bash
# 检查 Rust
rustc --version
cargo --version

# 手动编译
cd pluginLoader/plugins/my-plugin/backend
cargo build --release
```

### 监听不工作
```bash
# Linux: 增加监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 💡 提示

- ✅ 开发时用 `--no-minify`（代码可读）
- ✅ 发布前运行 `plugin:check`（验证完整性）
- ✅ 使用监听模式提高效率
- ✅ 定期清理构建产物
- ✅ 遵循语义化版本

## 📚 文档

- [完整文档](./README.md)
- [快速入门](./QUICKSTART.md)
- [使用示例](./USAGE_EXAMPLES.md)

## 🔗 相关

- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构](../docs/plugin-architecture.md)
- [API 文档](../types/api.ts)
