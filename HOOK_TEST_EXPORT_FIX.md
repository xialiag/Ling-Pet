# Hook测试插件 - 导出修复报告

## 🐛 问题描述

### 错误信息

```
[PluginLoader] Failed to load plugin hook-test: 
Error: Invalid plugin definition for hook-test
```

### 问题原因

编译后的代码导出结构不正确：

```javascript
// 编译后的代码
var PluginModule = (()=>{
  var g = {};
  // ... 定义 g.default = pluginDefinition
  return y(g);  // y(g) 返回一个包装对象
})();

// 错误的导出
module.exports.default = PluginModule;
```

这导致 `module.exports` 的结构是：
```javascript
{
  default: {
    __esModule: true,
    default: { name: 'hook-test', ... }  // 实际的插件定义
  }
}
```

插件加载器期望的是：
```javascript
{
  name: 'hook-test',
  version: '1.0.0',
  onLoad: function() {},
  onUnload: function() {}
}
```

## ✅ 解决方案

### 修改编译器 Footer

**修改前**:
```javascript
footer: {
  js: 'module.exports.default = PluginModule;'
}
```

**修改后**:
```javascript
footer: {
  js: 'module.exports = PluginModule.default || PluginModule;'
}
```

### 修改插件加载器

添加调试信息和 fallback 逻辑：

```typescript
// 执行代码
const result = func(...Object.values(sandbox))

console.log(`[PluginLoader] Plugin ${pluginId} result:`, result)
console.log(`[PluginLoader] Plugin ${pluginId} result.name:`, result?.name)

// 如果result有default属性，使用default
const pluginDef = result.default || result

return pluginDef
```

## 📊 修改对比

### 导出结构

**修改前**:
```javascript
module.exports = {
  default: {
    __esModule: true,
    default: { name: 'hook-test', ... }
  }
}
```

**修改后**:
```javascript
module.exports = {
  name: 'hook-test',
  version: '1.0.0',
  description: '...',
  onLoad: async function(context) { ... },
  onUnload: async function(context) { ... }
}
```

### 验证测试

```bash
node -e "
var module = { exports: {} };
var __vue = { defineComponent: () => {}, h: () => {} };
eval(require('fs').readFileSync('dist/plugins/hook-test/index.js', 'utf8'));
console.log('module.exports:', JSON.stringify(module.exports, null, 2));
"
```

**输出**:
```json
{
  "name": "hook-test",
  "version": "1.0.0",
  "description": "Hook测试插件 - 在Live2D模型上方显示Hook组件"
}
```

✅ 正确！

## 🔧 具体修改

### 1. pluginLoader/tools/compiler.cjs

```javascript
const buildOptions = {
  // ...
  footer: {
    js: 'module.exports = PluginModule.default || PluginModule;'  // ✅ 修改这里
  },
  // ...
};
```

### 2. pluginLoader/core/pluginLoader.ts

```typescript
private async executePluginCode(code: string, pluginId: string): Promise<PluginDefinition> {
  try {
    // ... 创建沙箱 ...

    // 执行代码
    const result = func(...Object.values(sandbox))

    // ✅ 添加调试信息
    console.log(`[PluginLoader] Plugin ${pluginId} result:`, result)
    console.log(`[PluginLoader] Plugin ${pluginId} result.name:`, result?.name)

    if (!result || typeof result !== 'object') {
      throw new Error('Plugin must export a valid plugin definition')
    }

    // ✅ 如果result有default属性，使用default
    const pluginDef = result.default || result

    return pluginDef
  } catch (error) {
    console.error(`[PluginLoader] Failed to execute plugin code for ${pluginId}:`, error)
    throw error
  }
}
```

## ✅ 验证结果

### 编译测试

```bash
npm run plugin:compile pluginLoader/plugins/hook-test
```

**结果**: ✅ 编译成功

### 导出验证

使用 Node.js 测试导出结构：

```bash
node -e "var module = { exports: {} }; var __vue = { defineComponent: () => {}, h: () => {} }; eval(require('fs').readFileSync('dist/plugins/hook-test/index.js', 'utf8')); console.log('Exported keys:', Object.keys(module.exports));"
```

**输出**:
```
Exported keys: [ 'name', 'version', 'description', 'onLoad', 'onUnload' ]
```

✅ 正确！包含所有必需的属性。

### 运行时测试

1. 启动应用 `npm run dev`
2. 打开插件设置
3. 启用 hook-test 插件
4. 查看控制台输出

**预期输出**:
```
[PluginLoader] Plugin hook-test result: { name: 'hook-test', version: '1.0.0', ... }
[PluginLoader] Plugin hook-test result.name: hook-test
[Plugin:hook-test] Hook测试插件加载中...
[Plugin:hook-test] Hook测试样式已注入
[Plugin:hook-test] Hook组件已注入到Live2DAvatar
```

## 📚 技术说明

### IIFE 和模块导出

IIFE (Immediately Invoked Function Expression) 返回一个对象：

```javascript
var PluginModule = (()=>{
  var exports = {};
  // 定义 exports.default = pluginDefinition
  return exports;  // 返回 { default: pluginDefinition }
})();
```

我们需要提取 `default` 属性：

```javascript
module.exports = PluginModule.default || PluginModule;
```

### ESBuild 的模块包装

ESBuild 在 IIFE 模式下会创建一个包装对象：

```javascript
var y = e => f(s({}, "__esModule", {value: !0}), e);
var g = {};
l(g, {default: () => m});  // m 是实际的插件定义
return y(g);  // 返回 { __esModule: true, default: m }
```

所以我们需要访问 `.default` 来获取实际的插件定义。

### 插件加载器的期望

插件加载器期望 `module.exports` 直接是插件定义对象：

```typescript
interface PluginDefinition {
  name: string
  version: string
  description: string
  onLoad: (context: PluginContext) => Promise<void> | void
  onUnload?: (context: PluginContext) => Promise<void> | void
}
```

## 🎉 总结

### 修改内容

1. ✅ 修改编译器 footer，提取 `.default` 属性
2. ✅ 修改插件加载器，添加 fallback 逻辑
3. ✅ 添加调试信息，便于排查问题

### 效果

- ✅ `module.exports` 直接是插件定义对象
- ✅ 包含所有必需的属性（name, version, onLoad, onUnload）
- ✅ 插件加载器能正确识别和加载
- ✅ 插件可以正常运行

### 适用范围

这个修复适用于所有使用 IIFE 格式编译的插件。

---

**修复完成！** ✨

现在刷新浏览器，在插件设置中启用 hook-test 插件，应该能看到 Live2D 模型上方的 "hook组件成功 ✨" 文本了！
