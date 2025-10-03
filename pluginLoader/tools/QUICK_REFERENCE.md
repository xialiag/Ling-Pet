# 插件工具 - 快速参考

## 🚀 一分钟上手

```bash
# 1. 创建插件
node pluginLoader/tools/plugin-cli.js create my-plugin

# 2. 开发（监听模式）
npm run plugin:build:watch pluginLoader/plugins/my-plugin

# 3. 发布
npm run plugin:release
```

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `npm run plugin:build` | 编译所有插件 |
| `npm run plugin:build:watch <path>` | 监听模式 |
| `npm run plugin:package` | 编译并打包 |
| `npm run plugin:check` | 检查插件 |
| `npm run plugin:clean` | 清理构建 |
| `npm run plugin:release` | 准备发布 |

## 📁 输出目录

```
dist/plugins/           # 编译后
releases/plugins/       # 打包后（.zip）
```

## 📚 文档

| 文档 | 说明 |
|------|------|
| [INDEX.md](./INDEX.md) | 📖 文档导航 |
| [QUICKSTART.md](./QUICKSTART.md) | ⚡ 快速入门 |
| [README.md](./README.md) | 📚 完整文档 |
| [CHEATSHEET.md](./CHEATSHEET.md) | 🎯 命令速查 |

## 💡 提示

- 开发时用监听模式
- 发布前运行 check
- 定期清理构建产物

---

**更多信息**: [INDEX.md](./INDEX.md)
