# LingPet 灵宠

<p align="center">
  <img src="./public/头像.png" alt="LingPet 头像" width="200">
</p>

LingPet 是一款开源的桌宠。

美术资源来自[LingChat](https://github.com/SlimeBoyOwO/LingChat/blob/develop/ling_chat/core/ai_service/rag_manager.py)，特此感谢。

**commit 经过精心设计，浏览 commit 历史可以了解桌宠的开发历程并逐步学习**。

## ✨ 核心功能

- **智能对话**: 与桌宠进行流畅、自然的实时对话。
- **情感化身**: 桌宠拥有多种可变头像，能根据对话内容展现出高兴、悲伤、好奇等多种情绪。
- **语音合成 (TTS)**: 集成 Style-Bert-Vits2 语音合成技术，让您能听到桌宠的声音。
- **屏幕分析**: 独特的功能，允许桌宠“看到”您的屏幕内容，并据此提供相关的评论或帮助。
- **跨平台**: 基于 Tauri 构建，可运行在 Windows、macOS 和 Linux 系统上。

## 🛠️ 技术栈

- **前端**: Vue 3, Vite, TypeScript, Vuetify
- **后端**: Rust, Tauri
- **AI**: 大语言模型集成
- **TTS**: [sbv2-api](https://github.com/neodyland/sbv2-api)

## 🚀 快速开始

### 1. 环境准备
请确保您已安装 [Node.js](https://nodejs.org/)、[pnpm](https://pnpm.io/) 以及 [Rust 环境和 Tauri 依赖](https://tauri.app/v1/guides/getting-started/prerequisites)。

### 2. 克隆项目
```bash
git clone https://github.com/your-username/LingPet.git
cd LingPet
```
*请将 `your-username/LingPet.git` 替换为实际的仓库地址。*

### 3. 安装依赖
```bash
pnpm install
```

### 4. 运行开发环境
```bash
pnpm tauri dev
```

### 5. 构建应用
```bash
pnpm tauri build
```

## 💡 IDE 配置推荐

- [VS Code](https://code.visualstudio.com/)
- [Volar (Vue 官方插件)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)