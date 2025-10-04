# B站表情包插件 v3.0 升级指南

## 升级目标

1. **全量下载**：下载装扮的所有资源到临时目录
2. **智能提取**：从下载的资源中智能识别并提取表情包
3. **DLC支持**：完整支持DLC装扮下载
4. **兼容性**：确保能扫描到所有不同结构的表情包

## 核心改动

### 1. 下载流程改进

**旧流程**：
```
搜索装扮 → 只下载emoji_package → 保存到emojis目录
```

**新流程**：
```
搜索装扮 → 全量下载所有资源到temp目录 → 智能扫描提取表情包 → 保存到emojis目录 → 清理temp
```

### 2. 关键函数修改

#### 2.1 `downloadSuit` 函数

需要支持：
- Normal装扮和DLC装扮两种类型
- 全量下载所有资源
- 调用智能提取函数

```typescript
const downloadSuit = async (
    suitId: number,
    suitType: 'normal' | 'dlc',
    lotteryId?: number
) => {
    // 1. 根据类型获取装扮数据
    if (suitType === 'normal') {
        // 调用 normal API
    } else {
        // 调用 DLC API (basic + detail)
    }
    
    // 2. 创建临时目录
    const tempDir = `${appDataDir}/temp/${suitName}`
    
    // 3. 分析并下载所有资源
    const downloadInfos = analyzeSuitData(suitData, suitType, suitName)
    for (const info of downloadInfos) {
        // 下载到temp目录
    }
    
    // 4. 智能提取表情包
    const extractedCount = await extractEmojisFromTemp(tempDir, suitName)
    
    // 5. 清理临时目录
    await context.fs.removeDir(tempDir, { recursive: true })
    
    return { success: true, count: extractedCount, category: suitName }
}
```

#### 2.2 `analyzeSuitData` 函数（新增）

分析装扮数据，提取所有下载链接：

```typescript
const analyzeSuitData = (suitData: any, suitType: 'normal' | 'dlc', suitName: string): DownloadInfo[] => {
    const downloadInfos: DownloadInfo[] = []

    if (suitType === 'normal') {
        // 递归处理 suit_items 的所有分类
        const suitItems = suitData.suit_items || {}
        for (const [category, items] of Object.entries(suitItems)) {
            processItems(items, category)
        }
    } else {
        // 处理DLC的 basic 和 detail 数据
        // - act_y_img, app_head_show, act_square_img
        // - lottery_list
        // - item_list (card_info, video_list)
        // - collect_list (collect_infos, collect_chain)
    }

    return downloadInfos
}
```

#### 2.3 `extractEmojisFromTemp` 函数（新增）

从临时目录智能提取表情包：

```typescript
const extractEmojisFromTemp = async (tempDir: string, suitName: string): Promise<number> => {
    const emojiDir = `${appDataDir}/emojis/${suitName}`
    let extractedCount = 0

    // 递归扫描临时目录
    const scanDirectory = async (dir: string) => {
        const entries = await context.fs.readDir(dir)
        for (const entry of entries) {
            if (entry.isDirectory) {
                await scanDirectory(fullPath)
            } else if (entry.isFile) {
                // 判断是否是表情包
                if (isEmojiFile(entry.name, fullPath)) {
                    // 提取并保存
                    extractedCount++
                }
            }
        }
    }

    await scanDirectory(tempDir)
    return extractedCount
}
```

#### 2.4 `isEmojiFile` 函数（新增）

智能判断文件是否是表情包：

```typescript
const isEmojiFile = (fileName: string, filePath: string): boolean => {
    // 1. 检查文件扩展名
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return false

    // 2. 排除非表情包文件
    const excludePatterns = [
        /^act_/i,          // act_y_img.png
        /^app_/i,          // app_head_show.png
        /head_bg/i,        // 头部背景
        /tail_icon/i,      // 底部图标
        /space_bg/i,       // 空间背景
        /card_bg/i,        // 卡片背景
        /loading/i,        // 加载动画
        /play_icon/i,      // 播放图标
        /thumbup/i,        // 点赞动画
        /^cover\./i,       // 封面
        /background/i,     // 背景
        /头像框/,          // 头像框
        /勋章/,            // 勋章
        /主题套装/,        // 主题套装
        /钻石/             // 钻石背景
    ]

    for (const pattern of excludePatterns) {
        if (pattern.test(fileName)) return false
    }

    // 3. 检查路径特征
    if (filePath.includes('emoji_package')) return true

    // 4. 检查文件名特征
    const includePatterns = [
        /emoji/i,          // 包含emoji
        /表情/,            // 包含"表情"
        /\[.*\]/,          // 方括号包裹 [表情名]
        /_\d+\./           // 编号 emoji_1.png
    ]

    for (const pattern of includePatterns) {
        if (pattern.test(fileName)) return true
    }

    // 5. 检查是否在表情包ID目录下（如 _8249/）
    if (/_\d{4,}/.test(filePath)) return true

    return false
}
```

#### 2.5 `extractEmojiName` 函数（新增）

从文件名提取表情包名称：

```typescript
const extractEmojiName = (fileName: string): string => {
    let name = fileName.substring(0, fileName.lastIndexOf('.'))
    
    // 去掉方括号
    name = name.replace(/^\[|\]$/g, '')
    
    // 去掉属性后缀
    name = name.replace(/\.(image|gif_url|url|png|jpg|gif|webp)$/i, '')
    
    // 清理非法字符
    return sanitizeFilename(name)
}
```

### 3. DLC API 调用

#### 3.1 获取DLC基本信息

```typescript
const basicUrl = `https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${suitId}`
// 返回: act_title, lottery_list, act_y_img, app_head_show, act_square_img
```

#### 3.2 获取DLC详细信息

```typescript
const detailUrl = `https://api.bilibili.com/x/vas/dlc_act/lottery_home_detail?act_id=${suitId}&lottery_id=${lotteryId}`
// 返回: name, item_list, collect_list
```

#### 3.3 DLC数据结构

```typescript
{
    basic: {
        act_title: string,
        lottery_list: [{
            lottery_id: number,
            lottery_name: string,
            lottery_image: string
        }],
        act_y_img: string,
        app_head_show: string,
        act_square_img: string
    },
    detail: {
        name: string,
        item_list: [{
            card_info: {
                card_name: string,
                card_img: string,
                video_list: string[]
            }
        }],
        collect_list: {
            collect_infos: [{
                redeem_item_type: number,  // 2或15表示表情包
                redeem_item_id: string,
                redeem_item_name: string,
                redeem_item_image: string,
                card_item: {
                    card_type_info: {
                        content: {
                            animation: {
                                animation_video_urls: string[]
                            }
                        }
                    }
                }
            }],
            collect_chain: [...]  // 同上结构
        }
    }
}
```

### 4. 表情包识别规则

根据实际下载的装扮分析，表情包通常具有以下特征：

#### 4.1 路径特征
- 在 `emoji_package/` 目录下
- 在 `_数字ID/` 目录下（如 `_8249/`）
- 包含 "表情" 或 "emoji" 关键词

#### 4.2 文件名特征
- 方括号包裹：`[雪狐桑生日纪念_开心].image.png`
- 包含表情关键词：`emoji_1.png`, `表情包.png`
- 编号格式：`表情_1.png`, `表情_2.gif`

#### 4.3 排除规则
- 系统文件：`act_*.png`, `app_*.png`
- UI组件：`head_bg`, `tail_icon`, `loading`
- 装饰元素：`头像框`, `勋章`, `钻石背景`
- 主题资源：`主题套装`, `space_bg`, `card_bg`

### 5. 测试用例

#### 5.1 Normal装扮测试
```javascript
// 雪狐桑生日纪念 (ID: 42484)
await emojiDebug.testDownload(42484, 'normal')
// 预期：提取 emoji_package 目录下的25个表情包
```

#### 5.2 DLC装扮测试
```javascript
// 早凉·双镜溯游 (ID: 8249)
await emojiDebug.testDownload(8249, 'dlc')
// 预期：提取 _8249 目录下的表情包（gif和png）
```

#### 5.3 混合装扮测试
```javascript
// 村村宇宙·小猫女仆降临
await emojiDebug.testDownload(xxxxx, 'dlc')
// 预期：提取多个表情包目录（_7355, _7356）
```

### 6. 实现步骤

1. **备份当前文件**
   ```bash
   cp pluginLoader/plugins/bilibili-emoji/index.ts pluginLoader/plugins/bilibili-emoji/index_v2_backup.ts
   ```

2. **添加新函数**
   - `analyzeSuitData`
   - `extractEmojisFromTemp`
   - `isEmojiFile`
   - `extractEmojiName`

3. **修改 `downloadSuit` 函数**
   - 添加DLC支持
   - 改为全量下载
   - 调用智能提取

4. **更新版本号**
   ```typescript
   version: '3.0.0'
   ```

5. **测试验证**
   - 测试Normal装扮
   - 测试DLC装扮
   - 测试混合装扮
   - 验证表情包提取准确性

### 7. 注意事项

1. **临时目录管理**
   - 下载前创建temp目录
   - 提取后清理temp目录
   - 处理清理失败的情况

2. **错误处理**
   - API调用失败
   - 文件下载失败
   - 目录操作失败
   - 提取失败的文件跳过

3. **性能优化**
   - 批量下载时显示进度
   - 避免重复下载
   - 合理的并发控制

4. **兼容性**
   - 保持向后兼容
   - 支持旧版本的表情包
   - 处理不同结构的装扮

## 完整代码参考

由于代码较长，完整实现请参考：
- `pluginLoader/plugins/bilibili-emoji/index_v3.ts` - 新版本实现
- `BilibiliSuitDownload/utils/resp_analyze.go` - Go版本参考
- `pluginLoader/plugins/bilibili-emoji/cli.js` - CLI工具参考

## 测试清单

- [ ] Normal装扮下载测试
- [ ] DLC装扮下载测试
- [ ] 表情包提取准确性测试
- [ ] 临时目录清理测试
- [ ] 错误处理测试
- [ ] 性能测试（大装扮）
- [ ] 兼容性测试（不同结构）

## 升级后效果

- ✅ 支持所有类型的装扮下载
- ✅ 智能识别并提取表情包
- ✅ 不遗漏任何表情包
- ✅ 自动过滤非表情包资源
- ✅ 完整的DLC支持
- ✅ 更好的错误处理
