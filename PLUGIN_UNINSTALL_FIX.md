# 插件卸载确认对话框修复

## 🐛 问题描述

用户反馈：点击删除插件还未确定就立即删除了

### 原因分析
原代码使用了浏览器原生的 `confirm()` 函数来显示确认对话框：
```javascript
if (!confirm(`确定要卸载插件 "${pluginName}" 吗？这将删除所有插件文件和配置。`)) {
  return
}
```

在 Tauri 应用环境中，原生的 `confirm()` 对话框可能：
1. 不会正常显示
2. 样式与应用不一致
3. 用户体验较差
4. 可能被浏览器阻止

## ✅ 修复方案

### 1. 使用 Vuetify 对话框组件
替换原生 `confirm()` 为 Vuetify 的 `v-dialog` 组件，提供更好的用户体验。

### 2. 改进的确认流程
```
用户点击"卸载插件" → 显示确认对话框 → 用户确认 → 执行卸载
```

### 3. 新增的响应式变量
```typescript
const uninstalling = ref(false)      // 卸载进行中状态
const uninstallDialog = ref(false)   // 对话框显示状态
const pluginToUninstall = ref('')    // 待卸载的插件名称
```

### 4. 重构的函数结构
```typescript
// 显示确认对话框
const uninstallPlugin = (pluginName: string) => {
  pluginToUninstall.value = pluginName
  uninstallDialog.value = true
}

// 取消卸载
const cancelUninstall = () => {
  uninstallDialog.value = false
  pluginToUninstall.value = ''
}

// 确认卸载
const confirmUninstall = async () => {
  // 执行实际的卸载逻辑
}
```

## 🎨 用户体验改进

### 1. 美观的确认对话框
- 使用 Material Design 图标
- 清晰的警告信息
- 结构化的风险提示

### 2. 详细的警告信息
```
警告：此操作将会：
• 删除所有插件文件
• 清除插件配置  
• 停止插件运行
此操作不可撤销！
```

### 3. 交互改进
- **持久化对话框** - 防止意外关闭
- **加载状态** - 卸载过程中显示加载动画
- **按钮禁用** - 卸载过程中禁用相关按钮
- **键盘快捷键** - ESC 取消，Enter 确认

### 4. 状态反馈
- 成功消息：`插件 "xxx" 卸载成功！`
- 错误消息：详细的错误信息
- 自动刷新插件列表

## 🔧 技术实现

### 对话框模板
```vue
<v-dialog 
  v-model="uninstallDialog" 
  max-width="500"
  persistent
  :disabled="uninstalling"
  @keydown.esc="cancelUninstall"
  @keydown.enter="confirmUninstall"
>
  <v-card>
    <v-card-title class="text-h6 d-flex align-center">
      <v-icon color="warning" class="mr-2">mdi-alert-circle</v-icon>
      确认卸载插件
    </v-card-title>
    
    <v-card-text class="pb-2">
      <p class="mb-4 text-body-1">
        确定要卸载插件 <strong class="text-error">"{{ pluginToUninstall }}"</strong> 吗？
      </p>
      
      <v-alert type="warning" variant="tonal" density="compact">
        <!-- 详细警告信息 -->
      </v-alert>
    </v-card-text>
    
    <v-card-actions>
      <v-btn @click="cancelUninstall" :disabled="uninstalling">取消</v-btn>
      <v-btn @click="confirmUninstall" :loading="uninstalling" color="error">
        确认卸载
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

### 卸载按钮
```vue
<v-btn
  @click="uninstallPlugin(plugin.name)"
  :disabled="uninstalling"
  color="error"
  variant="outlined"
  prepend-icon="mdi-delete"
  size="small"
>
  卸载插件
</v-btn>
```

## 🧪 测试场景

### 1. 正常卸载流程
1. 点击"卸载插件"按钮
2. 确认对话框正确显示
3. 点击"确认卸载"
4. 显示加载状态
5. 卸载成功后显示成功消息
6. 插件列表自动刷新

### 2. 取消卸载流程
1. 点击"卸载插件"按钮
2. 确认对话框显示
3. 点击"取消"或按 ESC 键
4. 对话框关闭，插件未被卸载

### 3. 错误处理
1. 网络错误或权限问题
2. 显示详细错误信息
3. 对话框关闭，状态重置

### 4. 并发保护
1. 卸载过程中其他按钮被禁用
2. 防止重复点击
3. 对话框在卸载过程中不能关闭

## 📊 修复效果

### 修复前
- ❌ 使用原生 `confirm()` 对话框
- ❌ 可能不显示或样式不一致
- ❌ 用户体验差
- ❌ 缺少详细警告信息

### 修复后
- ✅ 使用 Vuetify 对话框组件
- ✅ 样式统一，美观大方
- ✅ 用户体验优秀
- ✅ 详细的警告和状态反馈
- ✅ 支持键盘快捷键
- ✅ 完善的错误处理

## 🎯 用户反馈预期

修复后，用户将体验到：
1. **明确的确认流程** - 不会再出现意外删除
2. **清晰的风险提示** - 用户充分了解操作后果
3. **流畅的交互体验** - 现代化的对话框界面
4. **及时的状态反馈** - 操作结果清晰可见

---

**修复完成！现在插件卸载需要用户明确确认，避免了意外删除的问题。** 🎉