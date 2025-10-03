# 跨平台插件构建指南

## 概述

Ling-Pet 插件系统支持两种类型的插件：
1. **纯前端插件**：只包含 JavaScript/TypeScript 代码，可以在所有平台上运行
2. **带 Rust 后端的插件**：包含原生动态库，需要为每个平台单独构建

## 纯前端插件

纯前端插件可以在任何平台上构建，生成的包可以在所有平台上使用。

### 构建命令
```bash
npm run plugin:build
npm run plugin:package
```

### 输出
```
releases/plugins/
└── my-plugin-1.0.0.zip  # 通用包，适用于所有平台
```

## 带 Rust 后端的插件

如果插件包含 Rust 后端（`backend/` 目录），构建工具会自动检测并生成平台特定的包。

### 插件结构
```
pluginLoader/plugins/my-plugin/
├── backend/
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs
│   └── build.rs (可选)
├── index.ts
└── package.json
```

### package.json 配置
```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll"  // Windows 示例
  }
}
```

### 构建流程

#### 1. 在 Windows 上构建
```bash
npm run plugin:build    # 编译 Rust 后端为 .dll
npm run plugin:package  # 打包为 my-plugin-1.0.0-win32.zip
```

输出：
```
releases/plugins/
├── my-plugin-1.0.0-win32.zip
└── my-plugin-1.0.0-win32.json
```

#### 2. 在 macOS 上构建
```bash
npm run plugin:build    # 编译 Rust 后端为 .dylib
npm run plugin:package  # 打包为 my-plugin-1.0.0-darwin.zip
```

输出：
```
releases/plugins/
├── my-plugin-1.0.0-darwin.zip
└── my-plugin-1.0.0-darwin.json
```

#### 3. 在 Linux 上构建
```bash
npm run plugin:build    # 编译 Rust 后端为 .so
npm run plugin:package  # 打包为 my-plugin-1.0.0-linux.zip
```

输出：
```
releases/plugins/
├── my-plugin-1.0.0-linux.zip
└── my-plugin-1.0.0-linux.json
```

## 使用 CI/CD 自动化构建

推荐使用 GitHub Actions 在多个平台上自动构建插件。

### GitHub Actions 示例

创建 `.github/workflows/build-plugin.yml`：

```yaml
name: Build Plugin

on:
  push:
    tags:
      - 'plugin-*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
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
      
      - name: Build plugin
        run: |
          npm run plugin:build
          npm run plugin:package
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: plugins-${{ matrix.os }}
          path: releases/plugins/*.zip
```

## 发布插件

### 1. 收集所有平台的包

构建完成后，你应该有：
```
releases/plugins/
├── my-plugin-1.0.0-win32.zip
├── my-plugin-1.0.0-darwin.zip
└── my-plugin-1.0.0-linux.zip
```

### 2. 创建发布说明

在 GitHub Release 或插件市场中，说明每个平台需要下载的包：

```markdown
## 下载

- **Windows**: my-plugin-1.0.0-win32.zip
- **macOS**: my-plugin-1.0.0-darwin.zip
- **Linux**: my-plugin-1.0.0-linux.zip

## 安装

1. 下载对应平台的 zip 包
2. 在 Ling-Pet 中打开设置 > 插件管理
3. 点击"安装插件"并选择下载的 zip 文件
```

## 元数据文件

每个插件包都会生成一个 `.json` 元数据文件，包含：

```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者",
  "file": "my-plugin-1.0.0-win32.zip",
  "size": 12345,
  "checksum": "sha256-hash",
  "platform": "win32",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "permissions": ["storage:read", "network:request"]
}
```

`platform` 字段标识了插件包的目标平台：
- `win32`: Windows
- `darwin`: macOS
- `linux`: Linux
- `universal`: 纯前端插件，适用于所有平台

## 最佳实践

### 1. 版本管理
- 所有平台使用相同的版本号
- 在 `package.json` 中统一管理版本

### 2. 测试
- 在目标平台上测试插件
- 确保动态库正确加载

### 3. 文档
- 在 README 中说明插件是否需要 Rust 后端
- 提供每个平台的下载链接

### 4. 依赖管理
- 在 `Cargo.toml` 中明确声明依赖版本
- 避免使用平台特定的系统库（除非必要）

## 故障排查

### 问题：找不到动态库

**症状**：插件安装成功，但加载失败，提示找不到动态库

**解决方案**：
1. 确认在正确的平台上构建了插件
2. 检查 `backend/` 目录中是否存在编译后的动态库
3. 验证 `package.json` 中的 `backend.entry` 路径正确

### 问题：动态库加载失败

**症状**：插件加载时报错 "Failed to load library"

**解决方案**：
1. 检查动态库的依赖项是否已安装
2. 在 Windows 上，确保 Visual C++ Redistributable 已安装
3. 在 Linux 上，检查 `ldd` 输出，确认所有依赖都可用

### 问题：跨平台兼容性

**症状**：插件在某些平台上无法工作

**解决方案**：
1. 避免使用平台特定的 API
2. 使用条件编译 (`#[cfg(target_os = "...")]`)
3. 在所有目标平台上进行测试

## 示例：创建带后端的插件

### 1. 创建插件结构
```bash
mkdir -p pluginLoader/plugins/my-plugin/backend
cd pluginLoader/plugins/my-plugin
```

### 2. 初始化 Rust 项目
```bash
cd backend
cargo init --lib
```

### 3. 配置 Cargo.toml
```toml
[package]
name = "my-plugin-backend"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
# 添加你的依赖
```

### 4. 实现插件逻辑
```rust
// backend/src/lib.rs
#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("Plugin initialized!");
}

#[no_mangle]
pub extern "C" fn my_function(input: i32) -> i32 {
    input * 2
}
```

### 5. 配置 package.json
```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.ts",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll",
    "commands": ["my_function"]
  }
}
```

### 6. 构建和打包
```bash
cd ../../..  # 回到项目根目录
npm run plugin:build
npm run plugin:package
```

## 总结

- **纯前端插件**：一次构建，到处运行
- **带后端插件**：需要为每个平台单独构建
- **推荐使用 CI/CD**：自动化多平台构建流程
- **清晰标注平台**：在文件名和元数据中包含平台信息
