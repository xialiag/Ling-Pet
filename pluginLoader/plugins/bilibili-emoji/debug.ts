/**
 * bilibili-emoji 插件调试工具
 * 在浏览器控制台中使用
 */

/**
 * bilibili-emoji 调试助手
 */
export class BilibiliEmojiDebug {
    /**
     * 测试扫描表情包
     */
    async testScan() {
        console.log('🔍 测试扫描表情包...')
        const result = await (window as any).debug.callTool('rescan_emojis', {})
        return result
    }

    /**
     * 测试搜索本地表情包
     */
    async testSearchLocal(query: string = '开心', limit: number = 5) {
        console.log(`🔍 搜索本地表情包: "${query}"`)
        const result = await (window as any).debug.callTool('search_local_emoji', {
            query,
            limit
        })
        return result
    }

    /**
     * 测试搜索 B站表情包
     */
    async testSearchBilibili(keyword: string = '鸽宝') {
        console.log(`🔍 搜索 B站表情包: "${keyword}"`)
        const result = await (window as any).debug.callTool('search_bilibili_emoji', {
            keyword
        })
        return result
    }

    /**
     * 测试下载表情包
     */
    async testDownload(suitId: number = 114156001, suitType: string = 'normal') {
        console.log(`⬇️ 下载表情包: ${suitId} (${suitType})`)
        const result = await (window as any).debug.callTool('download_emoji_suit', {
            suitId,
            suitType
        })
        return result
    }

    /**
     * 测试随机表情包
     */
    async testRandom(category?: string) {
        console.log('🎲 获取随机表情包')
        const result = await (window as any).debug.callTool('random_emoji', {
            category
        })
        return result
    }

    /**
     * 列出所有分类
     */
    async listCategories() {
        console.log('📂 列出所有分类')
        const result = await (window as any).debug.callTool('list_emoji_categories', {})
        return result
    }

    /**
     * 完整测试流程
     */
    async runFullTest() {
        console.log('🧪 开始完整测试流程\n')

        // 1. 扫描表情包
        console.log('1️⃣ 扫描表情包')
        const scanResult = await this.testScan()
        console.log(`   找到 ${scanResult.result?.newCount || 0} 个表情包\n`)

        // 2. 列出分类
        console.log('2️⃣ 列出分类')
        const categoriesResult = await this.listCategories()
        console.log(`   共 ${categoriesResult.result?.count || 0} 个分类\n`)

        // 3. 搜索本地表情包
        console.log('3️⃣ 搜索本地表情包')
        const searchResult = await this.testSearchLocal('开心', 3)
        console.log(`   找到 ${searchResult.result?.count || 0} 个结果\n`)

        // 4. 获取随机表情包
        console.log('4️⃣ 获取随机表情包')
        const randomResult = await this.testRandom()
        console.log(`   随机表情: ${randomResult.result?.name || 'N/A'}\n`)

        console.log('✅ 测试完成！')
    }

    /**
     * 测试 LLM 工具调用
     */
    async testLLMCall() {
        console.log('🤖 测试 LLM 工具调用\n')

        const llmResponse = `
好的，我来帮你搜索开心的表情包。

\`\`\`tool
{
  "tool": "search_local_emoji",
  "args": {
    "query": "开心",
    "limit": 5
  }
}
\`\`\`
`

        const result = await (window as any).debug.simulateLLMToolCall(llmResponse)
        return result
    }

    /**
     * 显示帮助
     */
    help() {
        console.log(`
🎨 bilibili-emoji 插件调试工具

📦 基础测试:
  emojiDebug.testScan()                          - 测试扫描表情包
  emojiDebug.testSearchLocal('开心', 5)          - 测试搜索本地表情包
  emojiDebug.testSearchBilibili('鸽宝')          - 测试搜索 B站表情包
  emojiDebug.testDownload(114156001, 'normal')   - 测试下载表情包
  emojiDebug.testRandom()                        - 测试随机表情包
  emojiDebug.listCategories()                    - 列出所有分类

🧪 完整测试:
  emojiDebug.runFullTest()                       - 运行完整测试流程
  emojiDebug.testLLMCall()                       - 测试 LLM 工具调用

💡 示例:
  // 搜索开心的表情包
  await emojiDebug.testSearchLocal('开心', 5)
  
  // 搜索并下载鸽宝表情包
  const suits = await emojiDebug.testSearchBilibili('鸽宝')
  await emojiDebug.testDownload(suits.result.suits[0].id, 'normal')
  
  // 运行完整测试
  await emojiDebug.runFullTest()
`)
    }
}

// 创建全局实例
export const emojiDebug = new BilibiliEmojiDebug()

// 暴露到全局
if (typeof window !== 'undefined') {
    (window as any).emojiDebug = emojiDebug
    console.log('🎨 bilibili-emoji 调试工具已就绪，输入 emojiDebug.help() 查看帮助')
}
