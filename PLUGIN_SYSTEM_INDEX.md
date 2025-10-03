# 插件系统文档索引

## 🎯 从这里开始

如果你是第一次查看这个插件系统，请按以下顺序阅读：

### 1️⃣ [FINAL_ANSWER.md](FINAL_ANSWER.md) ⭐⭐⭐⭐⭐

**最重要的文档！直接回答你的所有问题。**

包含内容：
- ✅ 四个核心问题的完整解决方案
- ✅ 路径问题、热加载、编译注入、插件架构
- ✅ macOS 完全支持说明
- ✅ 快速开始指南
- ✅ 完整的文件清单

**阅读时间：15-20分钟**

---

### 2️⃣ [完整示例插件](pluginLoader/plugins/demo-complete/) ⭐⭐⭐⭐

**通过实际代码理解系统。**

包含内容：
- ✅ 展示所有功能的完整插件
- ✅ 路径管理、Hook、组件、后端、存储
- ✅ 可以直接运行和测试
- ✅ 详细的注释和说明

**阅读时间：10-15分钟**

---

### 3️⃣ [架构可视化](docs/plugin-architecture-visual.md) ⭐⭐⭐⭐

**通过图表直观理解系统架构。**

包含内容：
- ✅ 整体架构图
- ✅ 路径管理架构
- ✅ 热加载流程
- ✅ 编译注入流程
- ✅ 数据流图

**阅读时间：10分钟**

---

## 📚 深入学习

### 架构和设计

#### [完整架构设计](docs/plugin-loader-final-architecture.md) ⭐⭐⭐⭐

详细的技术方案和实现细节。

- 路径管理架构
- 热加载机制
- 编译后注入
- 插件架构设计
- 完整的代码示例

**阅读时间：30-40分钟**

#### [系统完整总结](PLUGIN_SYSTEM_COMPLETE.md) ⭐⭐⭐

系统概览和功能特性。

- 核心功能总结
- 目录结构
- 性能指标
- 安全机制

**阅读时间：15-20分钟**

---

### 开发指南

#### [构建和部署指南](pluginLoader/BUILD_AND_DEPLOY.md) ⭐⭐⭐

从开发到部署的完整流程。

- 开发环境设置
- 插件开发流程
- 构建流程
- 部署流程
- 跨平台构建
- 故障排查

**阅读时间：20-30分钟**

#### [快速参考](pluginLoader/QUICK_REFERENCE.md) ⭐⭐⭐

常用命令和 API 速查。

- 常用命令
- 插件结构模板
- API 速查表
- Rust 后端模板
- 故障排查

**阅读时间：5-10分钟（查询用）**

---

### 平台特定

#### [macOS 支持说明](pluginLoader/MACOS_SUPPORT.md) ⭐⭐

macOS 特定的配置和说明。

- 路径适配
- Rust 后端编译
- 通用二进制构建
- 代码签名和公证
- 故障排查

**阅读时间：15-20分钟**

---

## 🔧 实用工具

### CLI 工具

```bash
# 创建插件
node pluginLoader/tools/plugin-cli.js create <name>

# 构建插件
node pluginLoader/tools/plugin-cli.js build <name>

# 验证插件
node pluginLoader/tools/plugin-cli.js validate <name>

# 列出所有插件
node pluginLoader/tools/plugin-cli.js list
```

### 示例插件

| 插件 | 说明 | 位置 |
|------|------|------|
| demo-complete | 完整功能示例 | `pluginLoader/plugins/demo-complete/` |
| bilibili-emoji | B站表情插件 | `pluginLoader/plugins/bilibili-emoji/` |
| llm-service | LLM服务插件 | `pluginLoader/plugins/llm-service/` |

---

## 📖 按主题查找

### 我想了解...

#### 路径管理

- [FINAL_ANSWER.md - 问题1](FINAL_ANSWER.md#问题1路径问题)
- [完整架构设计 - 路径管理](docs/plugin-loader-final-architecture.md#1-路径管理架构问题1解决方案)
- [架构可视化 - 路径管理](docs/plugin-architecture-visual.md#路径管理架构)
- 实现：`pluginLoader/core/pathResolver.ts`

#### 热加载

- [FINAL_ANSWER.md - 问题2](FINAL_ANSWER.md#问题2热加载)
- [完整架构设计 - 热加载](docs/plugin-loader-final-architecture.md#2-热加载机制问题2解决方案)
- [架构可视化 - 热加载流程](docs/plugin-architecture-visual.md#热加载流程)
- 实现：`pluginLoader/core/hotReload.ts`

#### 编译和注入

- [FINAL_ANSWER.md - 问题3](FINAL_ANSWER.md#问题3编译后注入)
- [完整架构设计 - 编译注入](docs/plugin-loader-final-architecture.md#3-编译后注入机制问题3解决方案)
- [架构可视化 - 编译注入流程](docs/plugin-architecture-visual.md#编译和注入流程)
- 实现：`pluginLoader/tools/build-plugin.js`

#### 插件架构

- [FINAL_ANSWER.md - 问题4](FINAL_ANSWER.md#问题4插件架构设计)
- [完整架构设计 - 插件架构](docs/plugin-loader-final-architecture.md#4-插件架构设计问题4解决方案)
- [架构可视化 - 整体架构](docs/plugin-architecture-visual.md#整体架构)
- 示例：`pluginLoader/plugins/demo-complete/`

#### Hook 系统

- [FINAL_ANSWER.md - Hook系统](FINAL_ANSWER.md#43-hook系统修改执行逻辑)
- [快速参考 - Hook](pluginLoader/QUICK_REFERENCE.md#hook)
- [架构可视化 - Hook架构](docs/plugin-architecture-visual.md#hook系统架构)
- 实现：`pluginLoader/core/hookEngine.ts`

#### 组件注入

- [FINAL_ANSWER.md - 组件注入](FINAL_ANSWER.md#44-组件注入改变ui和外观)
- [快速参考 - 组件](pluginLoader/QUICK_REFERENCE.md#组件)
- [架构可视化 - 组件注入](docs/plugin-architecture-visual.md#组件注入架构)
- 实现：`pluginLoader/core/componentInjection.ts`

#### Rust 后端

- [FINAL_ANSWER.md - Rust后端](FINAL_ANSWER.md#45-rust后端交互)
- [快速参考 - Rust模板](pluginLoader/QUICK_REFERENCE.md#rust-后端模板)
- [架构可视化 - 后端交互](docs/plugin-architecture-visual.md#后端交互架构)
- 实现：`pluginLoader/core/backendLoader.ts`
- 示例：`pluginLoader/plugins/demo-complete/backend/`

#### macOS 支持

- [FINAL_ANSWER.md - macOS支持](FINAL_ANSWER.md#macos-完全支持)
- [macOS 支持说明](pluginLoader/MACOS_SUPPORT.md)
- 实现：`pluginLoader/core/pathResolver.ts`

---

## 🚀 快速开始

### 5分钟快速体验

```bash
# 1. 查看示例插件
cd pluginLoader/plugins/demo-complete
cat README.md

# 2. 构建示例
cd ../..
node tools/plugin-cli.js build demo-complete

# 3. 启动主程序（开发模式）
cd ../..
npm run dev

# 4. 查看日志，确认插件已加载
# 应该看到：[demo-complete] === 插件激活开始 ===
```

### 10分钟创建第一个插件

```bash
# 1. 创建插件
cd pluginLoader
node tools/plugin-cli.js create my-first-plugin

# 2. 编辑插件
cd plugins/my-first-plugin
# 编辑 index.ts

# 3. 开发模式（自动热加载）
cd ../../..
npm run dev

# 4. 修改代码，观察自动重载
```

---

## 📊 文档统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 核心文档 | 7 | 架构、设计、指南 |
| 示例插件 | 3 | 完整可运行的示例 |
| 核心模块 | 10+ | TypeScript 实现 |
| 工具脚本 | 3 | CLI、构建、扫描 |
| 总代码行数 | 5000+ | 包含注释和文档 |

---

## ❓ 常见问题

### Q: 我应该从哪里开始？

A: 从 [FINAL_ANSWER.md](FINAL_ANSWER.md) 开始，它直接回答了所有核心问题。

### Q: 我想快速上手，有示例吗？

A: 查看 [demo-complete 插件](pluginLoader/plugins/demo-complete/)，它展示了所有功能。

### Q: 我想了解架构设计？

A: 阅读 [完整架构设计](docs/plugin-loader-final-architecture.md) 和 [架构可视化](docs/plugin-architecture-visual.md)。

### Q: 我想开发插件，有指南吗？

A: 查看 [构建和部署指南](pluginLoader/BUILD_AND_DEPLOY.md) 和 [快速参考](pluginLoader/QUICK_REFERENCE.md)。

### Q: macOS 支持如何？

A: 完全支持！查看 [macOS 支持说明](pluginLoader/MACOS_SUPPORT.md)。

### Q: 遇到问题怎么办？

A: 查看各文档的"故障排查"部分，或查看 [快速参考](pluginLoader/QUICK_REFERENCE.md#故障排查)。

---

## 🎓 学习路径

### 初学者路径

1. [FINAL_ANSWER.md](FINAL_ANSWER.md) - 了解系统
2. [demo-complete](pluginLoader/plugins/demo-complete/) - 运行示例
3. [快速参考](pluginLoader/QUICK_REFERENCE.md) - 查询 API
4. 创建第一个插件

### 进阶路径

1. [完整架构设计](docs/plugin-loader-final-architecture.md) - 深入理解
2. [架构可视化](docs/plugin-architecture-visual.md) - 可视化理解
3. [构建和部署指南](pluginLoader/BUILD_AND_DEPLOY.md) - 生产部署
4. 开发复杂插件

### 专家路径

1. 阅读所有核心模块源码
2. 理解 FFI 和后端集成
3. 优化性能和安全
4. 贡献代码和文档

---

## 📝 文档更新

最后更新：2025-10-03

所有文档都是最新的，反映了当前的实现状态。

---

## 🤝 贡献

欢迎贡献文档和代码！

- 发现错误？提交 Issue
- 有改进建议？提交 PR
- 有问题？查看文档或提问

---

**开始你的插件开发之旅吧！** 🚀

从 [FINAL_ANSWER.md](FINAL_ANSWER.md) 开始，15分钟内你就能理解整个系统！

