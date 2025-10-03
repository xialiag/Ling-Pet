# 插件编译打包工具 - 文档索引

## 📚 文档导航

### 🚀 快速开始
- **[QUICKSTART.md](./QUICKSTART.md)** - 5分钟快速上手
  - 安装依赖
  - 基本命令
  - 开发工作流

### 📖 完整文档
- **[README.md](./README.md)** - 完整使用文档
  - 工具详细说明
  - 配置选项
  - 插件结构
  - 故障排除
  - 最佳实践

### 💡 使用示例
- **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** - 实际使用场景
  - 10+ 实际场景示例
  - 高级用法
  - CI/CD 集成
  - 故障排除案例

### ⚡ 速查表
- **[CHEATSHEET.md](./CHEATSHEET.md)** - 命令速查
  - 常用命令
  - 快速参考
  - 常见问题

### ✅ 完成文档
- **[BUILD_TOOLS_COMPLETE.md](../BUILD_TOOLS_COMPLETE.md)** - 功能清单
  - 已完成功能
  - 技术特点
  - 性能指标

## 🔧 工具文件

### 核心工具
- **compiler.cjs** - 编译工具（TypeScript/JavaScript/Rust）
- **packager.cjs** - 打包工具（ZIP + 元数据）
- **build-all.cjs** - 批量构建工具
- **dev-watch.cjs** - 开发监听工具
- **tasks.cjs** - 任务运行器

### 辅助工具
- **plugin-cli.js** - 命令行工具
- **build-plugin.js** - 旧版构建工具（保留）
- **symbolScanner.ts** - 符号扫描器

## 📋 按需查找

### 我想...

#### 快速开始
→ [QUICKSTART.md](./QUICKSTART.md)

#### 了解所有功能
→ [README.md](./README.md)

#### 查看实际例子
→ [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)

#### 快速查命令
→ [CHEATSHEET.md](./CHEATSHEET.md)

#### 开发新插件
→ [QUICKSTART.md#开发新插件](./QUICKSTART.md)

#### 发布插件
→ [USAGE_EXAMPLES.md#场景3-准备发布插件](./USAGE_EXAMPLES.md)

#### 调试问题
→ [README.md#故障排除](./README.md)

#### 配置 CI/CD
→ [USAGE_EXAMPLES.md#场景5-cicd-自动化构建](./USAGE_EXAMPLES.md)

#### 开发 Rust 后端
→ [USAGE_EXAMPLES.md#场景7-开发-rust-后端插件](./USAGE_EXAMPLES.md)

## 🎯 学习路径

### 初学者
1. [QUICKSTART.md](./QUICKSTART.md) - 快速上手
2. [CHEATSHEET.md](./CHEATSHEET.md) - 记住常用命令
3. [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - 看实际例子

### 进阶用户
1. [README.md](./README.md) - 深入了解所有功能
2. [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - 高级用法
3. [BUILD_TOOLS_COMPLETE.md](../BUILD_TOOLS_COMPLETE.md) - 技术细节

### 团队管理者
1. [BUILD_TOOLS_COMPLETE.md](../BUILD_TOOLS_COMPLETE.md) - 功能清单
2. [USAGE_EXAMPLES.md#场景10-团队协作](./USAGE_EXAMPLES.md) - 团队协作
3. [USAGE_EXAMPLES.md#场景5-cicd-自动化构建](./USAGE_EXAMPLES.md) - CI/CD

## 📊 文档统计

| 文档 | 内容 | 适合 |
|------|------|------|
| QUICKSTART.md | 快速入门 | 新手 |
| README.md | 完整文档 | 所有人 |
| USAGE_EXAMPLES.md | 使用示例 | 实践者 |
| CHEATSHEET.md | 速查表 | 日常使用 |
| BUILD_TOOLS_COMPLETE.md | 功能清单 | 管理者 |

## 🔗 相关文档

### 插件系统
- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构](../docs/plugin-architecture.md)
- [插件系统概览](../docs/plugin-system-overview.md)

### API 文档
- [API 类型定义](../types/api.ts)
- [插件 API](../core/pluginApi.ts)

### 示例
- [示例插件](../plugins/example-plugin/)
- [完整示例](../plugins/demo-complete/)
- [B站表情插件](../plugins/bilibili-emoji/)

## 💬 获取帮助

### 命令行帮助
```bash
# CLI 工具帮助
node pluginLoader/tools/plugin-cli.js help

# 任务运行器帮助
node pluginLoader/tools/tasks.cjs help
```

### 查看文档
```bash
# 查看完整文档
cat pluginLoader/tools/README.md

# 查看快速入门
cat pluginLoader/tools/QUICKSTART.md

# 查看速查表
cat pluginLoader/tools/CHEATSHEET.md
```

## 🎉 开始使用

```bash
# 1. 查看快速入门
cat pluginLoader/tools/QUICKSTART.md

# 2. 创建你的第一个插件
node pluginLoader/tools/plugin-cli.js create my-first-plugin

# 3. 开始开发
npm run plugin:build:watch pluginLoader/plugins/my-first-plugin
```

---

**提示**: 建议从 [QUICKSTART.md](./QUICKSTART.md) 开始！
