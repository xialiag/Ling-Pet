# 插件编译打包工具 - 使用示例

## 📝 实际使用场景

### 场景 1: 开发新插件

```bash
# 1. 创建插件骨架
node pluginLoader/tools/plugin-cli.js create weather-widget

# 2. 进入插件目录开发
cd pluginLoader/plugins/weather-widget

# 3. 编辑 index.ts
# ... 编写插件代码 ...

# 4. 启动监听模式（在项目根目录）
npm run plugin:build:watch pluginLoader/plugins/weather-widget

# 5. 在另一个终端启动主应用测试
npm run dev
```

### 场景 2: 修改现有插件

```bash
# 1. 启动监听模式
npm run plugin:build:watch pluginLoader/plugins/bilibili-emoji

# 2. 修改代码
# 编辑 pluginLoader/plugins/bilibili-emoji/index.ts

# 3. 保存后自动编译
# ✅ 编译完成 (234ms)

# 4. 在主应用中测试
# 刷新或重启应用查看效果
```

### 场景 3: 准备发布插件

```bash
# 1. 更新版本号
# 编辑 pluginLoader/plugins/my-plugin/package.json
# "version": "1.0.0" -> "1.1.0"

# 2. 检查插件
npm run plugin:check

# 3. 编译插件（生产模式）
npm run plugin:compile pluginLoader/plugins/my-plugin

# 4. 打包插件
node pluginLoader/tools/packager.cjs dist/plugins/my-plugin

# 5. 验证输出
ls releases/plugins/
# my-plugin-1.1.0.zip
# my-plugin-1.1.0.json

# 6. 上传到服务器
# scp releases/plugins/my-plugin-1.1.0.* user@server:/path/
```

### 场景 4: 批量构建所有插件

```bash
# 1. 清理旧构建
npm run plugin:clean

# 2. 检查所有插件
npm run plugin:check

# 3. 编译所有插件
npm run plugin:build

# 4. 查看输出
ls dist/plugins/
# bilibili-emoji/
# demo-complete/
# example-plugin/
```

### 场景 5: CI/CD 自动化构建

```bash
# .github/workflows/build-plugins.yml

name: Build Plugins

on:
  push:
    branches: [main]
    paths:
      - 'pluginLoader/plugins/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Check plugins
        run: npm run plugin:check
      
      - name: Build and package
        run: npm run plugin:package
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: plugins
          path: releases/plugins/
```

### 场景 6: 调试编译问题

```bash
# 1. 查看详细编译信息
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --verbose

# 2. 不压缩代码（方便调试）
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin --no-minify

# 3. 检查 TypeScript 类型错误
cd pluginLoader/plugins/my-plugin
npx tsc --noEmit

# 4. 查看编译后的代码
cat dist/plugins/my-plugin/index.js
```

### 场景 7: 开发 Rust 后端插件

```bash
# 1. 创建插件
node pluginLoader/tools/plugin-cli.js create native-plugin

# 2. 添加 Rust 后端
cd pluginLoader/plugins/native-plugin
mkdir backend
cd backend
cargo init --lib

# 3. 配置 Cargo.toml
cat > Cargo.toml << EOF
[package]
name = "plugin"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
# 你的依赖
EOF

# 4. 编写 Rust 代码
# 编辑 src/lib.rs

# 5. 编译（会自动编译 Rust 后端）
npm run plugin:compile pluginLoader/plugins/native-plugin

# 6. 检查输出
ls dist/plugins/native-plugin/backend/
# Windows: plugin.dll
# macOS: libplugin.dylib
# Linux: libplugin.so
```

### 场景 8: 多平台构建

```bash
# Windows
npm run plugin:compile pluginLoader/plugins/my-plugin
# 输出: dist/plugins/my-plugin/backend/plugin.dll

# macOS
npm run plugin:compile pluginLoader/plugins/my-plugin
# 输出: dist/plugins/my-plugin/backend/libplugin.dylib

# Linux
npm run plugin:compile pluginLoader/plugins/my-plugin
# 输出: dist/plugins/my-plugin/backend/libplugin.so
```

### 场景 9: 性能优化

```bash
# 1. 分析打包大小
node pluginLoader/tools/compiler.cjs pluginLoader/plugins/my-plugin

# 2. 查看编译后的文件大小
du -sh dist/plugins/my-plugin/

# 3. 检查是否有不必要的依赖
unzip -l releases/plugins/my-plugin-1.0.0.zip

# 4. 优化建议
# - 使用外部依赖（external）
# - 压缩图片资源
# - 移除未使用的代码
```

### 场景 10: 团队协作

```bash
# 开发者 A: 开发插件
npm run plugin:build:watch pluginLoader/plugins/feature-a

# 开发者 B: 开发另一个插件
npm run plugin:build:watch pluginLoader/plugins/feature-b

# 提交前检查
npm run plugin:check

# 提交代码
git add pluginLoader/plugins/
git commit -m "feat: add new plugins"
git push

# CI 自动构建和发布
# GitHub Actions 自动运行 npm run plugin:package
```

## 🔧 高级用法

### 自定义编译配置

```javascript
// pluginLoader/tools/custom-build.cjs
const { PluginCompiler } = require('./compiler.cjs');

async function customBuild() {
  const compiler = new PluginCompiler('pluginLoader/plugins/my-plugin', {
    outDir: './custom-output',
    minify: true,
    sourcemap: false,
    // 自定义选项
  });

  await compiler.compile();
}

customBuild();
```

### 批量处理特定插件

```javascript
// pluginLoader/tools/build-selected.cjs
const { PluginCompiler } = require('./compiler.cjs');
const path = require('path');

const pluginsToBuild = ['bilibili-emoji', 'weather-widget'];

async function buildSelected() {
  for (const plugin of pluginsToBuild) {
    const pluginPath = path.join(__dirname, '../plugins', plugin);
    const compiler = new PluginCompiler(pluginPath);
    await compiler.compile();
  }
}

buildSelected();
```

### 添加构建钩子

```javascript
// pluginLoader/tools/build-with-hooks.cjs
const { PluginCompiler } = require('./compiler.cjs');

class CustomCompiler extends PluginCompiler {
  async compile() {
    console.log('🔔 构建前钩子');
    // 执行构建前的操作
    
    const result = await super.compile();
    
    console.log('🔔 构建后钩子');
    // 执行构建后的操作
    // 例如：通知、上传、测试等
    
    return result;
  }
}

const compiler = new CustomCompiler('pluginLoader/plugins/my-plugin');
compiler.compile();
```

## 💡 最佳实践

### 1. 开发时使用监听模式

```bash
# ✅ 推荐
npm run plugin:build:watch pluginLoader/plugins/my-plugin

# ❌ 不推荐（每次都要手动编译）
npm run plugin:compile pluginLoader/plugins/my-plugin
```

### 2. 发布前完整检查

```bash
# 完整的发布流程
npm run plugin:clean      # 清理
npm run plugin:check      # 检查
npm run plugin:package    # 构建和打包
```

### 3. 使用版本控制

```bash
# 更新版本
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# 打标签
git tag v1.0.0
git push --tags
```

### 4. 保持插件体积小

```bash
# 检查依赖
npm ls --depth=0

# 移除未使用的依赖
npm uninstall unused-package

# 使用外部依赖
# 在 compiler.cjs 中配置 external
```

### 5. 编写测试

```bash
# 创建测试文件
# pluginLoader/plugins/my-plugin/test.ts

# 运行测试
npm test
```

## 🐛 故障排除示例

### 问题 1: 编译失败

```bash
# 错误信息
❌ 编译失败: Cannot find module 'xxx'

# 解决方案
cd pluginLoader/plugins/my-plugin
npm install xxx
```

### 问题 2: Rust 编译失败

```bash
# 错误信息
❌ Rust 编译失败: cargo not found

# 解决方案
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version
```

### 问题 3: 打包文件太大

```bash
# 检查文件大小
unzip -l releases/plugins/my-plugin-1.0.0.zip | sort -k4 -n

# 找出大文件
# 优化或移除不必要的文件
```

### 问题 4: 监听模式不工作

```bash
# Linux: 增加文件监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 验证
cat /proc/sys/fs/inotify/max_user_watches
```

## 📚 相关资源

- [完整文档](./README.md)
- [快速入门](./QUICKSTART.md)
- [插件开发指南](../docs/plugin-development-guide.md)
- [插件架构](../docs/plugin-architecture.md)
