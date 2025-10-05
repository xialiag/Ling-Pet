/**
 * B站表情包插件 v3.0
 * 功能：
 * 1. 扫描本地表情包
 * 2. 通过关键词搜索和下载B站表情包
 * 3. 全量下载装扮资源，智能提取表情包
 * 4. 支持Normal和DLC两种装扮类型
 * 5. 为LLM提供表情包搜索和发送能力
 * 6. Hook聊天组件显示表情包
 */

import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'
import { emojiDebug } from './debug'

interface EmojiInfo {
    name: string
    path: string
    type: 'static' | 'gif'
    category: string
}

export default definePlugin({
    name: 'bilibili-emoji',
    version: '3.0.0',
    description: 'B站表情包管理、下载和发送（支持DLC，智能提取）',

    async onLoad(context: PluginContext) {
        context.debug('B站表情包插件加载中...')

        // 表情包缓存
        let emojiCache: EmojiInfo[] = []

        // 当前待发送的表情包

        /**
         * 扫描本地表情包
         */
        const scanEmojis = async (): Promise<EmojiInfo[]> => {
            try {
                context.debug('开始扫描表情包...')

                // 获取表情包目录
                const appDataDir = await context.getAppDataDir()
                const emojiDir = `${appDataDir}/emojis`

                // 确保目录存在
                if (!await context.fs.exists(emojiDir)) {
                    await context.fs.mkdir(emojiDir, { recursive: true })
                    return []
                }

                const emojis: EmojiInfo[] = []

                // 扫描分类目录
                const categories = await context.fs.readDir(emojiDir)

                for (const category of categories) {
                    if (!category.isDirectory) continue

                    const categoryPath = `${emojiDir}/${category.name}`
                    const files = await context.fs.readDir(categoryPath)

                    for (const file of files) {
                        if (!file.isFile) continue

                        const ext = file.name.split('.').pop()?.toLowerCase()
                        if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) continue

                        const name = file.name.substring(0, file.name.lastIndexOf('.'))
                        const type = ext === 'gif' ? 'gif' : 'static'

                        emojis.push({
                            name,
                            path: `${categoryPath}/${file.name}`,
                            type,
                            category: category.name
                        })
                    }
                }

                context.debug(`扫描完成，找到 ${emojis.length} 个表情包`)
                return emojis
            } catch (error) {
                context.debug('扫描失败:', error)
                return []
            }
        }

        /**
         * 搜索本地表情包
         */
        const searchLocalEmojis = (query: string, limit: number = 10): EmojiInfo[] => {
            const lowerQuery = query.toLowerCase()
            return emojiCache
                .filter(emoji =>
                    emoji.name.toLowerCase().includes(lowerQuery) ||
                    emoji.category.toLowerCase().includes(lowerQuery)
                )
                .slice(0, limit)
        }

        /**
         * 搜索B站表情包装扮（使用新的后端API）
         */
        const searchBilibiliSuitsBackend = async (keyword: string) => {
            try {
                context.debug('使用后端API搜索装扮:', keyword)
                
                // 直接调用插件后端函数
                const result = await context.callBackend('search_suits', { keyword })
                
                if (result.success) {
                    context.debug(`后端搜索成功，找到 ${result.suits.length} 个装扮`)
                    return result.suits
                } else {
                    context.debug('后端搜索失败:', result.error)
                    return []
                }
            } catch (error) {
                context.debug('后端调用异常，回退到HTTP方式:', error)
                // 回退到原有的HTTP方式
                return await searchBilibiliSuitsHTTP(keyword)
            }
        }

        /**
         * 搜索B站表情包装扮（HTTP方式，作为后备）
         */
        const searchBilibiliSuitsHTTP = async (keyword: string) => {
            try {
                const url = `https://api.bilibili.com/x/garb/v2/mall/home/search?key_word=${encodeURIComponent(keyword)}`

                // 使用 Tauri 后端 HTTP 请求避免反爬虫
                const responseText = await context.invokeTauri<string>('http_request', {
                    url,
                    method: 'GET',
                    headers: {
                        'Referer': 'https://www.bilibili.com/',
                        'Accept': 'application/json'
                    }
                })

                const data = JSON.parse(responseText)

                if (data.code !== 0) {
                    throw new Error(data.message || '搜索失败')
                }

                const suits = data.data.list.map((item: any) => {
                    const isSuit = item.item_id !== 0
                    return {
                        id: isSuit ? item.item_id : parseInt(item.properties.dlc_act_id || '0'),
                        name: item.name,
                        type: isSuit ? 'normal' : 'dlc',
                        lottery_id: item.properties.dlc_lottery_id ? parseInt(item.properties.dlc_lottery_id) : undefined
                    }
                })

                return { suits }
            } catch (error) {
                context.debug('搜索B站装扮失败:', error)
                return { suits: [], error: error instanceof Error ? error.message : String(error) }
            }
        }

        /**
         * 下载表情包装扮（全量下载+智能提取）
         */
        const downloadSuit = async (
            suitId: number,
            suitType: 'normal' | 'dlc',
            lotteryId?: number
        ) => {
            try {
                context.debug(`开始下载装扮 ${suitId} (${suitType})...`)

                let suitData: any
                let suitName: string

                if (suitType === 'normal') {
                    // 普通装扮
                    const url = `https://api.bilibili.com/x/garb/mall/item/suit/v2?part=suit&item_id=${suitId}`
                    const responseText = await context.invokeTauri<string>('http_request', {
                        url,
                        method: 'GET',
                        headers: {
                            'Referer': 'https://www.bilibili.com/',
                            'Accept': 'application/json'
                        }
                    })

                    const data = JSON.parse(responseText)
                    if (data.code !== 0) {
                        throw new Error('获取装扮信息失败')
                    }

                    suitData = data.data
                    suitName = sanitizeFilename(suitData.item.name)
                } else {
                    // DLC装扮
                    const basicUrl = `https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${suitId}`
                    const basicResp = await context.invokeTauri<string>('http_request', {
                        url: basicUrl,
                        method: 'GET',
                        headers: {
                            'Referer': 'https://www.bilibili.com/',
                            'Accept': 'application/json'
                        }
                    })

                    const basicData = JSON.parse(basicResp)
                    if (basicData.code !== 0) {
                        throw new Error('获取DLC基本信息失败')
                    }

                    const lotteryList = basicData.data.lottery_list || []
                    if (lotteryList.length === 0) {
                        throw new Error('该DLC没有卡池')
                    }

                    const selectedLotteryId = lotteryId || lotteryList[lotteryList.length - 1].lottery_id
                    context.debug(`使用卡池ID: ${selectedLotteryId}`)

                    const detailUrl = `https://api.bilibili.com/x/vas/dlc_act/lottery_home_detail?act_id=${suitId}&lottery_id=${selectedLotteryId}`
                    const detailResp = await context.invokeTauri<string>('http_request', {
                        url: detailUrl,
                        method: 'GET',
                        headers: {
                            'Referer': 'https://www.bilibili.com/',
                            'Accept': 'application/json'
                        }
                    })

                    const detailData = JSON.parse(detailResp)
                    if (detailData.code !== 0) {
                        throw new Error('获取DLC详细信息失败')
                    }

                    suitData = {
                        basic: basicData.data,
                        detail: detailData.data
                    }
                    suitName = sanitizeFilename(`${basicData.data.act_title}_${detailData.data.name}`)
                }

                const appDataDir = await context.getAppDataDir()
                const tempDir = `${appDataDir}/temp/${suitName}`

                await context.fs.mkdir(tempDir, { recursive: true })

                let downloadCount = 0
                const downloadInfos = analyzeSuitData(suitData, suitType)
                
                context.debug(`准备下载 ${downloadInfos.length} 个文件...`)

                for (const info of downloadInfos) {
                    try {
                        const filePath = `${tempDir}/${info.pkgName}/${info.fileName}`.replace(/\\/g, '/')
                        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
                        
                        await context.fs.mkdir(dirPath, { recursive: true })

                        const fileResponse = await context.fetch(info.url)
                        const blob = await fileResponse.blob()
                        const arrayBuffer = await blob.arrayBuffer()
                        const uint8Array = new Uint8Array(arrayBuffer)

                        await context.fs.writeFile(filePath, uint8Array)
                        downloadCount++
                        
                        if (downloadCount % 10 === 0) {
                            context.debug(`已下载 ${downloadCount}/${downloadInfos.length}`)
                        }
                    } catch (error) {
                        context.debug(`✗ 下载失败 ${info.fileName}:`, error)
                    }
                }

                context.debug(`下载完成，开始扫描表情包...`)

                const extractedCount = await extractEmojisFromTemp(tempDir, suitName)

                // 清理临时目录
                context.debug('清理临时目录...')
                try {
                    // 使用Tauri命令递归删除目录
                    await context.invokeTauri('remove_dir_all', { path: tempDir })
                    context.debug('✓ 临时目录已清理')
                } catch (error) {
                    context.debug('✗ 清理临时目录失败:', error)
                    // 即使清理失败也继续执行
                }

                emojiCache = await scanEmojis()

                return {
                    success: true,
                    count: extractedCount,
                    category: suitName
                }
            } catch (error) {
                context.debug('下载装扮失败:', error)
                throw error
            }
        }

        /**
         * 分析装扮数据，提取所有下载链接
         */
        const analyzeSuitData = (suitData: any, suitType: 'normal' | 'dlc'): Array<{url: string, fileName: string, pkgName: string}> => {
            const downloadInfos: Array<{url: string, fileName: string, pkgName: string}> = []

            if (suitType === 'normal') {
                const suitItems = suitData.suit_items || {}
                
                for (const [category, items] of Object.entries(suitItems)) {
                    const processItems = (itemList: any[], parentPath: string = '') => {
                        for (const item of itemList) {
                            const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name
                            
                            const properties = item.properties || {}
                            for (const [key, url] of Object.entries(properties)) {
                                if (typeof url === 'string' && url.startsWith('https')) {
                                    const ext = url.split('.').pop()?.split('?')[0] || 'png'
                                    const fileName = `${sanitizeFilename(item.name)}.${key}.${ext}`
                                    downloadInfos.push({
                                        url,
                                        fileName,
                                        pkgName: `${category}/${parentPath}`.replace(/\/$/, '')
                                    })
                                }
                            }
                            
                            if (item.items && item.items.length > 0) {
                                processItems(item.items, currentPath)
                            }
                        }
                    }
                    
                    processItems(Array.isArray(items) ? items : [items])
                }
            } else {
                // DLC装扮
                const basic = suitData.basic
                const detail = suitData.detail

                if (basic.act_y_img) {
                    downloadInfos.push({ url: basic.act_y_img, fileName: 'act_y_img.png', pkgName: '' })
                }
                if (basic.app_head_show) {
                    downloadInfos.push({ url: basic.app_head_show.split('@')[0], fileName: 'app_head_show.png', pkgName: '' })
                }
                if (basic.act_square_img) {
                    downloadInfos.push({ url: basic.act_square_img.split('@')[0], fileName: 'act_square_img.png', pkgName: '' })
                }

                for (const lottery of basic.lottery_list || []) {
                    if (lottery.lottery_image) {
                        const ext = lottery.lottery_image.split('.').pop()?.split('?')[0] || 'png'
                        downloadInfos.push({
                            url: lottery.lottery_image,
                            fileName: `${sanitizeFilename(lottery.lottery_name)}.${ext}`,
                            pkgName: ''
                        })
                    }
                }

                for (const item of detail.item_list || []) {
                    const cardInfo = item.card_info
                    if (cardInfo.card_img) {
                        const ext = cardInfo.card_img.split('.').pop()?.split('?')[0] || 'png'
                        downloadInfos.push({
                            url: cardInfo.card_img,
                            fileName: `${sanitizeFilename(cardInfo.card_name)}.${ext}`,
                            pkgName: ''
                        })
                    }
                    
                    for (let i = 0; i < (cardInfo.video_list || []).length; i++) {
                        downloadInfos.push({
                            url: cardInfo.video_list[i],
                            fileName: `${sanitizeFilename(cardInfo.card_name)}_${i}.mp4`,
                            pkgName: ''
                        })
                    }
                }

                const collectList = [
                    ...(detail.collect_list?.collect_infos || []),
                    ...(detail.collect_list?.collect_chain || [])
                ]

                for (const collect of collectList) {
                    if (collect.redeem_item_image) {
                        const ext = collect.redeem_item_image.split('.').pop()?.split('?')[0] || 'png'
                        downloadInfos.push({
                            url: collect.redeem_item_image,
                            fileName: `${sanitizeFilename(collect.redeem_item_name)}.${ext}`,
                            pkgName: ''
                        })
                    }

                    const videos = collect.card_item?.card_type_info?.content?.animation?.animation_video_urls || []
                    for (let i = 0; i < videos.length; i++) {
                        downloadInfos.push({
                            url: videos[i],
                            fileName: `${sanitizeFilename(collect.redeem_item_name)}_${i}.mp4`,
                            pkgName: ''
                        })
                    }
                }
            }

            return downloadInfos
        }

        /**
         * 从临时目录扫描并提取表情包到emojis目录
         */
        const extractEmojisFromTemp = async (tempDir: string, suitName: string): Promise<number> => {
            const appDataDir = await context.getAppDataDir()
            const emojiDir = `${appDataDir}/emojis/${suitName}`
            
            await context.fs.mkdir(emojiDir, { recursive: true })

            let extractedCount = 0

            const scanDirectory = async (dir: string) => {
                try {
                    const entries = await context.fs.readDir(dir)
                    
                    for (const entry of entries) {
                        const fullPath = `${dir}/${entry.name}`
                        
                        if (entry.isDirectory) {
                            await scanDirectory(fullPath)
                        } else if (entry.isFile) {
                            if (isEmojiFile(entry.name, fullPath)) {
                                try {
                                    // 使用Tauri的文件系统API读取二进制文件
                                    const content = await context.invokeTauri<number[]>('read_binary_file', {
                                        path: fullPath
                                    })
                                    
                                    const emojiName = extractEmojiName(entry.name)
                                    const ext = entry.name.split('.').pop()
                                    const targetPath = `${emojiDir}/${emojiName}.${ext}`
                                    
                                    // 转换为Uint8Array并写入
                                    const uint8Array = new Uint8Array(content)
                                    await context.fs.writeFile(targetPath, uint8Array)
                                    extractedCount++
                                    
                                    if (extractedCount % 5 === 0) {
                                        context.debug(`已提取 ${extractedCount} 个表情包`)
                                    }
                                } catch (error) {
                                    context.debug(`提取表情包失败 ${entry.name}:`, error)
                                }
                            }
                        }
                    }
                } catch (error) {
                    context.debug(`扫描目录失败 ${dir}:`, error)
                }
            }

            await scanDirectory(tempDir)
            
            context.debug(`扫描完成，找到 ${extractedCount} 个表情包`)
            return extractedCount
        }

        /**
         * 判断文件是否是表情包
         */
        const isEmojiFile = (fileName: string, filePath: string): boolean => {
            const ext = fileName.split('.').pop()?.toLowerCase()
            if (!ext || !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                return false
            }

            const excludePatterns = [
                /^act_/i, /^app_/i, /head_bg/i, /tail_icon/i,
                /space_bg/i, /card_bg/i, /loading/i, /play_icon/i,
                /thumbup/i, /^cover\./i, /background/i,
                /头像框/, /勋章/, /主题套装/, /钻石/
            ]

            for (const pattern of excludePatterns) {
                if (pattern.test(fileName)) return false
            }

            if (filePath.includes('emoji_package')) return true

            const includePatterns = [
                /emoji/i, /表情/, /\[.*\]/, /_\d+\./
            ]

            for (const pattern of includePatterns) {
                if (pattern.test(fileName)) return true
            }

            if (/_\d{4,}/.test(filePath)) return true

            return false
        }

        /**
         * 从文件名提取表情包名称
         */
        const extractEmojiName = (fileName: string): string => {
            let name = fileName.substring(0, fileName.lastIndexOf('.'))
            name = name.replace(/^\[|\]$/g, '')
            name = name.replace(/\.(image|gif_url|url|png|jpg|gif|webp)$/i, '')
            return sanitizeFilename(name)
        }

        /**
         * 清理文件名中的非法字符
         */
        const sanitizeFilename = (name: string): string => {
            return name.replace(/[/:*?"<>|]/g, '_')
        }

        // 初始扫描
        emojiCache = await scanEmojis()

        // ========== 注册工具 ==========

        // 1. 搜索本地表情包
        context.registerTool({
            name: 'search_local_emoji',
            description: '搜索本地已下载的表情包',
            category: 'emoji',
            parameters: [
                {
                    name: 'query',
                    type: 'string',
                    description: '搜索关键词',
                    required: true
                },
                {
                    name: 'limit',
                    type: 'number',
                    description: '返回结果数量',
                    required: false
                }
            ],
            examples: ['search_local_emoji("开心")', 'search_local_emoji("哭", 5)'],
            handler: async (query: string, limit: number = 10) => {
                const results = searchLocalEmojis(query, limit)
                return {
                    count: results.length,
                    emojis: results.map(e => ({
                        name: e.name,
                        type: e.type,
                        category: e.category
                    }))
                }
            }
        })

        // 2. 搜索B站表情包装扮
        context.registerTool({
            name: 'search_bilibili_emoji',
            description: '在B站搜索表情包装扮，可以下载新的表情包',
            category: 'emoji',
            parameters: [
                {
                    name: 'keyword',
                    type: 'string',
                    description: '搜索关键词（如：鸽宝、清凉豹豹等）',
                    required: true
                }
            ],
            examples: ['search_bilibili_emoji("鸽宝")', 'search_bilibili_emoji("清凉豹豹")'],
            handler: async (keyword: string) => {
                return await searchBilibiliSuits(keyword)
            }
        })

        // 3. 下载表情包装扮
        context.registerTool({
            name: 'download_emoji_suit',
            description: '下载B站表情包装扮到本地',
            category: 'emoji',
            parameters: [
                {
                    name: 'suitId',
                    type: 'number',
                    description: '装扮ID（从search_bilibili_emoji获取）',
                    required: true
                },
                {
                    name: 'suitType',
                    type: 'string',
                    description: '装扮类型：normal 或 dlc',
                    required: true
                },
                {
                    name: 'lotteryId',
                    type: 'number',
                    description: '抽奖ID（dlc类型需要）',
                    required: false
                }
            ],
            examples: [
                'download_emoji_suit(114156001, "normal")',
                'download_emoji_suit(123456, "dlc", 789)'
            ],
            handler: async (suitId: number, suitType: 'normal' | 'dlc', lotteryId?: number) => {
                const result = await downloadSuit(suitId, suitType, lotteryId)
                return {
                    success: result.success,
                    downloaded: result.count,
                    category: result.category,
                    message: `成功下载 ${result.count} 个表情包到分类 ${result.category}`
                }
            }
        })

        // 4. 发送表情包
        context.registerTool({
            name: 'send_emoji',
            description: '在下一条消息中附带表情包',
            category: 'emoji',
            parameters: [
                {
                    name: 'emojiName',
                    type: 'string',
                    description: '表情包名称',
                    required: true
                }
            ],
            examples: ['send_emoji("开心")', 'send_emoji("抱抱")'],
            handler: async (emojiName: string) => {
                const emoji = emojiCache.find(e => e.name === emojiName)
                if (!emoji) {
                    throw new Error(`未找到表情包: ${emojiName}`)
                }


                // 触发事件
                context.emit('emoji:prepared', { emoji })

                return {
                    success: true,
                    emoji: {
                        name: emoji.name,
                        type: emoji.type,
                        category: emoji.category
                    },
                    tip: '表情包将在下一条消息中显示'
                }
            }
        })

        // 5. 获取随机表情包
        context.registerTool({
            name: 'random_emoji',
            description: '获取一个随机表情包',
            category: 'emoji',
            parameters: [
                {
                    name: 'category',
                    type: 'string',
                    description: '指定分类（可选）',
                    required: false
                }
            ],
            examples: ['random_emoji()', 'random_emoji("鸽宝")'],
            handler: async (category?: string) => {
                let pool = emojiCache
                if (category) {
                    pool = emojiCache.filter(e =>
                        e.category.toLowerCase().includes(category.toLowerCase())
                    )
                }
                if (pool.length === 0) {
                    throw new Error('没有找到符合条件的表情包')
                }
                const randomEmoji = pool[Math.floor(Math.random() * pool.length)]
                return {
                    name: randomEmoji.name,
                    type: randomEmoji.type,
                    category: randomEmoji.category
                }
            }
        })

        // 6. 列出所有分类
        context.registerTool({
            name: 'list_emoji_categories',
            description: '列出所有表情包分类',
            category: 'emoji',
            parameters: [],
            examples: ['list_emoji_categories()'],
            handler: async () => {
                const categories = Array.from(new Set(emojiCache.map(e => e.category)))
                return {
                    count: categories.length,
                    categories: categories.map(cat => ({
                        name: cat,
                        count: emojiCache.filter(e => e.category === cat).length
                    }))
                }
            }
        })

        // 7. 重新扫描表情包
        context.registerTool({
            name: 'rescan_emojis',
            description: '重新扫描表情包目录',
            category: 'emoji',
            parameters: [],
            examples: ['rescan_emojis()'],
            handler: async () => {
                const oldCount = emojiCache.length
                emojiCache = await scanEmojis()
                const newCount = emojiCache.length
                return {
                    oldCount,
                    newCount,
                    added: newCount - oldCount
                }
            }
        })

        // ========== 注册RPC方法 ==========

        context.registerRPC('searchEmoji', async (query: string, limit?: number) => {
            return searchLocalEmojis(query, limit)
        })

        context.registerRPC('getEmojiCache', async () => {
            return emojiCache
        })

        // ========== 创建共享状态 ==========

        context.createSharedState('emoji', {
            totalCount: emojiCache.length,
            categories: Array.from(new Set(emojiCache.map(e => e.category))),
            lastScan: Date.now()
        })

        // ========== Hook聊天组件 ==========

        // Hook聊天消息组件
        context.hookComponent('ChatMessage', {
            mounted() {
                context.debug('ChatMessage组件已挂载')
            }
        })

        // 监听表情包准备事件
        context.on('emoji:prepared', (data: any) => {
            context.debug('表情包已准备:', data.emoji.name)

            // 通知前端显示表情包
            context.emit('chat:show-emoji', {
                emoji: data.emoji
            })
        })

        // 注入表情包样式
        if (typeof document !== 'undefined') {
            const styleElement = document.createElement('style')
            styleElement.id = 'bilibili-emoji-styles'
            styleElement.textContent = `
                .message-emoji {
                    margin-top: 8px;
                    display: inline-block;
                }
                
                .emoji-image {
                    max-width: 200px;
                    max-height: 200px;
                    object-fit: contain;
                    border-radius: 8px;
                    transition: transform 0.2s;
                }
                
                .emoji-image:hover {
                    transform: scale(1.05);
                }
            `

            const existingStyle = document.getElementById('bilibili-emoji-styles')
            if (existingStyle) {
                existingStyle.remove()
            }

            document.head.appendChild(styleElement)
            context.debug('表情包样式已注入')
        }

        // ========== 注册设置页面操作按钮 ==========

        let isDownloading = false

        context.registerSettingsAction({
            label: '下载表情包',
            icon: 'mdi-download',
            color: 'primary',
            variant: 'outlined',
            loading: () => isDownloading,
            handler: async () => {
                try {
                    const keyword = prompt('请输入要搜索的表情包关键词（如：鸽宝、清凉豹豹）：')
                    if (!keyword) return

                    isDownloading = true

                    const result = await searchBilibiliSuits(keyword)

                    if (!result.suits || result.suits.length === 0) {
                        alert('未找到相关表情包')
                        return
                    }

                    // 显示搜索结果
                    const suitList = result.suits.map((suit: any, index: number) =>
                        `${index + 1}. ${suit.name} (ID: ${suit.id}, 类型: ${suit.type})`
                    ).join('\n')

                    const choice = prompt(`找到以下表情包：\n${suitList}\n\n请输入序号下载（1-${result.suits.length}）：`)
                    if (!choice) return

                    const index = parseInt(choice) - 1
                    if (index < 0 || index >= result.suits.length) {
                        alert('无效的选择')
                        return
                    }

                    const selectedSuit = result.suits[index]

                    await downloadSuit(selectedSuit.id, selectedSuit.type, selectedSuit.lottery_id)

                    alert(`成功下载表情包：${selectedSuit.name}`)
                } catch (error: any) {
                    alert(`下载失败：${error.message || '未知错误'}`)
                } finally {
                    isDownloading = false
                }
            }
        })

        context.debug('设置页面操作已注册')

        // 暴露调试工具到全局
        if (typeof window !== 'undefined') {
            (window as any).emojiDebug = emojiDebug
        }

        context.debug('✅ B站表情包插件已就绪')
        context.debug(`表情包总数: ${emojiCache.length}`)
        context.debug('💡 在控制台输入 emojiDebug.help() 查看调试命令')
    },

    async onUnload(context: PluginContext) {
        context.debug('B站表情包插件卸载中...')

        // 清理注入的样式
        if (typeof document !== 'undefined') {
            const styleElement = document.getElementById('bilibili-emoji-styles')
            if (styleElement) {
                styleElement.remove()
            }
        }

        // 清理事件监听器
        context.off('emoji:prepared')
        context.off('chat:show-emoji')

        context.debug('✅ B站表情包插件已卸载')
    }
})
