# Hook测试插件 - 视觉效果指南

## 🎨 预期效果

### 布局示意

```
┌─────────────────────────────────────┐
│                                     │
│     ┌─────────────────────┐        │
│     │ hook组件成功 ✨    │  ← 注入的组件
│     └─────────────────────┘        │
│                                     │
│                                     │
│          ╭─────╮                   │
│         ╱       ╲                  │
│        │  Live2D │  ← 原始组件     │
│        │  Model  │                 │
│         ╲       ╱                  │
│          ╰─────╯                   │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 组件层级

```
Live2DAvatar (父容器)
├── HookSuccessComponent (注入的组件, position: before)
│   └── div (紫色渐变文本框)
│       └── "hook组件成功 ✨"
│
└── Live2DAvatar原始内容
    ├── thinking-bubble (思考气泡)
    ├── live2d-container (模型容器)
    │   └── canvas (Live2D画布)
    └── avatar-loading (加载状态)
```

## 🎯 位置说明

### 绝对定位

```css
position: absolute;
top: 5%;              /* 距离顶部5% */
left: 50%;            /* 距离左侧50% */
transform: translateX(-50%);  /* 水平居中 */
z-index: 100;         /* 在模型上方 */
```

### 视觉位置

```
     0%
      ↓
┌─────────────────┐
│                 │
│  5% ← 这里      │  ← Hook组件位置
│                 │
│                 │
│     模型        │
│                 │
│                 │
└─────────────────┘
```

## 🌈 样式详解

### 背景渐变

```
#667eea (左上) ──────→ #764ba2 (右下)
  蓝紫色                深紫色

渐变方向: 135度 (左上到右下)
```

### 阴影效果

```
box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4)
            │  │   │   └─ 颜色 (紫色, 40%透明度)
            │  │   └───── 模糊半径 (15px)
            │  └───────── 垂直偏移 (4px)
            └──────────── 水平偏移 (0px)
```

### 圆角

```
border-radius: 12px

┌─────────┐
│         │  ← 12px圆角
└─────────┘
```

## 🎬 动画效果

### 淡入动画 (hookFadeIn)

```
时间轴: 0s ──────────────→ 0.5s

初始状态 (from):
  opacity: 0              (完全透明)
  translateY: -20px       (向上偏移20px)

最终状态 (to):
  opacity: 1              (完全不透明)
  translateY: 0           (正常位置)

效果: 从上方20px处淡入并滑下
```

### 动画曲线

```
ease-out: 快速开始，缓慢结束

速度
 ↑
 │ ╲
 │  ╲___
 │      ────
 └──────────→ 时间
 0s        0.5s
```

## 📐 尺寸说明

### 内边距

```
padding: 12px 24px
         ↑    ↑
         │    └─ 左右: 24px
         └────── 上下: 12px

┌────────────────────┐
│ ↕12px              │
│ ↔24px 文本 ↔24px  │
│ ↕12px              │
└────────────────────┘
```

### 字体

```
font-size: 16px
font-weight: bold
color: white
text-align: center
white-space: nowrap  (不换行)
```

## 🎨 颜色方案

### 主色调

```
背景渐变:
  起始: #667eea (RGB: 102, 126, 234) - 蓝紫色
  结束: #764ba2 (RGB: 118, 75, 162)  - 深紫色

文字: #ffffff (白色)

阴影: rgba(102, 126, 234, 0.4) - 半透明蓝紫色
```

### 色彩搭配

```
┌─────────────────────┐
│ #667eea → #764ba2  │ ← 渐变背景
│                     │
│   #ffffff 文字      │ ← 白色文字
│                     │
└─────────────────────┘
      ↓
  rgba(102,126,234,0.4) ← 阴影
```

## 🖱️ 交互说明

### 鼠标事件

```css
pointer-events: none;
```

**效果**: 鼠标事件穿透，不阻挡下方的Live2D模型

```
鼠标点击
    ↓
┌─────────┐
│ Hook组件│ ← 穿透
└─────────┘
    ↓
  Live2D模型 ← 接收点击
```

## 📱 响应式

### 相对定位

组件使用百分比定位，会随着父容器大小自动调整：

```
父容器宽度: 100%
  ↓
Hook组件: left: 50% (始终居中)

父容器高度: 100%
  ↓
Hook组件: top: 5% (始终在顶部5%)
```

## 🔍 调试视图

### 浏览器开发者工具

在Elements面板中可以看到：

```html
<div class="live2d-wrapper">
  <!-- 注入的Hook组件 -->
  <div style="position: absolute; top: 5%; ...">
    hook组件成功 ✨
  </div>
  
  <!-- 原始Live2D组件 -->
  <div class="thinking-bubble">...</div>
  <div class="live2d-container">
    <canvas class="live2d-canvas"></canvas>
  </div>
</div>
```

### 样式检查

在Styles面板中可以看到：

```css
element.style {
  position: absolute;
  top: 5%;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* ... 其他样式 */
}
```

## 🎯 成功标志

如果看到以下效果，说明插件工作正常：

✅ 在Live2D模型上方有一个紫色渐变的文本框
✅ 文本框显示"hook组件成功 ✨"
✅ 文本框水平居中
✅ 有淡入动画效果
✅ 有柔和的紫色阴影
✅ 不阻挡对Live2D模型的点击

## 📸 截图位置

建议截图区域：

```
┌─────────────────────────┐
│ ← 包含这个区域          │
│                         │
│   Hook组件              │
│                         │
│   Live2D模型            │
│                         │
│                         │
└─────────────────────────┘
```

## 🎨 自定义建议

### 修改位置

```typescript
// 改为底部
top: '5%'  →  bottom: '5%'

// 改为左侧
left: '50%'  →  left: '10%'
transform: 'translateX(-50%)'  →  transform: 'none'
```

### 修改颜色

```typescript
// 改为蓝色渐变
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
         ↓
background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'

// 改为红色渐变
background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'

// 改为绿色渐变
background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
```

### 修改大小

```typescript
// 更大的文字
fontSize: '16px'  →  fontSize: '20px'

// 更多内边距
padding: '12px 24px'  →  padding: '16px 32px'
```

### 修改动画

```typescript
// 更慢的动画
animation: 'hookFadeIn 0.5s ease-out'
        ↓
animation: 'hookFadeIn 1s ease-out'

// 从下方滑入
translateY(-20px)  →  translateY(20px)
```

---

**享受你的Hook组件吧！** ✨
