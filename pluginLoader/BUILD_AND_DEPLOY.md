# 插件系统构建和部署指南

本文档详细说明如何构建和部署插件系统及插件。

## 目录

1. [开发环境设置](#开发环境设置)
2. [插件开发流程](#插件开发流程)
3. [构建流程](#构建流程)
4. [部署流程](#部署流程)
5. [跨平台构建](#跨平台构建)
6. [故障排查](#故障排查)

---

## 开发环境设置

### 前置要求

```bash
# Node.js (推荐 v18+)
node --version

# Rust (用于后端开发)
rustc --version
cargo --version

# TypeScript
npm install -g typescript

# 可选：chokidar (用于热加载)
npm install chokidar
```

### 安装依赖

```bash
# 主项目依赖
npm install

# 插件加载器依赖
cd pluginLoader
npm install

# 如果需要后端支持
npm install ffi-napi ref-napi
```

---

## 插件开发流程

### 1. 创建新插件

```bash
cd pluginLoader
node tools/plugin-cli.js create my-plugin
```

这会创建以下结构：

```
plugins/my-plugin/
├── package.json
├── index.ts
├── tsconfig.json
├── components/
├── assets/
└── backend/
    ├── Cargo.toml
    └── src/lib.rs
```

### 2. 开发插件

#### 前端开发

```typescript
// plugins/my-plugin/index.ts
import { PluginAPI } from '../../types/api';

export default function(api: PluginAPI) {
  return {
    async activate() {
      // 插件逻辑
      api.logger.info('Plugin activated');
    },
    
    async deactivate() {
      api.logger.info('Plugin deactivated');
    }
  };
}
```

#### 后端开发（可选）

```rust
// plugins/my-plugin/backend/src/lib.rs
#[no_mangle]
pub extern "C" fn plugin_init() -> *mut c_char {
    // 初始化逻辑
}

#[no_mangle]
pub extern "C" fn plugin_call(
    method: *const c_char,
    params: *const c_char
) -> *mut c_char {
    // 方法调用逻辑
}
```

### 3. 开发时测试

```bash
# 启动主程序（开发模式）
npm run dev

# 插件会自动加载并启用热加载
# 修改代码后会自动重载
```

---

## 构建流程

### 单个插件构建

```bash
cd pluginLoader

# 构建指定插件
node tools/plugin-cli.js build my-plugin
```

构建步骤：
1. 编译 TypeScript → JavaScript
2. 编译 Rust 后端（如果存在）
3. 复制资源文件
4. 生成到 `dist/plugins/my-plugin/`

### 所有插件构建

```bash
# 构建所有插件
node tools/plugin-cli.js build
```

### 验证插件

```bash
# 验证插件结构和元数据
node tools/plugin-cli.js validate my-plugin
```

### 主程序构建

```bash
# 返回项目根目录
cd ..

# 构建主程序
npm run build

# 这会：
# 1. 构建主程序到 dist/
# 2. 自动构建所有插件到 dist/plugins/
```

---

## 部署流程

### 开发环境部署

开发环境使用源码目录：

```
project/
├── pluginLoader/plugins/     # 插件源码
└── plugin-data/              # 开发数据
```

### 生产环境部署

#### 方案1：直接部署

```bash
# 1. 构建
npm run build

# 2. 部署目录结构
app/
├── main-app.exe
├── resources/
├── plugins/                  # 从 dist/plugins/ 复制
│   ├── bilibili-emoji/
│   └── llm-service/
└── [运行时创建] plugin-data/
```

#### 方案2：使用打包工具

```bash
# 使用 electron-builder
npm run package

# 或使用 Tauri
npm run tauri build
```

#### 打包配置示例（electron-builder）

```json
{
  "build": {
    "appId": "com.yourapp.id",
    "files": [
      "dist/**/*",
      "plugins/**/*"
    ],
    "extraResources": [
      {
        "from": "dist/plugins",
        "to": "plugins",
        "filter": ["**/*"]
      }
    ]
  }
}
```

#### 打包配置示例（Tauri）

```json
{
  "tauri": {
    "bundle": {
      "resources": [
        "dist/plugins/*"
      ]
    }
  }
}
```

### 插件安装目录

生产环境中，插件会被安装到：

| 平台 | 插件目录 | 数据目录 |
|------|---------|---------|
| Windows | `app/plugins/` | `%APPDATA%/YourApp/plugin-data/` |
| macOS | `app/plugins/` | `~/Library/Application Support/YourApp/plugin-data/` |
| Linux | `app/plugins/` | `~/.config/yourapp/plugin-data/` |

---

## 跨平台构建

### Windows

```bash
# 前端
npm run build

# 后端（每个插件）
cd pluginLoader/plugins/my-plugin/backend
cargo build --release --target x86_64-pc-windows-msvc

# 输出: target/release/plugin.dll
```

### macOS

```bash
# 前端
npm run build

# 后端 - Intel Mac
cd pluginLoader/plugins/my-plugin/backend
cargo build --release --target x86_64-apple-darwin

# 后端 - Apple Silicon
cargo build --release --target aarch64-apple-darwin

# 输出: target/release/libplugin.dylib
```

### Linux

```bash
# 前端
npm run build

# 后端
cd pluginLoader/plugins/my-plugin/backend
cargo build --release --target x86_64-unknown-linux-gnu

# 输出: target/release/libplugin.so
```

### 通用构建脚本

```bash
#!/bin/bash
# build-all-platforms.sh

PLUGIN_NAME=$1

echo "Building plugin: $PLUGIN_NAME"

# 前端
cd pluginLoader/plugins/$PLUGIN_NAME
tsc

# 后端
if [ -d "backend" ]; then
  cd backend
  
  # 检测平台
  case "$(uname -s)" in
    Darwin*)
      echo "Building for macOS..."
      cargo build --release --target x86_64-apple-darwin
      cargo build --release --target aarch64-apple-darwin
      ;;
    Linux*)
      echo "Building for Linux..."
      cargo build --release --target x86_64-unknown-linux-gnu
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "Building for Windows..."
      cargo build --release --target x86_64-pc-windows-msvc
      ;;
  esac
fi

echo "Build complete!"
```

---

## 自动化构建

### GitHub Actions 示例

```yaml
# .github/workflows/build-plugins.yml
name: Build Plugins

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Install dependencies
      run: npm install
    
    - name: Build plugins
      run: |
        cd pluginLoader
        node tools/plugin-cli.js build
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: plugins-${{ matrix.os }}
        path: dist/plugins/
```

---

## 故障排查

### 问题1：TypeScript 编译失败

```bash
错误: Cannot find module '../../types/api'

解决:
1. 检查 tsconfig.json 配置
2. 确保 types/api.ts 存在
3. 运行: npm install
```

### 问题2：Rust 编译失败

```bash
错误: linker 'cc' not found

解决:
# macOS
xcode-select --install

# Linux
sudo apt-get install build-essential

# Windows
安装 Visual Studio Build Tools
```

### 问题3：后端加载失败

```bash
错误: Backend not found: /path/to/plugin.dll

解决:
1. 确认后端已编译: cargo build --release
2. 检查文件名是否正确:
   - Windows: plugin.dll
   - macOS: libplugin.dylib
   - Linux: libplugin.so
3. 检查路径: api.paths.getPluginBackend()
```

### 问题4：FFI 依赖缺失

```bash
错误: Cannot find module 'ffi-napi'

解决:
npm install ffi-napi ref-napi

# 如果安装失败，可能需要：
# Windows: 安装 windows-build-tools
# macOS: xcode-select --install
# Linux: sudo apt-get install build-essential
```

### 问题5：路径问题

```bash
错误: ENOENT: no such file or directory

解决:
1. 使用 api.paths 获取路径，不要硬编码
2. 检查环境变量 NODE_ENV
3. 确认目录已创建
```

### 问题6：热加载不工作

```bash
问题: 修改代码后没有自动重载

解决:
1. 确认是开发环境: NODE_ENV=development
2. 安装 chokidar: npm install chokidar
3. 检查文件监听器是否启动
4. 查看日志: [HotReload] Watching plugin: xxx
```

---

## 性能优化

### 构建优化

```bash
# Rust 后端优化
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true  # 移除调试符号，减小体积
```

### 打包优化

```bash
# 只打包必要文件
# 排除：
- node_modules/
- .ts 源文件
- backend/src/
- backend/target/debug/
- .git/
```

---

## 发布检查清单

- [ ] 所有插件编译成功
- [ ] 后端库文件存在且正确命名
- [ ] package.json 元数据完整
- [ ] README.md 文档完整
- [ ] 测试所有功能正常
- [ ] 检查日志无错误
- [ ] 验证跨平台兼容性
- [ ] 清理临时文件
- [ ] 版本号更新
- [ ] 生成发布说明

---

## 持续集成建议

1. **自动化测试**：每次提交自动构建和测试
2. **多平台构建**：同时构建 Windows/macOS/Linux 版本
3. **版本管理**：使用语义化版本号
4. **发布自动化**：自动打包和发布到应用商店
5. **文档生成**：自动生成 API 文档

---

## 相关文档

- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构设计](../docs/plugin-loader-final-architecture.md)
- [API 参考](../docs/plugin-system-overview.md)

