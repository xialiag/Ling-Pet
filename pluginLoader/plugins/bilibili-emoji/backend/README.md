# Bilibili Emoji Plugin Backend

这是 Bilibili Emoji 插件的 Rust 后端，作为动态库被主应用加载。

## 功能

- 扫描本地表情包目录
- 搜索 B 站表情包装扮
- 下载表情包到本地

## 构建

### 前提条件
- Rust 工具链（1.70+）
- Cargo

### 构建命令

```bash
# 开发构建
cargo build

# 发布构建（优化）
cargo build --release
```

### 输出

编译后的动态库位于：
- Windows: `target/release/plugin.dll`
- macOS: `target/release/libplugin.dylib`
- Linux: `target/release/libplugin.so`

## API

### 初始化

```c
void plugin_init();
```

插件加载时调用。

### 清理

```c
void plugin_cleanup();
```

插件卸载时调用。

### 扫描表情包

```c
char* scan_emojis(const char* emoji_dir_json);
```

**参数**:
- `emoji_dir_json`: 表情包目录路径的 JSON 字符串，例如：`"C:\\Users\\...\\emojis"`

**返回**:
- 表情包列表的 JSON 字符串

**示例**:
```json
[
  {
    "name": "开心",
    "path": "C:\\Users\\...\\emojis\\happy.png",
    "type": "static",
    "category": "基础表情"
  }
]
```

### 搜索装扮

```c
char* search_bilibili_suits(const char* keyword_json);
```

**参数**:
- `keyword_json`: 搜索关键词的 JSON 字符串，例如：`"鸽宝"`

**返回**:
- 搜索结果的 JSON 字符串

**示例**:
```json
{
  "suits": [
    {
      "id": 114156001,
      "name": "鸽宝表情包",
      "type": "normal",
      "item_count": 20
    }
  ]
}
```

### 下载装扮

```c
char* download_suit(const char* params_json);
```

**参数**:
- `params_json`: 下载参数的 JSON 字符串

**参数格式**:
```json
{
  "suit_id": 114156001,
  "suit_type": "normal",
  "lottery_id": null,
  "target_dir": "C:\\Users\\...\\emojis"
}
```

**返回**:
- 下载结果的 JSON 字符串

**示例**:
```json
{
  "success": true,
  "count": 20,
  "category": "suit_114156001"
}
```

### 释放内存

```c
void free_string(char* ptr);
```

释放由插件分配的字符串内存。

## 集成

### 主应用集成

主应用需要：

1. 加载动态库
2. 获取函数指针
3. 调用函数
4. 释放返回的字符串

**示例（Rust）**:

```rust
use libloading::{Library, Symbol};

// 加载动态库
let lib = unsafe { Library::new("plugin.dll")? };

// 获取函数
let plugin_init: Symbol<unsafe extern "C" fn()> = 
    unsafe { lib.get(b"plugin_init")? };

let scan_emojis: Symbol<unsafe extern "C" fn(*const i8) -> *mut i8> = 
    unsafe { lib.get(b"scan_emojis")? };

let free_string: Symbol<unsafe extern "C" fn(*mut i8)> = 
    unsafe { lib.get(b"free_string")? };

// 初始化插件
unsafe { plugin_init() };

// 调用函数
let dir_json = CString::new(r#""C:\Users\...\emojis""#)?;
let result_ptr = unsafe { scan_emojis(dir_json.as_ptr()) };

// 读取结果
let result_str = unsafe { CStr::from_ptr(result_ptr).to_str()? };
println!("Result: {}", result_str);

// 释放内存
unsafe { free_string(result_ptr) };
```

### 前端集成

前端通过 Tauri 命令调用：

```typescript
// 扫描表情包
const emojis = await context.invokeTauri('plugin_bilibili_emoji_scan', {
    emojiDir: 'C:\\Users\\...\\emojis'
});

// 搜索装扮
const result = await context.invokeTauri('plugin_bilibili_emoji_search', {
    keyword: '鸽宝'
});

// 下载装扮
const download = await context.invokeTauri('plugin_bilibili_emoji_download', {
    suitId: 114156001,
    suitType: 'normal',
    targetDir: 'C:\\Users\\...\\emojis'
});
```

## 热加载

插件支持热加载：

1. **加载**: 主应用调用 `plugin_init()`
2. **使用**: 调用各种功能函数
3. **卸载**: 主应用调用 `plugin_cleanup()`，然后卸载动态库

## 开发

### 添加新功能

1. 在 `lib.rs` 中添加新的 `extern "C"` 函数
2. 实现功能逻辑
3. 更新文档

### 测试

```bash
cargo test
```

### 调试

```bash
# 启用调试信息
cargo build --release --features debug

# 查看符号
# Windows
dumpbin /EXPORTS target/release/plugin.dll

# Linux/macOS
nm -D target/release/libplugin.so
```

## 注意事项

1. **内存管理**: 所有返回的字符串必须用 `free_string` 释放
2. **线程安全**: 当前实现不是线程安全的，如需并发调用需要添加锁
3. **错误处理**: 所有错误都通过 JSON 返回，格式为 `{"error": "..."}`
4. **编码**: 所有字符串使用 UTF-8 编码

## 许可证

MIT
