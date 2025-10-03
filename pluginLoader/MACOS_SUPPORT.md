# macOS 支持说明

本插件系统完全支持 macOS（包括 Intel 和 Apple Silicon）。

## 路径适配

### 自动路径映射

系统会自动将路径映射到 macOS 标准位置：

```bash
# 插件安装目录
开发环境: project/pluginLoader/plugins/
生产环境: YourApp.app/Contents/Resources/plugins/

# 用户数据目录
~/Library/Application Support/YourApp/plugin-data/

# 日志目录
~/Library/Logs/YourApp/plugins/

# 缓存目录
~/Library/Caches/YourApp/plugins/
```

### 路径示例

```typescript
// 在插件中
const api = pluginAPI;

// 插件目录
api.paths.getPluginDir()
// → /Applications/YourApp.app/Contents/Resources/plugins/my-plugin

// 数据目录
api.paths.getDataDir()
// → /Users/username/Library/Application Support/YourApp/plugin-data/my-plugin

// 缓存目录
api.paths.getCacheDir()
// → /Users/username/Library/Caches/YourApp/plugin-data/my-plugin/cache

// 日志目录
api.paths.getLogDir()
// → /Users/username/Library/Logs/YourApp/plugins/my-plugin
```

## Rust 后端支持

### 动态库命名

macOS 使用 `.dylib` 扩展名：

```bash
# 编译输出
target/release/libplugin.dylib

# 系统自动识别
api.paths.getPluginBackend()
// → /path/to/plugins/my-plugin/backend/libplugin.dylib
```

### 编译命令

#### Intel Mac (x86_64)

```bash
cd backend
cargo build --release --target x86_64-apple-darwin

# 输出
target/x86_64-apple-darwin/release/libplugin.dylib
```

#### Apple Silicon (ARM64)

```bash
cd backend
cargo build --release --target aarch64-apple-darwin

# 输出
target/aarch64-apple-darwin/release/libplugin.dylib
```

#### 通用二进制（Universal Binary）

```bash
# 1. 分别编译两个架构
cargo build --release --target x86_64-apple-darwin
cargo build --release --target aarch64-apple-darwin

# 2. 使用 lipo 合并
lipo -create \
  target/x86_64-apple-darwin/release/libplugin.dylib \
  target/aarch64-apple-darwin/release/libplugin.dylib \
  -output backend/libplugin.dylib

# 3. 验证
lipo -info backend/libplugin.dylib
# 输出: Architectures in the fat file: backend/libplugin.dylib are: x86_64 arm64
```

### Cargo 配置

创建 `.cargo/config.toml`：

```toml
[target.x86_64-apple-darwin]
rustflags = ["-C", "link-arg=-Wl,-rpath,@loader_path"]

[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-Wl,-rpath,@loader_path"]
```

## 开发环境设置

### 安装依赖

```bash
# Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js
brew install node

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 添加 Rust 目标
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# 项目依赖
npm install

# FFI 依赖（用于后端加载）
npm install ffi-napi ref-napi
```

### Xcode 命令行工具

```bash
# 安装
xcode-select --install

# 验证
xcode-select -p
# 应输出: /Library/Developer/CommandLineTools
```

## 构建流程

### 开发构建

```bash
# 前端
cd pluginLoader/plugins/my-plugin
tsc

# 后端（当前架构）
cd backend
cargo build --release

# 输出会自动匹配当前架构
# Intel Mac: x86_64
# Apple Silicon: aarch64
```

### 生产构建

```bash
# 构建通用二进制
cd pluginLoader
./build-universal.sh my-plugin
```

创建 `build-universal.sh`：

```bash
#!/bin/bash

PLUGIN_NAME=$1

if [ -z "$PLUGIN_NAME" ]; then
  echo "Usage: ./build-universal.sh <plugin-name>"
  exit 1
fi

PLUGIN_DIR="plugins/$PLUGIN_NAME"
BACKEND_DIR="$PLUGIN_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "No backend found for $PLUGIN_NAME"
  exit 0
fi

echo "Building universal binary for $PLUGIN_NAME..."

cd "$BACKEND_DIR"

# 编译两个架构
echo "Building for x86_64..."
cargo build --release --target x86_64-apple-darwin

echo "Building for aarch64..."
cargo build --release --target aarch64-apple-darwin

# 合并
echo "Creating universal binary..."
lipo -create \
  target/x86_64-apple-darwin/release/libplugin.dylib \
  target/aarch64-apple-darwin/release/libplugin.dylib \
  -output libplugin.dylib

echo "Done! Universal binary created at $BACKEND_DIR/libplugin.dylib"

# 验证
lipo -info libplugin.dylib
```

## 应用打包

### 使用 Tauri

```json
// src-tauri/tauri.conf.json
{
  "tauri": {
    "bundle": {
      "identifier": "com.yourapp.id",
      "targets": ["dmg", "app"],
      "macOS": {
        "frameworks": [],
        "minimumSystemVersion": "10.15",
        "exceptionDomain": "",
        "signingIdentity": null,
        "entitlements": null
      },
      "resources": [
        "plugins/**/*"
      ]
    }
  }
}
```

### 使用 Electron Builder

```json
// package.json
{
  "build": {
    "appId": "com.yourapp.id",
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
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

### 代码签名

```bash
# 签名应用
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  YourApp.app

# 签名插件后端
codesign --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  YourApp.app/Contents/Resources/plugins/*/backend/*.dylib

# 验证签名
codesign --verify --deep --strict --verbose=2 YourApp.app

# 公证（Notarization）
xcrun notarytool submit YourApp.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password" \
  --wait

# 装订公证票据
xcrun stapler staple YourApp.dmg
```

## 权限和沙箱

### Entitlements

创建 `build/entitlements.mac.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- 允许加载动态库 -->
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  
  <!-- 网络访问 -->
  <key>com.apple.security.network.client</key>
  <true/>
  
  <!-- 文件访问 -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  
  <!-- 如果需要完全文件系统访问 -->
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
</dict>
</plist>
```

## 故障排查

### 问题1：动态库加载失败

```bash
错误: dlopen(...libplugin.dylib, 0x0001): Library not loaded

解决:
1. 检查库是否存在
ls -la plugins/*/backend/*.dylib

2. 检查架构匹配
lipo -info plugins/*/backend/libplugin.dylib
uname -m  # 当前系统架构

3. 检查依赖
otool -L plugins/*/backend/libplugin.dylib

4. 修复 rpath
install_name_tool -add_rpath @loader_path plugins/*/backend/libplugin.dylib
```

### 问题2：权限被拒绝

```bash
错误: Operation not permitted

解决:
1. 检查应用权限
系统偏好设置 → 安全性与隐私 → 完全磁盘访问权限

2. 检查 Gatekeeper
spctl --assess --verbose YourApp.app

3. 临时禁用 Gatekeeper（仅开发）
sudo spctl --master-disable
```

### 问题3：代码签名问题

```bash
错误: code signature invalid

解决:
1. 重新签名
codesign --force --deep --sign - YourApp.app

2. 清除签名缓存
sudo rm -rf ~/Library/Caches/com.apple.codesigning.requirements

3. 验证签名
codesign --verify --deep --strict --verbose=2 YourApp.app
```

### 问题4：路径不存在

```bash
错误: ENOENT: no such file or directory

解决:
1. 检查路径
console.log(api.paths.getDataDir())

2. 手动创建目录
mkdir -p ~/Library/Application\ Support/YourApp/plugin-data

3. 检查权限
ls -la ~/Library/Application\ Support/YourApp
```

## 性能优化

### 编译优化

```toml
# Cargo.toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true

# macOS 特定优化
[target.x86_64-apple-darwin]
rustflags = ["-C", "target-cpu=native"]

[target.aarch64-apple-darwin]
rustflags = ["-C", "target-cpu=native"]
```

### 启动优化

```typescript
// 延迟加载非关键插件
if (api.paths.isDevelopment()) {
  // 开发环境立即加载
  await loadAllPlugins();
} else {
  // 生产环境延迟加载
  setTimeout(() => loadNonCriticalPlugins(), 1000);
}
```

## 测试

### 单元测试

```bash
# 前端测试
npm test

# 后端测试
cd backend
cargo test
```

### 集成测试

```bash
# 在不同架构上测试
# Intel Mac
arch -x86_64 npm run dev

# Apple Silicon
arch -arm64 npm run dev
```

### 自动化测试

```yaml
# .github/workflows/test-macos.yml
name: Test on macOS

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    
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
        target: aarch64-apple-darwin
    
    - name: Install dependencies
      run: npm install
    
    - name: Build plugins
      run: |
        cd pluginLoader
        node tools/plugin-cli.js build
    
    - name: Run tests
      run: npm test
```

## 调试技巧

### 使用 lldb 调试后端

```bash
# 启动调试
lldb -- node index.js

# 设置断点
(lldb) breakpoint set --name plugin_call

# 运行
(lldb) run

# 查看调用栈
(lldb) bt

# 查看变量
(lldb) frame variable
```

### 使用 Console.app 查看日志

```bash
# 打开控制台
open /Applications/Utilities/Console.app

# 过滤日志
搜索: YourApp

# 或使用命令行
log stream --predicate 'process == "YourApp"' --level debug
```

## 相关资源

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Rust on macOS](https://doc.rust-lang.org/rustc/platform-support/apple-darwin.html)
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

## 总结

✅ 完全支持 macOS（Intel 和 Apple Silicon）
✅ 自动路径适配
✅ 通用二进制支持
✅ 代码签名和公证
✅ 完整的构建流程
✅ 详细的故障排查指南

macOS 支持已完全集成到插件系统中，无需额外配置即可使用！

