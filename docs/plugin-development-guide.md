# 插件开发完整指南

## 一、快速开始

### 1.1 环境准备

```bash
# 安装依赖
npm install

# 安装Rust（如果需要开发后端）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 1.2 创建第一个插件

```bash
# 进入插件加载器目录
cd pluginLoader

# 创建插件
node tools/plugin-cli.js create hello-world

# 目录结构
plugins/hello-world/
├── manifest.json
├── index.ts
├── icon.txt
└── README.md
```

### 1.3 编写插件代码

```typescript
// plugins/hello-world/index.ts
import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: 'hello-world',
  version: '1.0.0',
  description: '我的第一个插件',
  
  async onLoad(context: PluginContext) {
    context.debug('Hello World 插件已加载！')
    
    // 添加一个简单的路由
    context.addRoute({
      path: '/hello',
      name: 'Hello',
      component: {
        template: '<div>Hello from Plugin!</div>'
      }
    })
    
    // Hook聊天窗口
    context.hookComponent('ChatWindow', {
      mounted(instance) {
        context.debug('聊天窗口已挂载')
      }
    })
  },
  
  async onUnload(context: PluginContext) {
    context.debug('Hello World 插件已卸载')
  }
})
```

### 1.4 构建和测试

```bash
# 构建插件
node tools/plugin-cli.js build hello-world

# 验证插件
node tools/plugin-cli.js validate hello-world

# 测试加载
node tools/plugin-cli.js test
```

## 二、实战案例

### 案例1：消息增强插件

为聊天消息添加表情反应功能。

```typescript
// plugins/message-reactions/index.ts
import { definePlugin } from '../../core/pluginApi'
import { h } from 'vue'

export default definePlugin({
  name: 'message-reactions',
  version: '1.0.0',
  description: '为消息添加表情反应',
  
  async onLoad(context) {
    // 1. Hook消息组件
    context.hookComponent('MessageItem', {
      mounted(instance) {
        // 添加反应按钮
        const addReactionButton = () => {
          // 实现逻辑
        }
      }
    })
    
    // 2. Hook消息Store
    const chatStore = context.getStore('chatStore')
    if (chatStore) {
      context.hookStore('chatStore', {
        afterAction(name, args, result) {
          if (name === 'addMessage') {
            // 为新消息初始化反应数据
            const message = args[0]
            message.reactions = []
          }
        }
      })
    }
    
    // 3. 注入反应面板组件
    const ReactionPanel = {
      template: `
        <div class="reaction-panel">
          <button @click="addReaction('👍')">👍</button>
          <button @click="addReaction('❤️')">❤️</button>
          <button @click="addReaction('😂')">😂</button>
        </div>
      `,
      methods: {
        addReaction(emoji: string) {
          context.debug('添加反应:', emoji)
          // 实现添加反应逻辑
        }
      }
    }
    
    context.injectComponent('MessageItem', ReactionPanel, {
      position: 'after'
    })
  }
})
```

### 案例2：主题切换插件

提供多种主题切换功能。

```typescript
// plugins/theme-switcher/index.ts
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
  name: 'theme-switcher',
  version: '1.0.0',
  description: '主题切换插件',
  
  configSchema: {
    defaultTheme: {
      type: 'string',
      default: 'light',
      enum: ['light', 'dark', 'auto']
    },
    customColors: {
      type: 'object',
      default: {}
    }
  },
  
  async onLoad(context) {
    // 读取配置
    const defaultTheme = context.getConfig('defaultTheme', 'light')
    
    // 应用主题
    const applyTheme = (theme: string) => {
      document.documentElement.setAttribute('data-theme', theme)
      context.debug('主题已切换:', theme)
    }
    
    applyTheme(defaultTheme)
    
    // 添加主题切换页面
    const ThemeSwitcher = {
      template: `
        <div class="theme-switcher">
          <h2>主题设置</h2>
          <select v-model="currentTheme" @change="changeTheme">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="auto">自动</option>
          </select>
        </div>
      `,
      data() {
        return {
          currentTheme: defaultTheme
        }
      },
      methods: {
        changeTheme() {
          applyTheme(this.currentTheme)
          context.setConfig('defaultTheme', this.currentTheme)
        }
      }
    }
    
    context.addRoute({
      path: '/settings/theme',
      name: 'ThemeSettings',
      component: ThemeSwitcher
    })
    
    // 注入主题切换按钮到设置页面
    const ThemeButton = {
      template: `
        <button @click="toggleTheme">
          {{ isDark ? '🌙' : '☀️' }} 切换主题
        </button>
      `,
      data() {
        return {
          isDark: defaultTheme === 'dark'
        }
      },
      methods: {
        toggleTheme() {
          this.isDark = !this.isDark
          const newTheme = this.isDark ? 'dark' : 'light'
          applyTheme(newTheme)
          context.setConfig('defaultTheme', newTheme)
        }
      }
    }
    
    context.injectComponent('SettingsPage', ThemeButton, {
      position: 'before'
    })
  }
})
```

### 案例3：数据统计插件（带后端）

统计用户的聊天数据。

**前端代码：**
```typescript
// plugins/chat-stats/index.ts
import { definePlugin } from '../../core/pluginApi'

export default definePlugin({
  name: 'chat-stats',
  version: '1.0.0',
  description: '聊天数据统计',
  
  async onLoad(context) {
    // Hook消息发送
    context.hookStore('chatStore', {
      afterAction(name, args, result) {
        if (name === 'sendMessage') {
          // 调用后端记录消息
          context.invokeTauri('plugin:chat-stats|record_message', {
            message: args[0],
            timestamp: Date.now()
          }).catch(err => {
            context.debug('记录消息失败:', err)
          })
        }
      }
    })
    
    // 添加统计页面
    const StatsPage = {
      template: `
        <div class="stats-page">
          <h2>聊天统计</h2>
          <div v-if="loading">加载中...</div>
          <div v-else>
            <p>总消息数: {{ stats.totalMessages }}</p>
            <p>今日消息: {{ stats.todayMessages }}</p>
            <p>平均每日: {{ stats.avgPerDay }}</p>
          </div>
        </div>
      `,
      data() {
        return {
          loading: true,
          stats: {}
        }
      },
      async mounted() {
        try {
          this.stats = await context.invokeTauri('plugin:chat-stats|get_statistics')
        } catch (error) {
          context.debug('获取统计失败:', error)
        } finally {
          this.loading = false
        }
      }
    }
    
    context.addRoute({
      path: '/stats',
      name: 'ChatStats',
      component: StatsPage
    })
  }
})
```

**后端代码：**
```rust
// plugins/chat-stats/backend/src/lib.rs
use tauri::{command, AppHandle, Runtime, Manager};
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, Result};
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
struct MessageRecord {
    message: String,
    timestamp: i64,
}

#[derive(Serialize)]
struct Statistics {
    total_messages: i64,
    today_messages: i64,
    avg_per_day: f64,
}

fn get_db_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path_resolver()
        .app_data_dir()
        .unwrap()
        .join("chat_stats.db")
}

fn init_db<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let conn = Connection::open(get_db_path(app))?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )",
        [],
    )?;
    
    Ok(())
}

#[command]
fn record_message<R: Runtime>(
    app: AppHandle<R>,
    message: String,
    timestamp: i64,
) -> Result<(), String> {
    let conn = Connection::open(get_db_path(&app))
        .map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO messages (message, timestamp) VALUES (?1, ?2)",
        [&message, &timestamp.to_string()],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
fn get_statistics<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Statistics, String> {
    let conn = Connection::open(get_db_path(&app))
        .map_err(|e| e.to_string())?;
    
    // 总消息数
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM messages",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // 今日消息数
    let today_start = chrono::Local::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .timestamp_millis();
    
    let today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM messages WHERE timestamp >= ?1",
        [today_start],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // 平均每日
    let first_timestamp: Option<i64> = conn.query_row(
        "SELECT MIN(timestamp) FROM messages",
        [],
        |row| row.get(0)
    ).ok();
    
    let avg = if let Some(first) = first_timestamp {
        let days = (chrono::Local::now().timestamp_millis() - first) / (1000 * 60 * 60 * 24);
        if days > 0 {
            total as f64 / days as f64
        } else {
            total as f64
        }
    } else {
        0.0
    };
    
    Ok(Statistics {
        total_messages: total,
        today_messages: today,
        avg_per_day: avg,
    })
}

#[no_mangle]
pub extern "C" fn plugin_init<R: Runtime>(app: AppHandle<R>) -> Vec<String> {
    println!("[ChatStats] 初始化插件");
    
    // 初始化数据库
    if let Err(e) = init_db(&app) {
        eprintln!("[ChatStats] 数据库初始化失败: {}", e);
    }
    
    // 注册命令
    app.plugin(
        tauri::plugin::Builder::new("chat-stats")
            .invoke_handler(tauri::generate_handler![
                record_message,
                get_statistics,
            ])
            .build()
    ).expect("无法注册插件");
    
    vec![
        "record_message".to_string(),
        "get_statistics".to_string(),
    ]
}
```

## 三、API参考

### 3.1 PluginContext API

```typescript
interface PluginContext {
  // Vue核心
  app: App                                    // Vue应用实例
  router: Router                              // Vue Router实例
  getStore: (name: string) => Store           // 获取Pinia Store
  
  // Hook API
  hookComponent: (name, hooks) => UnhookFn    // Hook组件生命周期
  hookStore: (name, hooks) => UnhookFn        // Hook Store actions
  hookService: (path, func, hooks) => UnhookFn // Hook服务函数
  
  // 组件操作
  injectComponent: (target, component, options) => UnhookFn  // 注入组件
  wrapComponent: (name, wrapper) => UnhookFn                 // 包装组件
  
  // 路由
  addRoute: (route) => void                   // 添加路由
  
  // 配置
  getConfig: <T>(key, default?) => T          // 读取配置
  setConfig: (key, value) => Promise<void>    // 保存配置
  
  // Tauri命令
  invokeTauri: <T>(cmd, args?) => Promise<T>  // 调用Tauri命令
  
  // 工具
  debug: (...args) => void                    // 调试日志
}
```

### 3.2 Hook类型

```typescript
// 组件Hook
interface ComponentHooks {
  beforeMount?: (instance) => void
  mounted?: (instance) => void
  beforeUpdate?: (instance) => void
  updated?: (instance) => void
  beforeUnmount?: (instance) => void
  unmounted?: (instance) => void
}

// Store Hook
interface StoreHooks {
  beforeAction?: (name, args) => void | false  // 返回false阻止执行
  afterAction?: (name, args, result) => void
  onStateChange?: (state, oldState) => void
}

// 服务Hook
interface ServiceHooks {
  before?: (...args) => any[] | void          // 修改参数
  after?: (result, ...args) => any            // 修改返回值
  replace?: (...args) => any                  // 完全替换
  onError?: (error, ...args) => void
}
```

### 3.3 组件注入选项

```typescript
interface InjectOptions {
  position?: 'before' | 'after' | 'replace'   // 注入位置
  props?: Record<string, any>                 // 传递props
  condition?: () => boolean                   // 条件渲染
}
```

## 四、最佳实践

### 4.1 错误处理

```typescript
async onLoad(context) {
  try {
    // 可能失败的操作
    await context.invokeTauri('some_command')
  } catch (error) {
    context.debug('操作失败:', error)
    // 降级处理
  }
}
```

### 4.2 资源清理

```typescript
async onLoad(context) {
  // 保存unhook函数
  const unhooks: Array<() => void> = []
  
  unhooks.push(context.hookComponent('MyComponent', {
    mounted() { /* ... */ }
  }))
  
  unhooks.push(context.hookStore('myStore', {
    afterAction() { /* ... */ }
  }))
  
  // 在卸载时清理
  return () => {
    unhooks.forEach(fn => fn())
  }
}
```

### 4.3 性能优化

```typescript
// 使用防抖
import { debounce } from 'lodash'

const debouncedHandler = debounce((data) => {
  // 处理逻辑
}, 300)

context.hookStore('chatStore', {
  onStateChange(state) {
    debouncedHandler(state)
  }
})
```

### 4.4 类型安全

```typescript
// 定义类型
interface MyPluginConfig {
  apiKey: string
  enabled: boolean
}

// 使用类型
const config = context.getConfig<MyPluginConfig>('myConfig', {
  apiKey: '',
  enabled: true
})
```

## 五、调试技巧

### 5.1 使用调试日志

```typescript
context.debug('变量值:', someVariable)
context.debug('执行到这里')
```

### 5.2 检查Hook是否生效

```typescript
context.hookComponent('MyComponent', {
  mounted(instance) {
    context.debug('MyComponent已挂载', instance)
    console.trace() // 打印调用栈
  }
})
```

### 5.3 监控性能

```typescript
const start = performance.now()
// 执行操作
const duration = performance.now() - start
context.debug(`操作耗时: ${duration}ms`)
```

## 六、常见问题

### Q1: Hook不生效？

**A:** 检查组件/Store名称是否正确，使用符号扫描器生成的名称。

### Q2: 后端命令调用失败？

**A:** 检查命令名称格式：`plugin:<plugin-name>|<command-name>`

### Q3: 插件加载失败？

**A:** 查看控制台错误信息，检查manifest.json格式。

### Q4: 如何调试后端代码？

**A:** 在Rust代码中使用`println!`，查看Tauri控制台输出。

## 七、发布插件

### 7.1 准备发布

```bash
# 1. 更新版本号
# 编辑 manifest.json

# 2. 构建
node tools/plugin-cli.js build my-plugin

# 3. 验证
node tools/plugin-cli.js validate my-plugin

# 4. 打包
node tools/plugin-cli.js package my-plugin
```

### 7.2 编写文档

在README.md中包含：
- 功能描述
- 安装方法
- 使用说明
- 配置选项
- 常见问题

### 7.3 测试清单

- [ ] 插件能正常加载
- [ ] 插件能正常卸载
- [ ] Hook功能正常
- [ ] 后端命令正常
- [ ] 配置保存/读取正常
- [ ] 错误处理完善
- [ ] 性能可接受
- [ ] 文档完整

## 八、资源链接

- [插件架构设计](./plugin-architecture.md)
- [后端实现指南](./plugin-backend-implementation.md)
- [API文档](../pluginLoader/types/api.ts)
- [示例插件](../pluginLoader/plugins/)
