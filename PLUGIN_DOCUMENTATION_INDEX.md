# 插件系统文档索引

## 📖 快速导航

### 🚀 快速开始
- [5分钟快速开始](pluginLoader/docs/PET_TOOL_QUICKSTART.md) - 最快上手指南
- [插件系统概述](PLUGIN_SYSTEM_README.md) - 系统介绍
- [最终总结](PLUGIN_SYSTEM_FINAL_SUMMARY.md) - 完整功能总结

### 📚 核心文档

#### 桌宠工具系统 ⭐ (新增)
- [桌宠工具系统完整文档](pluginLoader/docs/PET_TOOL_SYSTEM.md) - 详细说明
- [桌宠工具快速开始](pluginLoader/docs/PET_TOOL_QUICKSTART.md) - 5分钟集成
- [实现总结](pluginLoader/PET_TOOL_SYSTEM_COMPLETE.md) - 技术细节

#### 插件开发
- [插件开发指南](docs/plugin-development-guide.md) - 完整开发流程
- [插件架构设计](docs/plugin-architecture.md) - 架构说明
- [API 类型定义](pluginLoader/types/api.ts) - TypeScript 类型

#### API 文档
- [设置页面 API](pluginLoader/docs/PLUGIN_SETTINGS_API.md) - 设置集成
- [通用 API 设计](pluginLoader/docs/PLUGIN_UNIVERSAL_API.md) - HTTP/文件系统
- [LLM 工具系统](docs/llm-tools-system.md) - 工具注册和调用

#### 后端开发
- [插件后端实现](docs/plugin-backend-implementation.md) - Rust 后端
- [跨平台构建](pluginLoader/docs/CROSS_PLATFORM_BUILD.md) - 编译指南
- [构建指南](pluginLoader/docs/BUILD_GUIDE.md) - 详细步骤

### 💡 示例代码

#### 完整示例
- [桌宠工具集成](pluginLoader/examples/pet-tool-integration.ts) - 完整实现
- [基础使用示例](pluginLoader/example-usage.ts) - 简单示例

#### 插件示例
- [bilibili-emoji 插件](pluginLoader/plugins/bilibili-emoji/) - 表情包管理
  - [实现文档](pluginLoader/plugins/bilibili-emoji/IMPLEMENTATION.md)
  - [快速开始](pluginLoader/plugins/bilibili-emoji/QUICKSTART.md)
- [llm-service 插件](pluginLoader/plugins/llm-service/) - LLM 服务

### 🛠️ 开发工具

#### 工具文档
- [工具索引](pluginLoader/tools/INDEX.md) - 工具总览
- [速查表](pluginLoader/tools/CHEATSHEET.md) - 常用命令
- [使用示例](pluginLoader/tools/USAGE_EXAMPLES.md) - 实际用法
- [快速参考](pluginLoader/QUICK_REFERENCE.md) - 快速查询

#### 工具脚本
- [CLI 工具](pluginLoader/tools/plugin-cli.js) - 命令行工具
- [打包工具](pluginLoader/tools/packager.cjs) - 插件打包
- [构建打包](pluginLoader/tools/build-and-package.cjs) - 一键构建

### 📋 专题文档

#### 架构设计
- [插件架构分析](docs/plugin-loader-architecture-analysis.md)
- [完整架构](docs/plugin-loader-complete-architecture.md)
- [最终架构](docs/plugin-loader-final-architecture.md)
- [生产架构](docs/plugin-loader-production-architecture.md)
- [运行时架构](docs/plugin-runtime-architecture.md)

#### 功能实现
- [组件注入完成](COMPONENT_INJECTION_COMPLETE.md)
- [动态注入方案](docs/DYNAMIC_INJECTION_SOLUTION.md)
- [插件通信](docs/plugin-communication.md)
- [热重载](pluginLoader/core/hotReload.ts)

#### 平台支持
- [macOS 支持](pluginLoader/MACOS_SUPPORT.md)
- [平台特定插件](PLATFORM_SPECIFIC_PLUGINS.md)

### 🔧 故障排除
- [插件故障排除](PLUGIN_TROUBLESHOOTING.md)
- [插件加载修复](PLUGIN_LOADING_FIXES.md)
- [插件安装修复](PLUGIN_INSTALL_FIX.md)

### 📦 发布文档
- [构建和部署](pluginLoader/BUILD_AND_DEPLOY.md)
- [构建工具完成](pluginLoader/BUILD_TOOLS_COMPLETE.md)
- [插件工具交付](PLUGIN_TOOLS_DELIVERY.md)
- [构建工具总结](PLUGIN_BUILD_TOOLS_SUMMARY.md)

### 🎯 特定插件文档

#### bilibili-emoji
- [完整报告](BILIBILI_EMOJI_FINAL_REPORT.md)
- [V2 完成](BILIBILI_EMOJI_V2_COMPLETE.md)
- [后端完成](BILIBILI_EMOJI_BACKEND_COMPLETE.md)
- [后端集成](PLUGIN_BACKEND_INTEGRATION.md)
- [后端快速开始](PLUGIN_BACKEND_QUICKSTART.md)
- [插件检查](BILIBILI_EMOJI_PLUGIN_CHECK.md)

## 📂 按主题分类

### 新手入门
1. [5分钟快速开始](pluginLoader/docs/PET_TOOL_QUICKSTART.md)
2. [插件系统概述](PLUGIN_SYSTEM_README.md)
3. [基础使用示例](pluginLoader/example-usage.ts)
4. [速查表](pluginLoader/tools/CHEATSHEET.md)

### 插件开发
1. [插件开发指南](docs/plugin-development-guide.md)
2. [API 类型定义](pluginLoader/types/api.ts)
3. [通用 API 设计](pluginLoader/docs/PLUGIN_UNIVERSAL_API.md)
4. [设置页面 API](pluginLoader/docs/PLUGIN_SETTINGS_API.md)

### 桌宠集成 ⭐
1. [桌宠工具系统](pluginLoader/docs/PET_TOOL_SYSTEM.md)
2. [快速开始](pluginLoader/docs/PET_TOOL_QUICKSTART.md)
3. [集成示例](pluginLoader/examples/pet-tool-integration.ts)
4. [实现总结](pluginLoader/PET_TOOL_SYSTEM_COMPLETE.md)

### 后端开发
1. [插件后端实现](docs/plugin-backend-implementation.md)
2. [跨平台构建](pluginLoader/docs/CROSS_PLATFORM_BUILD.md)
3. [构建指南](pluginLoader/docs/BUILD_GUIDE.md)

### 工具使用
1. [工具索引](pluginLoader/tools/INDEX.md)
2. [CLI 工具](pluginLoader/tools/plugin-cli.js)
3. [打包工具](pluginLoader/tools/packager.cjs)
4. [使用示例](pluginLoader/tools/USAGE_EXAMPLES.md)

## 🔍 按文件类型

### Markdown 文档 (.md)
- 概述和指南
- API 文档
- 架构设计
- 故障排除

### TypeScript 代码 (.ts)
- 核心实现
- 类型定义
- 示例代码

### JavaScript 工具 (.js, .cjs)
- CLI 工具
- 构建脚本
- 打包工具

### Rust 代码 (.rs)
- 后端实现
- 动态库

## 📊 文档统计

- 总文档数: 50+
- 核心文档: 15
- 示例代码: 10
- 工具脚本: 8
- 专题文档: 20+

## 🎯 推荐阅读路径

### 路径 1: 快速上手
1. 5分钟快速开始
2. 插件系统概述
3. 基础使用示例
4. 速查表

### 路径 2: 深入开发
1. 插件开发指南
2. API 类型定义
3. 插件架构设计
4. 完整示例

### 路径 3: 桌宠集成 ⭐
1. 桌宠工具快速开始
2. 桌宠工具系统文档
3. 集成示例代码
4. 实现总结

### 路径 4: 后端开发
1. 插件后端实现
2. 跨平台构建
3. bilibili-emoji 后端示例

## 🔗 相关资源

### 外部参考
- [Tauri 文档](https://tauri.app/)
- [Vue 3 文档](https://vuejs.org/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Rust 文档](https://www.rust-lang.org/)

### 社区
- GitHub Issues
- 讨论区
- 示例仓库

## 📝 更新日志

### 最新更新 (2024)
- ✅ 添加桌宠工具系统
- ✅ 完善设置页面 API
- ✅ 实现通用 API
- ✅ 优化文档结构

### 历史更新
- 插件加载器实现
- Hook 系统完成
- 组件注入功能
- 后端支持
- 开发工具

---

**提示**: 建议从"快速上手"路径开始，然后根据需求选择其他路径深入学习。
