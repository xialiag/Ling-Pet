#!/usr/bin/env node

/**
 * B站表情包插件CLI工具
 * 功能：
 * 1. 扫描本地表情包
 * 2. 搜索B站装扮
 * 3. 下载表情包
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

// 获取插件数据目录
const getDataPath = () => {
    // 在生产环境中，插件会被复制到用户数据目录
    // 这里使用相对路径，实际路径由主程序管理
    return path.join(__dirname, 'data', 'emojis')
}

/**
 * 扫描本地表情包
 */
const scanLocal = async () => {
    console.log('🔍 扫描本地表情包...')
    const dataPath = getDataPath()

    if (!fs.existsSync(dataPath)) {
        console.log('📁 数据目录不存在，创建中...')
        fs.mkdirSync(dataPath, { recursive: true })
        console.log('✅ 数据目录已创建:', dataPath)
        return
    }

    let count = 0
    const categories = new Set()

    const scanDir = (dir, category = '') => {
        if (!fs.existsSync(dir)) return

        const items = fs.readdirSync(dir, { withFileTypes: true })

        for (const item of items) {
            const fullPath = path.join(dir, item.name)

            if (item.isDirectory()) {
                scanDir(fullPath, item.name)
            } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase()
                if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                    count++
                    if (category) categories.add(category)
                }
            }
        }
    }

    scanDir(dataPath)

    console.log(`✅ 扫描完成`)
    console.log(`📊 找到 ${count} 个表情包`)
    console.log(`📁 ${categories.size} 个分类:`)
    categories.forEach(cat => console.log(`   - ${cat}`))
}

/**
 * 搜索B站装扮
 */
const searchOnline = async (keyword) => {
    console.log(`🔍 搜索B站装扮: ${keyword}`)

    try {
        const url = `https://api.bilibili.com/x/garb/v2/mall/suit/search?keyword=${encodeURIComponent(keyword)}&page_num=1&page_size=20`

        const data = await httpGet(url)
        const json = JSON.parse(data)

        if (json.code !== 0) {
            throw new Error(json.message || '搜索失败')
        }

        const results = []
        const items = json.data?.list || []

        for (const item of items) {
            results.push({
                id: item.item_id,
                name: item.name,
                type: item.type === 'suit' ? 'normal' : 'dlc',
                lotteryId: item.properties?.sale_lottery_id || 0
            })
        }

        // 输出JSON格式供插件解析
        console.log(JSON.stringify(results))

        return results
    } catch (error) {
        console.error('❌ 搜索失败:', error.message)
        console.log(JSON.stringify([]))
        process.exit(1)
    }
}

/**
 * 下载装扮
 */
const downloadSuit = async (suitId, suitType, lotteryId) => {
    console.log(`📦 下载装扮 ${suitId} (${suitType})...`)

    try {
        // 获取装扮信息
        let suitInfo
        if (suitType === 'normal') {
            suitInfo = await getSuitInfo(suitId)
        } else {
            suitInfo = await getDLCInfo(suitId, lotteryId)
        }

        // 解析下载信息
        const downloadInfos = analyzeSuitInfo(suitInfo)

        // 创建分类目录
        const category = suitInfo.name || `suit_${suitId}`
        const categoryPath = path.join(getDataPath(), category)
        fs.mkdirSync(categoryPath, { recursive: true })

        // 下载文件
        let downloaded = 0
        for (const info of downloadInfos) {
            try {
                console.log(`  下载: ${info.fileName}`)
                const filePath = path.join(categoryPath, info.fileName)
                await downloadFile(info.url, filePath)
                downloaded++
            } catch (error) {
                console.error(`  ❌ 下载失败: ${info.fileName}`, error.message)
            }
        }

        const result = {
            success: true,
            count: downloaded,
            category: category
        }

        console.log(JSON.stringify(result))
        console.log(`✅ 下载完成: ${downloaded}/${downloadInfos.length}`)

        return result
    } catch (error) {
        console.error('❌ 下载失败:', error.message)
        console.log(JSON.stringify({ success: false, count: 0, category: '' }))
        process.exit(1)
    }
}

/**
 * 获取装扮信息
 */
const getSuitInfo = async (suitId) => {
    const url = `https://api.bilibili.com/x/garb/v2/mall/suit/detail?item_id=${suitId}`
    const data = await httpGet(url)
    const json = JSON.parse(data)

    if (json.code !== 0) {
        throw new Error(json.message || '获取装扮信息失败')
    }

    return json.data
}

/**
 * 获取DLC信息
 */
const getDLCInfo = async (suitId, lotteryId) => {
    const url = `https://api.bilibili.com/x/garb/v2/mall/suit/detail?item_id=${suitId}&part=suit`
    const data = await httpGet(url)
    const json = JSON.parse(data)

    if (json.code !== 0) {
        throw new Error(json.message || '获取DLC信息失败')
    }

    return json.data
}

/**
 * 解析装扮信息，提取下载链接
 */
const analyzeSuitInfo = (suitInfo) => {
    const downloadInfos = []

    // 解析表情包
    if (suitInfo.suit_items?.emoji_package) {
        const emojiPackages = Array.isArray(suitInfo.suit_items.emoji_package)
            ? suitInfo.suit_items.emoji_package
            : [suitInfo.suit_items.emoji_package]

        for (const pkg of emojiPackages) {
            if (pkg.items) {
                for (const item of pkg.items) {
                    if (item.properties?.image) {
                        const url = item.properties.image
                        const fileName = `${item.name || item.id}.${getFileExtension(url)}`
                        downloadInfos.push({ url, fileName })
                    }
                }
            }
        }
    }

    // 解析其他资源（头像框、挂件等）
    const resourceTypes = ['pendant', 'card_bg', 'space_bg', 'loading']
    for (const type of resourceTypes) {
        if (suitInfo.suit_items?.[type]) {
            const items = Array.isArray(suitInfo.suit_items[type])
                ? suitInfo.suit_items[type]
                : [suitInfo.suit_items[type]]

            for (const item of items) {
                if (item.properties?.image) {
                    const url = item.properties.image
                    const fileName = `${type}_${item.id}.${getFileExtension(url)}`
                    downloadInfos.push({ url, fileName })
                }
            }
        }
    }

    return downloadInfos
}

/**
 * 获取文件扩展名
 */
const getFileExtension = (url) => {
    const match = url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i)
    return match ? match[1] : 'png'
}

/**
 * HTTP GET 请求
 */
const httpGet = (url) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http

        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        }, (res) => {
            let data = ''

            res.on('data', (chunk) => {
                data += chunk
            })

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data)
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`))
                }
            })
        }).on('error', reject)
    })
}

/**
 * 下载文件
 */
const downloadFile = (url, filePath) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http
        const file = fs.createWriteStream(filePath)

        client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        }, (res) => {
            if (res.statusCode === 200) {
                res.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve()
                })
            } else {
                file.close()
                fs.unlinkSync(filePath)
                reject(new Error(`HTTP ${res.statusCode}`))
            }
        }).on('error', (err) => {
            file.close()
            fs.unlinkSync(filePath)
            reject(err)
        })
    })
}

// CLI 命令
const commands = {
    scan: scanLocal,
    'search-online': (keyword) => searchOnline(keyword),
    download: (suitId, suitType, lotteryId) => downloadSuit(
        parseInt(suitId),
        suitType,
        lotteryId ? parseInt(lotteryId) : undefined
    ),
    help: () => {
        console.log(`
B站表情包插件 CLI 工具

用法:
  node cli.js <command> [options]

命令:
  scan                          扫描本地表情包
  search-online <keyword>       搜索B站装扮
  download <id> <type> [lottery] 下载装扮
  help                          显示帮助

示例:
  node cli.js scan
  node cli.js search-online 鸽宝
  node cli.js download 114156001 normal
  node cli.js download 123456 dlc 789
        `)
    }
}

// 执行命令
const [, , command, ...args] = process.argv

if (!command || !commands[command]) {
    commands.help()
    process.exit(1)
}

commands[command](...args)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ 错误:', error.message)
        process.exit(1)
    })
