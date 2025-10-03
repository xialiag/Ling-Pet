# 插件构建指南

## 快速开始

### 一键构建和打包（推荐）

最简单的方式，自动处理所有步骤：

```bash
# 构建和打包所有插件
npm run plugin:release

# 构建和打包指定插件
npm run plugin:release bilibili-emoji

# 构建和打包多个插件
npm run plugin:release bilibili-emoji llm-service
```

这个命令会自动：
1. ✅ 编译 TypeScript 代码
2. ✅ 编译 Rust 后端（如果存在）
3. ✅ 复制资源文件
4. ✅ 生成 manifest.json
5. ✅ 打包成 .zip 文件
6. ✅ 生成元数据 .json 文件

### 分步构建

如果你需要更细粒度的控制：

#### 1. 只编译（不打包）
```bash
# 编译所有插件
npm run plugin:build

# 编译指定插件
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin
```

#### 2. 只打包（假设已编译）
```bash
# 打包所有已编译的插件
npm run plugin:package

# 打包指定插件
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin
```

## 构建选项

### 包含示例插件
```bash
npm run plugin:release -- --include-examples
```

### 不压缩代码（用于调试）
```bash
npm run plugin:release -- --no-minify
```

### 不生成 sourcemap
```bash
npm run plugin:release -- --no-sourcemap
```

### 详细输出
```bash
npm run plugin:release -- --verbose
```

### 自定义输出目录
```bash
npm run plugin:release -- --out-dir ./my-releases
```

## 插件类型

### 纯前端插件

只包含 JavaScript/TypeScript 代码，无需额外配置。

**目录结构**：
```
pluginLoader/plugins/my-plugin/
├── index.ts          # 入口文件
├── package.json      # 插件配置
└── README.md         # 说明文档
```

**构建命令**：
```bash
npm run plugin:release my-plugin
```

**输出**：
```
releases/plugins/
├── my-plugin-1.0.0.zip       # 通用包
└── my-plugin-1.0.0.json      # 元数据
```

### 带 Rust 后端的插件

包含原生代码，需要 Rust 工具链。

**目录结构**：
```
pluginLoader/plugins/my-plugin/
├── backend/
│   ├── Cargo.toml    # Rust 配置
│   └── src/
│       └── lib.rs    # Rust 代码
├── index.ts          # 入口文件
├── package.json      # 插件配置
└── README.md         # 说明文档
```

**package.json 配置**：
```json
{
  "name": "@ling-pet/plugin-my-plugin",
  "version": "1.0.0",
  "backend": {
    "enabled": true,
    "entry": "backend/plugin.dll"
  }
}
```

**构建命令**：
```bash
npm run plugin:release my-plugin
```

**输出**（平台特定）：
```
releases/plugins/
├── my-plugin-1.0.0-win32.zip    # Windows 包
└── my-plugin-1.0.0-win32.json   # 元数据
```

## 自动化构建

### 前提条件

构建工具会自动检测并处理：

1. **TypeScript 编译**
   - 自动检测 `index.ts`
   - 使用 esbuild 快速编译
   - 生成 sourcemap（可选）

2. **Rust 后端编译**
   - 自动检测 `backend/Cargo.toml`
   - 运行 `cargo build --release`
   - 复制编译后的动态库到输出目录

3. **资源文件复制**
   - README.md
   - LICENSE
   - assets/
   - components/
   - styles/
   - locales/

4. **元数据生成**
   - 从 package.json 生成 manifest.json
   - 自动转换 .ts 入口为 .js
   - 生成 SHA256 校验和

### 构建流程

```
┌─────────────────────────────────────────┐
│  1. 清理输出目录                         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  2. 编译 TypeScript                      │
│     - 使用 esbuild                       │
│     - 打包依赖                           │
│     - 生成 index.js                      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  3. 编译 Rust 后端（如果存在）           │
│     - 运行 cargo build --release         │
│     - 复制 .dll/.dylib/.so               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  4. 复制资源文件                         │
│     - README, LICENSE                    │
│     - assets, components, etc.           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  5. 生成 manifest.json                   │
│     - 从 package.json 转换               │
│     - 处理入口文件路径                   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  6. 打包成 .zip                          │
│     - 添加平台后缀（如果有后端）         │
│     - 压缩所有文件                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  7. 生成元数据 .json                     │
│     - 计算 SHA256                        │
│     - 记录平台信息                       │
└─────────────────────────────────────────┘
```

## 常见问题

### Q: 构建失败，提示找不到 cargo

**A**: 需要安装 Rust 工具链：
```bash
# Windows
winget install Rustlang.Rust.MSVC

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Q: TypeScript 编译错误

**A**: 检查 TypeScript 语法，或使用 `--no-minify` 查看详细错误：
```bash
npm run plugin:release my-plugin -- --no-minify --verbose
```

### Q: 如何跳过 Rust 后端编译

**A**: 如果不需要后端，删除或重命名 `backend/` 目录：
```bash
mv pluginLoader/plugins/my-plugin/backend pluginLoader/plugins/my-plugin/backend.bak
```

### Q: 如何为多个平台构建

**A**: 在每个平台上分别运行构建命令，或使用 CI/CD：
```yaml
# .github/workflows/build.yml
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - run: npm run plugin:release
```

### Q: 构建很慢

**A**: 
1. Rust 首次编译较慢，后续会快很多
2. 使用 `--no-sourcemap` 跳过 sourcemap 生成
3. 只构建需要的插件，不要构建所有插件

## 开发工作流

### 开发阶段
```bash
# 监听模式，自动重新编译
npm run plugin:build:watch
```

### 测试阶段
```bash
# 构建但不压缩，便于调试
npm run plugin:release my-plugin -- --no-minify
```

### 发布阶段
```bash
# 完整构建，包括压缩和 sourcemap
npm run plugin:release my-plugin
```

## 最佳实践

1. **版本管理**
   - 在 package.json 中统一管理版本
   - 使用语义化版本号（semver）

2. **依赖管理**
   - 将 Vue、Tauri 等标记为 external
   - 避免打包大型依赖

3. **测试**
   - 构建后在应用中测试插件
   - 验证所有功能正常工作

4. **文档**
   - 保持 README.md 更新
   - 说明插件的功能和使用方法

5. **清理**
   - 定期清理 dist/ 目录
   - 删除旧的 releases/

## 命令速查表

| 命令 | 说明 |
|------|------|
| `npm run plugin:release` | 构建和打包所有插件 |
| `npm run plugin:release <name>` | 构建和打包指定插件 |
| `npm run plugin:build` | 只编译，不打包 |
| `npm run plugin:package` | 只打包，假设已编译 |
| `npm run plugin:build:watch` | 监听模式 |
| `npm run plugin:clean` | 清理构建产物 |

## 示例

### 构建纯前端插件
```bash
npm run plugin:release bilibili-emoji
```

### 构建带后端的插件
```bash
npm run plugin:release example-native
```

### 构建多个插件
```bash
npm run plugin:release bilibili-emoji llm-service
```

### 调试模式构建
```bash
npm run plugin:release my-plugin -- --no-minify --verbose
```

### 包含示例插件
```bash
npm run plugin:release -- --include-examples
```
