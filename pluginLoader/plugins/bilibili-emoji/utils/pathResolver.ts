/**
 * 路径解析工具
 * 确保在开发和生产环境都能正确解析路径
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * 解析插件数据路径
 * 支持开发环境和打包后的生产环境
 */
export function resolvePluginDataPath(relativePath: string): string {
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
        return relativePath
    }

    // 尝试的基础路径列表（按优先级）
    const basePaths = getBasePaths()

    // 尝试每个基础路径
    for (const basePath of basePaths) {
        const fullPath = path.resolve(basePath, relativePath)
        if (fs.existsSync(fullPath)) {
            return fullPath
        }
    }

    // 如果都找不到，返回基于当前工作目录的路径
    return path.resolve(process.cwd(), relativePath)
}

/**
 * 获取可能的基础路径列表
 */
function getBasePaths(): string[] {
    const paths: string[] = []

    // 1. 当前工作目录（开发环境）
    paths.push(process.cwd())

    // 2. 可执行文件目录（生产环境）
    if (process.execPath) {
        paths.push(path.dirname(process.execPath))
    }

    // 3. 资源目录（Tauri打包后）
    // Tauri应用的资源路径通常在应用目录下
    if ((process as any).resourcesPath) {
        paths.push((process as any).resourcesPath)
        paths.push(path.join((process as any).resourcesPath, '..'))
    }

    // 4. Tauri特定路径
    // 在Tauri中，资源通常在应用的根目录或resources目录
    if (process.env.TAURI_RESOURCE_DIR) {
        paths.push(process.env.TAURI_RESOURCE_DIR)
    }

    if (process.env.APPDATA) {
        // Windows: AppData目录
        paths.push(path.join(process.env.APPDATA, '..', 'Local'))
    }

    if (process.env.HOME) {
        // macOS/Linux: Home目录
        paths.push(process.env.HOME)
        paths.push(path.join(process.env.HOME, '.local', 'share'))
    }

    // 5. __dirname（插件所在目录）
    if (typeof __dirname !== 'undefined') {
        paths.push(__dirname)
        paths.push(path.join(__dirname, '..'))
        paths.push(path.join(__dirname, '../..'))
        paths.push(path.join(__dirname, '../../..'))
    }

    // 6. 环境变量指定的路径
    if (process.env.APP_ROOT) {
        paths.push(process.env.APP_ROOT)
    }

    if (process.env.EMOJI_DATA_PATH) {
        paths.push(process.env.EMOJI_DATA_PATH)
    }

    // 去重
    return Array.from(new Set(paths))
}

/**
 * 将绝对路径转换为相对路径（用于存储）
 */
export function toRelativePath(absolutePath: string, basePath?: string): string {
    const base = basePath || process.cwd()
    return path.relative(base, absolutePath)
}

/**
 * 将文件路径转换为可在浏览器中访问的URL
 */
export function toFileUrl(filePath: string): string {
    // 确保是绝对路径
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)

    // 在Windows上，需要特殊处理
    if (process.platform === 'win32') {
        // 将反斜杠转换为正斜杠
        const normalizedPath = absolutePath.replace(/\\/g, '/')
        return `file:///${normalizedPath}`
    }

    return `file://${absolutePath}`
}

/**
 * 检查路径是否存在
 */
export function pathExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath)
    } catch {
        return false
    }
}

/**
 * 确保目录存在，不存在则创建
 */
export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

/**
 * 获取插件根目录
 */
export function getPluginRoot(): string {
    if (typeof __dirname !== 'undefined') {
        // 从 utils 目录向上两级到插件根目录
        return path.join(__dirname, '../..')
    }
    return process.cwd()
}

/**
 * 获取项目根目录
 */
export function getProjectRoot(): string {
    const basePaths = getBasePaths()

    // 查找包含 package.json 的目录
    for (const basePath of basePaths) {
        const packageJsonPath = path.join(basePath, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
            return basePath
        }
    }

    return process.cwd()
}
