# 插件通用 API 设计

## 设计原则

**核心原则：插件系统不应该修改主项目源码**

插件加载器提供一套通用的 API，让插件可以实现各种功能，而无需主项目为特定插件添加专门的代码。

## 通用 API 列表

### 1. HTTP 请求

```typescript
context.fetch(url: string, options?: RequestInit): Promise<Response>
```

插件可以直接发起 HTTP 请求，无需主项目提供专门的网络接口。

**示例：搜索 B站装扮**
```typescript
const response = await context.fetch(
  `https://api.bilibili.com/x/garb/v2/mall/home/search?key_word=${keyword}`
)
const data = await response.json()
```

### 2. 文件系统操作

```typescript
context.fs.readDir(path: string): Promise<FileEntry[]>
context.fs.readFile(path: string): Promise<string>
context.fs.writeFile(path: string, content: string | Uint8Array): Promise<void>
context.fs.exists(path: string): Promise<boolean>
context.fs.mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
context.fs.remove(path: string): Promise<void>
```

插件可以读写文件，管理自己的数据。

**示例：扫描表情包目录**
```typescript
const appDataDir = await context.getAppDataDir()
const emojiDir = `${appDataDir}/emojis`

const categories = await context.fs.readDir(emojiDir)
for (const category of categories) {
  if (category.isDirectory) {
    const files = await context.fs.readDir(`${emojiDir}/${category.name}`)
    // 处理文件...
  }
}
```

### 3. 应用目录

```typescript
context.getAppDataDir(): Promise<string>
```

获取应用数据目录，插件可以在此存储数据。

**示例：创建插件数据目录**
```typescript
const appDataDir = await context.getAppDataDir()
const pluginDir = `${appDataDir}/my-plugin-data`
await context.fs.mkdir(pluginDir, { recursive: true })
```

### 4. Tauri 命令（可选）

```typescript
context.invokeTauri<T>(command: string, args?: Record<string, any>): Promise<T>
```

如果需要调用主项目已有的 Tauri 命令（如系统级功能），可以使用此 API。

## 实际案例：bilibili-emoji 插件

### 之前的错误做法 ❌

```rust
// 在主项目中添加专门的命令
#[command]
pub async fn plugin_bilibili_emoji_scan() { ... }

#[command]
pub async fn plugin_bilibili_emoji_search() { ... }

#[command]
pub async fn plugin_bilibili_emoji_download() { ... }
```

**问题：**
- 违背了"不修改主项目源码"的原则
- 每个插件都需要修改主项目
- 无法热加载
- 耦合度高

### 正确的做法 ✅

```typescript
// 插件完全使用通用 API 实现

// 1. 扫描本地表情包
const scanEmojis = async () => {
  const appDataDir = await context.getAppDataDir()
  const emojiDir = `${appDataDir}/emojis`
  
  const categories = await context.fs.readDir(emojiDir)
  // 使用文件系统 API 扫描...
}

// 2. 搜索 B站装扮
const searchSuits = async (keyword: string) => {
  const url = `https://api.bilibili.com/x/garb/v2/mall/home/search?key_word=${keyword}`
  const response = await context.fetch(url)
  const data = await response.json()
  // 使用 HTTP API 搜索...
}

// 3. 下载装扮
const downloadSuit = async (suitId: number) => {
  // 获取装扮信息
  const response = await context.fetch(`https://api.bilibili.com/...`)
  const data = await response.json()
  
  // 下载文件
  const fileResponse = await context.fetch(fileUrl)
  const blob = await fileResponse.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  // 保存文件
  await context.fs.writeFile(filePath, uint8Array)
}
```

**优势：**
- ✅ 主项目零修改
- ✅ 完全热加载
- ✅ 插件独立
- ✅ 可扩展

## API 设计哲学

### 1. 通用性优先

提供通用的底层 API（HTTP、文件系统），而不是特定功能的高层 API。

```typescript
// ❌ 不好：特定功能
context.downloadBilibiliSuit(id)

// ✅ 好：通用能力
context.fetch(url)
context.fs.writeFile(path, data)
```

### 2. 最小权限原则

插件只能访问自己的数据目录和公开的 API。

```typescript
// ✅ 允许：访问应用数据目录
const appDataDir = await context.getAppDataDir()
const pluginDir = `${appDataDir}/my-plugin`

// ❌ 禁止：访问系统敏感目录
// 通过权限系统控制
```

### 3. 声明式配置

插件通过 manifest 声明需要的权限。

```json
{
  "permissions": [
    "network",
    "filesystem:read",
    "filesystem:write"
  ]
}
```

## 扩展新功能

如果插件需要新的通用能力，应该：

1. **评估通用性**：这个能力是否对多个插件有用？
2. **添加到加载器**：在 `PluginContext` 中添加通用 API
3. **保持简单**：API 应该是底层的、通用的

### 示例：添加剪贴板 API

```typescript
// 在 PluginContext 中添加
interface PluginContext {
  // ... 其他 API
  
  clipboard: {
    readText(): Promise<string>
    writeText(text: string): Promise<void>
    readImage(): Promise<Uint8Array>
    writeImage(data: Uint8Array): Promise<void>
  }
}
```

这样所有插件都可以使用剪贴板功能，而不需要每个插件都实现一遍。

## 总结

| 方面 | 专用命令 | 通用 API |
|------|---------|---------|
| 主项目修改 | ❌ 需要 | ✅ 不需要 |
| 热加载 | ❌ 困难 | ✅ 简单 |
| 可扩展性 | ❌ 低 | ✅ 高 |
| 维护成本 | ❌ 高 | ✅ 低 |
| 插件独立性 | ❌ 差 | ✅ 好 |

**结论：插件应该使用通用 API 实现功能，而不是让主项目为每个插件添加专门的代码。**
