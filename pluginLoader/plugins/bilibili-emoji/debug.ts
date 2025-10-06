/**
 * B站表情包插件调试工具
 * 提供全面的调试和诊断功能
 */

export interface DebugLogger {
    info: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
}

export interface PerformanceMetrics {
    scanTime: number
    searchTime: number
    downloadTime: number
    lastOperation: string
    operationCount: number
}

export interface SystemDiagnostics {
    memoryUsage: number
    diskSpace: number
    networkStatus: boolean
    backendHealth: boolean
    configIntegrity: boolean
}

export class EmojiDebugger {
    private logs: Array<{ timestamp: number; level: string; message: string; args: any[] }> = []
    private metrics: PerformanceMetrics = {
        scanTime: 0,
        searchTime: 0,
        downloadTime: 0,
        lastOperation: '',
        operationCount: 0
    }

    constructor(private logger: DebugLogger) {}

    /**
     * 记录调试信息
     */
    log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) {
        const logEntry = {
            timestamp: Date.now(),
            level,
            message,
            args
        }
        
        this.logs.push(logEntry)
        
        // 限制日志数量
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-500)
        }
        
        // 输出到控制台
        this.logger[level](message, ...args)
    }

    /**
     * 性能计时开始
     */
    startTimer(operation: string): () => number {
        const startTime = performance.now()
        this.log('debug', `开始计时: ${operation}`)
        
        return () => {
            const duration = performance.now() - startTime
            this.metrics.lastOperation = operation
            this.metrics.operationCount++
            
            switch (operation) {
                case 'scan':
                    this.metrics.scanTime = duration
                    break
                case 'search':
                    this.metrics.searchTime = duration
                    break
                case 'download':
                    this.metrics.downloadTime = duration
                    break
            }
            
            this.log('debug', `计时结束: ${operation} - ${duration.toFixed(2)}ms`)
            return duration
        }
    }

    /**
     * 获取性能指标
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics }
    }

    /**
     * 获取日志
     */
    getLogs(level?: string, limit?: number): Array<{ timestamp: number; level: string; message: string; args: any[] }> {
        let filteredLogs = this.logs
        
        if (level) {
            filteredLogs = this.logs.filter(log => log.level === level)
        }
        
        if (limit) {
            filteredLogs = filteredLogs.slice(-limit)
        }
        
        return filteredLogs.reverse() // 最新的在前面
    }

    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = []
        this.log('info', '日志已清空')
    }

    /**
     * 导出调试信息
     */
    exportDebugInfo(): string {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            logs: this.logs.slice(-100), // 最近100条日志
            system: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                memory: (performance as any).memory ? {
                    used: (performance as any).memory.usedJSHeapSize,
                    total: (performance as any).memory.totalJSHeapSize,
                    limit: (performance as any).memory.jsHeapSizeLimit
                } : null
            }
        }
        
        return JSON.stringify(debugInfo, null, 2)
    }

    /**
     * 系统诊断
     */
    async runDiagnostics(): Promise<SystemDiagnostics> {
        this.log('info', '开始系统诊断')
        
        const diagnostics: SystemDiagnostics = {
            memoryUsage: 0,
            diskSpace: 0,
            networkStatus: false,
            backendHealth: false,
            configIntegrity: false
        }

        try {
            // 内存使用情况
            if ((performance as any).memory) {
                diagnostics.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
            }

            // 网络状态检查
            try {
                await fetch('https://api.bilibili.com/x/web-interface/nav', {
                    method: 'HEAD',
                    mode: 'no-cors'
                })
                diagnostics.networkStatus = true
            } catch {
                diagnostics.networkStatus = false
            }

            this.log('info', '系统诊断完成', diagnostics)
        } catch (error) {
            this.log('error', '系统诊断失败', error)
        }

        return diagnostics
    }

    /**
     * 测试表情包功能
     */
    async testEmojiFeatures(context: any): Promise<{ [key: string]: boolean }> {
        const results: { [key: string]: boolean } = {}
        
        this.log('info', '开始功能测试')

        // 测试本地搜索
        try {
            const searchResult = await context.callRPC('bilibili-emoji', 'searchEmoji', '测试', 1)
            results.localSearch = Array.isArray(searchResult)
            this.log('info', '本地搜索测试', results.localSearch ? '通过' : '失败')
        } catch (error) {
            results.localSearch = false
            this.log('error', '本地搜索测试失败', error)
        }

        // 测试配置读取
        try {
            const debugInfo = await context.callRPC('bilibili-emoji', 'getDebugInfo')
            results.configRead = debugInfo && typeof debugInfo === 'object'
            this.log('info', '配置读取测试', results.configRead ? '通过' : '失败')
        } catch (error) {
            results.configRead = false
            this.log('error', '配置读取测试失败', error)
        }

        // 测试工具调用
        try {
            const toolResult = await context.callTool('debug_emoji_plugin', { infoType: 'status' })
            results.toolCall = toolResult && toolResult.success
            this.log('info', '工具调用测试', results.toolCall ? '通过' : '失败')
        } catch (error) {
            results.toolCall = false
            this.log('error', '工具调用测试失败', error)
        }

        this.log('info', '功能测试完成', results)
        return results
    }

    /**
     * 生成测试报告
     */
    generateTestReport(testResults: { [key: string]: boolean }): string {
        const passedTests = Object.values(testResults).filter(Boolean).length
        const totalTests = Object.keys(testResults).length
        const passRate = (passedTests / totalTests * 100).toFixed(1)

        let report = `# B站表情包插件测试报告\n\n`
        report += `**生成时间**: ${new Date().toLocaleString()}\n`
        report += `**测试通过率**: ${passRate}% (${passedTests}/${totalTests})\n\n`
        
        report += `## 测试结果\n\n`
        for (const [testName, passed] of Object.entries(testResults)) {
            const status = passed ? '✅ 通过' : '❌ 失败'
            report += `- **${testName}**: ${status}\n`
        }
        
        report += `\n## 性能指标\n\n`
        report += `- **扫描时间**: ${this.metrics.scanTime.toFixed(2)}ms\n`
        report += `- **搜索时间**: ${this.metrics.searchTime.toFixed(2)}ms\n`
        report += `- **下载时间**: ${this.metrics.downloadTime.toFixed(2)}ms\n`
        report += `- **操作次数**: ${this.metrics.operationCount}\n`
        
        report += `\n## 最近日志\n\n`
        const recentLogs = this.getLogs(undefined, 10)
        for (const log of recentLogs) {
            const time = new Date(log.timestamp).toLocaleTimeString()
            report += `- **${time}** [${log.level.toUpperCase()}] ${log.message}\n`
        }

        return report
    }
}

/**
 * 创建调试器实例
 */
export function createDebugger(logger: DebugLogger): EmojiDebugger {
    return new EmojiDebugger(logger)
}

/**
 * 调试工具函数
 */
export const debugUtils = {
    /**
     * 格式化文件大小
     */
    formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`
    },

    /**
     * 格式化时间间隔
     */
    formatDuration(ms: number): string {
        if (ms < 1000) return `${ms.toFixed(0)}ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
        return `${(ms / 3600000).toFixed(1)}h`
    },

    /**
     * 生成随机测试数据
     */
    generateTestEmoji(): any {
        const categories = ['测试分类1', '测试分类2', '测试分类3']
        const types = ['static', 'gif']
        
        return {
            name: `测试表情${Math.floor(Math.random() * 1000)}`,
            path: `/test/path/emoji${Math.floor(Math.random() * 1000)}.png`,
            type: types[Math.floor(Math.random() * types.length)],
            category: categories[Math.floor(Math.random() * categories.length)]
        }
    },

    /**
     * 验证表情包数据结构
     */
    validateEmojiData(emoji: any): boolean {
        return (
            emoji &&
            typeof emoji.name === 'string' &&
            typeof emoji.path === 'string' &&
            ['static', 'gif'].includes(emoji.type) &&
            typeof emoji.category === 'string'
        )
    },

    /**
     * 检查网络连接
     */
    async checkNetworkConnection(): Promise<boolean> {
        try {
            await fetch('https://api.bilibili.com/x/web-interface/nav', {
                method: 'HEAD',
                mode: 'no-cors'
            })
            return true
        } catch {
            return false
        }
    }
}

/**
 * 全局调试对象（用于浏览器控制台）
 */
export const emojiDebug = {
    help() {
        console.log(`
🐛 B站表情包插件调试工具

可用命令:
- emojiDebug.info()           - 显示插件信息
- emojiDebug.status()         - 显示运行状态
- emojiDebug.logs()           - 显示最近日志
- emojiDebug.metrics()        - 显示性能指标
- emojiDebug.test()           - 运行功能测试
- emojiDebug.export()         - 导出调试信息
- emojiDebug.clear()          - 清空日志
- emojiDebug.navigate()       - 打开调试页面

示例:
  emojiDebug.test()           // 运行所有测试
  emojiDebug.logs('error')    // 只显示错误日志
  emojiDebug.export()         // 导出调试数据
        `)
    },

    info() {
        console.log('📊 B站表情包插件信息', {
            name: 'bilibili-emoji',
            version: '3.0.0',
            description: 'B站表情包管理、下载和发送（支持DLC，智能提取）'
        })
    },

    status() {
        console.log('🔍 插件状态检查中...')
        // 这里会被实际的状态检查替换
    },

    logs(level?: string) {
        console.log('📝 插件日志', { level })
        // 这里会被实际的日志显示替换
    },

    metrics() {
        console.log('📈 性能指标')
        // 这里会被实际的指标显示替换
    },

    async test() {
        console.log('🧪 开始功能测试...')
        // 这里会被实际的测试替换
    },

    export() {
        console.log('📤 导出调试信息...')
        // 这里会被实际的导出替换
    },

    clear() {
        console.log('🗑️ 清空日志')
        // 这里会被实际的清空替换
    },

    navigate() {
        console.log('🔗 打开调试页面...')
        // 这里会被实际的导航替换
    }
}