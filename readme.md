# Ling-Pet 桌宠应用

一个现代化的桌面宠物应用，基于 Tauri + Vue 3 构建，支持强大的插件系统。

## ✨ 核心特性

- 🎨 **Live2D 桌面宠物** - 可爱的桌面伴侣
- 🤖 **AI 对话系统** - 智能聊天和工具调用
- 🔌 **强大的插件系统** - 无限扩展可能
- 🎯 **无侵入式架构** - 无需修改源码即可扩展
- 🔧 **开发者友好** - 完整的开发工具链

## 🚀 快速开始

### 运行应用
```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 构建应用
npm run tauri build
```

### 插件开发
```bash
# 创建新插件
npm run plugin:create my-plugin

# 构建插件
npm run plugin:build my-plugin

# 打包插件
npm run plugin:release my-plugin
```

## 🔌 插件系统

### 设计理念

插件系统的核心设计理念是**无侵入式扩展**：
- **零修改源码** - 通过 Vue 实例拦截和 DOM 注入实现功能扩展
- **热插拔支持** - 运行时加载/卸载插件，无需重启应用
- **多语言支持** - TypeScript 前端 + Rust 后端的混合架构
- **权限控制** - 细粒度的权限管理确保安全性
- **工具集成** - 为 AI 桌宠提供丰富的工具能力

### 核心功能

1. **Vue 组件注入** - 无需修改源码即可 Hook 任何组件
2. **DOM 操作 API** - 灵活的 HTML/CSS/Vue 组件注入
3. **LLM 工具系统** - 为 AI 助手提供扩展工具
4. **插件通信** - 事件系统和 RPC 调用
5. **文件系统访问** - 跨平台的文件操作 API
6. **配置管理** - 持久化的插件配置存储

### 示例插件

- **bilibili-emoji** - B站表情包管理，包含 Rust 后端
- **dom-injection-test** - DOM 注入功能演示
- **hook-test** - 组件 Hook 功能演示

## 📚 文档导航

### 核心文档
- [插件系统介绍](PLUGIN_SYSTEM_README.md) - 系统概述和特性
- [开发指南](PLUGIN_SYSTEM_GUIDE.md) - 完整的开发教程
- [API 参考](API_REFERENCE.md) - 详细的 API 文档
- [故障排除](TROUBLESHOOTING.md) - 常见问题解决

### 插件开发
- [构建指南](pluginLoader/docs/BUILD_GUIDE.md) - 插件构建和打包
- [桌宠工具系统](pluginLoader/docs/PET_TOOL_SYSTEM.md) - AI 工具集成
- [工具速查表](pluginLoader/tools/CHEATSHEET.md) - 常用命令和 API

### 示例代码
- [插件示例](pluginLoader/plugins/) - 完整的插件实现
- [工具集成示例](pluginLoader/examples/) - 桌宠工具集成

## 🏗️ 项目结构

```
├── src/                    # 主应用源码
│   ├── components/         # Vue 组件
│   ├── pages/             # 页面组件
│   └── services/          # 业务服务
├── src-tauri/             # Tauri 后端
├── pluginLoader/          # 插件系统
│   ├── core/              # 核心实现
│   ├── types/             # 类型定义
│   ├── plugins/           # 插件目录
│   ├── tools/             # 开发工具
│   └── docs/              # 插件文档
└── releases/              # 构建产物
    └── plugins/           # 插件包
```

## 🛠️ 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Tauri (Rust)
- **插件**: TypeScript + Rust (可选)
- **UI**: Vuetify 3
- **状态管理**: Pinia
- **构建工具**: 自定义插件构建系统

## 📦 插件生态

### 已有插件
- **bilibili-emoji** - B站表情包管理和下载
- **dom-injection-test** - DOM 注入功能测试
- **hook-test** - 组件 Hook 功能测试

### 开发中
- **llm-service** - LLM 服务集成
- **file-manager** - 文件管理工具
- **system-monitor** - 系统监控工具

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 开发插件或改进功能
4. 提交 Pull Request

## 📄 许可证

MIT License

---

**让你的桌宠更智能，让开发更简单！** 🎉