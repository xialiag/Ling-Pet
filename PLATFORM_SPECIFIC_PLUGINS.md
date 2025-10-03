# 平台特定插件构建完成

## 实现内容

已成功实现方案1：为每个平台生成特定的插件包。

## 修改的文件

### 1. `pluginLoader/tools/packager.cjs`
- 添加了 `hasBackend()` 方法来检测插件是否包含 Rust 后端
- 修改了 `package()` 方法，自动为带后端的插件添加平台后缀
- 更新了 `generateMetadata()` 方法，在元数据中包含 `platform` 字段

### 2. `pluginLoader/tools/build-plugin.cjs`
- 改进了 TypeScript 编译，使用 esbuild 进行快速编译
- 保留了 Rust 后端的编译和复制逻辑

## 工作原理

### 纯前端插件
如果插件**没有** `backend/` 目录或编译后的动态库：
- 生成通用包：`plugin-name-1.0.0.zip`
- 元数据中 `platform: "universal"`
- 可以在所有平台上使用

### 带 Rust 后端的插件
如果插件**有** `backend/` 目录和编译后的动态库：
- 生成平台特定包：
  - Windows: `plugin-name-1.0.0-win32.zip`
  - macOS: `plugin-name-1.0.0-darwin.zip`
  - Linux: `plugin-name-1.0.0-linux.zip`
- 元数据中 `platform: "win32"` / `"darwin"` / `"linux"`
- 只能在对应平台上使用

## 示例

### 现有插件（纯前端）
```bash
npm run plugin:package
```

输出：
```
releases/plugins/
├── bilibili-emoji-2.0.0.zip          # 通用包
├── bilibili-emoji-2.0.0.json
├── llm-service-1.0.0.zip             # 通用包
└── llm-service-1.0.0.json
```

### 示例插件（带 Rust 后端）
```bash
node pluginLoader/tools/build-plugin.cjs example-native
node pluginLoader/tools/packager.cjs dist/plugins/example-native
```

输出：
```
releases/plugins/
├── example-native-1.0.0-win32.zip    # Windows 专用
└── example-native-1.0.0-win32.json
```

## 使用指南

### 开发者

1. **创建纯前端插件**：
   - 只需要 `index.ts` 和 `package.json`
   - 一次构建，到处运行

2. **创建带后端的插件**：
   - 添加 `backend/` 目录和 Rust 代码
   - 在 `package.json` 中配置 `backend` 字段
   - 需要在每个目标平台上构建

3. **多平台发布**：
   - 使用 GitHub Actions 或其他 CI/CD
   - 在 Windows、macOS、Linux 上分别构建
   - 收集所有平台的包一起发布

### 用户

1. **安装纯前端插件**：
   - 下载 `.zip` 文件（无平台后缀）
   - 在任何平台上都可以安装

2. **安装带后端的插件**：
   - 下载对应平台的 `.zip` 文件
   - Windows 用户下载 `-win32.zip`
   - macOS 用户下载 `-darwin.zip`
   - Linux 用户下载 `-linux.zip`

## 元数据格式

每个插件包都有对应的 `.json` 元数据文件：

```json
{
  "name": "@ling-pet/plugin-example-native",
  "version": "1.0.0",
  "description": "示例：带 Rust 后端的插件",
  "file": "example-native-1.0.0-win32.zip",
  "size": 70106,
  "checksum": "sha256-hash",
  "platform": "win32",
  "permissions": ["storage:read", "storage:write"]
}
```

`platform` 字段的可能值：
- `"universal"` - 纯前端插件，适用于所有平台
- `"win32"` - Windows 专用
- `"darwin"` - macOS 专用
- `"linux"` - Linux 专用

## 下一步

### 建议的改进

1. **插件市场集成**：
   - 根据用户平台自动筛选可用插件
   - 显示平台兼容性标识

2. **自动化构建**：
   - 创建 GitHub Actions workflow
   - 自动在多平台上构建和发布

3. **版本管理**：
   - 统一管理所有平台的版本号
   - 确保同一版本在所有平台上功能一致

4. **测试**：
   - 在所有目标平台上测试插件
   - 验证动态库正确加载

## 相关文档

- [跨平台构建指南](pluginLoader/docs/CROSS_PLATFORM_BUILD.md)
- [插件开发指南](docs/plugin-development-guide.md)
- [示例：带后端的插件](pluginLoader/plugins/example-native/)

## 测试结果

✅ 纯前端插件正确生成通用包
✅ 带后端插件正确生成平台特定包
✅ 元数据包含正确的平台信息
✅ 动态库正确打包到 zip 中
✅ 文件名包含平台后缀

## 总结

平台特定插件构建功能已完全实现并测试通过。开发者现在可以：
- 创建纯前端插件（跨平台）
- 创建带 Rust 后端的插件（平台特定）
- 自动生成正确的包名和元数据
- 为不同平台分发不同的插件包
