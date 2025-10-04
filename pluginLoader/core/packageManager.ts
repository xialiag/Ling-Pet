/**
 * 插件包管理器 - 处理插件的安装、卸载、更新
 */

import { invoke } from '@tauri-apps/api/core'
import { join, appDataDir } from '@tauri-apps/api/path'
import { exists, readTextFile, readDir, mkdir, remove } from '@tauri-apps/plugin-fs'

export interface PluginManifest {
    id: string
    name: string
    version: string
    description: string
    author?: string
    homepage?: string
    entry: string
    icon?: string
    permissions: string[]
    dependencies?: Record<string, string>
    backend?: {
        enabled: boolean
        entry: string
        commands: string[]
    }
    config?: Record<string, any>
}

export interface InstalledPlugin {
    manifest: PluginManifest
    path: string
    enabled: boolean
    loaded: boolean
}

/**
 * 插件包管理器
 */
export class PluginPackageManager {
    private pluginsDir: string = ''
    private installedPlugins = new Map<string, InstalledPlugin>()

    /**
     * 初始化
     */
    async initialize(): Promise<void> {
        // 获取插件目录
        const appData = await appDataDir()
        this.pluginsDir = await join(appData, 'plugins')

        // 确保目录存在
        if (!await exists(this.pluginsDir)) {
            await mkdir(this.pluginsDir, { recursive: true })
        }

        // 扫描已安装的插件
        await this.scanInstalledPlugins()

        console.log(`[PackageManager] Initialized, plugins dir: ${this.pluginsDir}`)
    }

    /**
     * 扫描已安装的插件
     */
    private async scanInstalledPlugins(): Promise<void> {
        try {
            await this.scanPluginDirectory(this.pluginsDir)
        } catch (error) {
            console.error('[PackageManager] Failed to scan plugins:', error)
        }
    }

    /**
     * 递归扫描插件目录
     */
    private async scanPluginDirectory(dirPath: string, depth: number = 0): Promise<void> {
        // 限制递归深度，避免无限递归
        if (depth > 3) return

        try {
            const entries = await readDir(dirPath)

            for (const entry of entries) {
                if (entry.isDirectory) {
                    const pluginPath = await join(dirPath, entry.name)
                    const manifestPath = await join(pluginPath, 'manifest.json')

                    // 检查当前目录是否包含 manifest.json
                    if (await exists(manifestPath)) {
                        try {
                            const manifestContent = await readTextFile(manifestPath)
                            const manifest: PluginManifest = JSON.parse(manifestContent)

                            this.installedPlugins.set(manifest.id, {
                                manifest,
                                path: pluginPath,
                                enabled: false,
                                loaded: false
                            })

                            console.log(`[PackageManager] Found plugin: ${manifest.id}`)
                        } catch (error) {
                            console.error(`[PackageManager] Failed to load manifest for ${entry.name}:`, error)
                        }
                    } else {
                        // 如果没有 manifest.json，继续递归扫描子目录
                        await this.scanPluginDirectory(pluginPath, depth + 1)
                    }
                }
            }
        } catch (error) {
            // 忽略无法访问的目录
        }
    }

    /**
     * 安装插件（从zip文件）
     * 注意：插件应该预先编译好，zip包中包含编译后的文件
     */
    async installPlugin(zipPath: string): Promise<boolean> {
        try {
            console.log(`[PackageManager] Installing plugin from: ${zipPath}`)

            // 调用Rust后端解压插件
            const result = await invoke<{ success: boolean; pluginId: string; error?: string }>(
                'plugin_install',
                { zipPath, targetDir: this.pluginsDir }
            )

            if (!result.success) {
                throw new Error(result.error || 'Installation failed')
            }

            // 重新扫描插件
            await this.scanInstalledPlugins()

            console.log(`[PackageManager] Plugin ${result.pluginId} installed successfully`)
            return true
        } catch (error) {
            console.error('[PackageManager] Failed to install plugin:', error)
            return false
        }
    }

    /**
     * 卸载插件
     */
    async uninstallPlugin(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.installedPlugins.get(pluginId)
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} not found`)
            }

            console.log(`[PackageManager] Uninstalling plugin: ${pluginId}`)

            // 删除插件目录（递归删除）
            await remove(plugin.path, { recursive: true })

            // 删除插件配置
            await invoke('plugin_remove_config', { pluginId })

            // 从列表中移除
            this.installedPlugins.delete(pluginId)

            console.log(`[PackageManager] Plugin ${pluginId} uninstalled`)
            return true
        } catch (error) {
            console.error(`[PackageManager] Failed to uninstall plugin ${pluginId}:`, error)
            return false
        }
    }

    /**
     * 加载插件的动态库（预编译的）
     * 插件包中应该包含编译好的动态库文件：
     * - Windows: plugin.dll
     * - macOS: libplugin.dylib
     * - Linux: libplugin.so
     */
    async loadBackend(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.installedPlugins.get(pluginId)
            if (!plugin?.manifest.backend?.enabled) {
                return false
            }

            console.log(`[PackageManager] Loading backend for ${pluginId}`)
            console.log(`[PackageManager] Plugin path: ${plugin.path}`)
            console.log(`[PackageManager] Backend entry: ${plugin.manifest.backend.entry}`)

            // 获取动态库路径
            const backendPath = await join(plugin.path, plugin.manifest.backend.entry)
            console.log(`[PackageManager] Full backend path: ${backendPath}`)

            // 检查文件是否存在
            const fileExists = await exists(backendPath)
            console.log(`[PackageManager] Backend file exists: ${fileExists}`)

            if (!fileExists) {
                throw new Error(`Backend file not found: ${backendPath}`)
            }

            // 调用Rust后端加载动态库
            const result = await invoke<{ success: boolean; error?: string }>(
                'plugin_load_backend',
                { pluginId, backendPath }
            )

            if (!result.success) {
                throw new Error(result.error || 'Failed to load backend')
            }

            console.log(`[PackageManager] Backend loaded for ${pluginId}`)
            return true
        } catch (error) {
            console.error(`[PackageManager] Failed to load backend for ${pluginId}:`, error)
            return false
        }
    }

    /**
     * 卸载插件的动态库
     */
    async unloadBackend(pluginId: string): Promise<boolean> {
        try {
            const plugin = this.installedPlugins.get(pluginId)
            if (!plugin?.manifest.backend?.enabled) {
                return false
            }

            console.log(`[PackageManager] Unloading backend for ${pluginId}`)

            await invoke('plugin_unload_backend', { pluginId })

            console.log(`[PackageManager] Backend unloaded for ${pluginId}`)
            return true
        } catch (error) {
            console.error(`[PackageManager] Failed to unload backend for ${pluginId}:`, error)
            return false
        }
    }

    /**
     * 获取已安装的插件列表
     */
    getInstalledPlugins(): InstalledPlugin[] {
        return Array.from(this.installedPlugins.values())
    }

    /**
     * 获取插件信息
     */
    getPlugin(pluginId: string): InstalledPlugin | undefined {
        return this.installedPlugins.get(pluginId)
    }

    /**
     * 标记插件为已启用
     */
    setPluginEnabled(pluginId: string, enabled: boolean): void {
        const plugin = this.installedPlugins.get(pluginId)
        if (plugin) {
            plugin.enabled = enabled
        }
    }

    /**
     * 标记插件为已加载
     */
    setPluginLoaded(pluginId: string, loaded: boolean): void {
        const plugin = this.installedPlugins.get(pluginId)
        if (plugin) {
            plugin.loaded = loaded
        }
    }

    /**
     * 获取插件目录
     */
    getPluginsDir(): string {
        return this.pluginsDir
    }

    /**
     * 获取插件路径
     */
    async getPluginPath(pluginId: string): Promise<string | null> {
        const plugin = this.installedPlugins.get(pluginId)
        return plugin ? plugin.path : null
    }

    /**
     * 读取插件文件
     */
    async readPluginFile(pluginId: string, filePath: string): Promise<string> {
        const plugin = this.installedPlugins.get(pluginId)
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`)
        }

        const fullPath = await join(plugin.path, filePath)
        return readTextFile(fullPath)
    }

    /**
     * 检查权限
     */
    checkPermission(pluginId: string, permission: string): boolean {
        const plugin = this.installedPlugins.get(pluginId)
        if (!plugin) {
            return false
        }

        return plugin.manifest.permissions.includes(permission)
    }
}

// 全局实例
export const packageManager = new PluginPackageManager()
