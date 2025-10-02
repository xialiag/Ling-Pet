/**
 * 插件运行时管理器
 * 负责管理插件的后端进程
 */

import { invoke } from '@tauri-apps/api/core'

export interface PluginBackendInfo {
  name: string
  port: number
  process?: any
  apiUrl: string
  status: 'starting' | 'running' | 'stopped' | 'error'
}

export class PluginRuntime {
  private backends = new Map<string, PluginBackendInfo>()
  private basePort = 13000 // 插件后端起始端口
  
  /**
   * 启动插件后端
   */
  async startBackend(pluginName: string, pluginPath: string): Promise<string | null> {
    try {
      console.log(`[PluginRuntime] 启动插件后端: ${pluginName}`)
      
      // 检查是否有后端
      const hasBackend = await this.checkBackendExists(pluginPath)
      if (!hasBackend) {
        console.log(`[PluginRuntime] 插件 ${pluginName} 没有后端`)
        return null
      }
      
      // 分配端口
      const port = this.basePort + this.backends.size
      
      // 启动后端进程
      const backendInfo: PluginBackendInfo = {
        name: pluginName,
        port,
        apiUrl: `http://localhost:${port}`,
        status: 'starting'
      }
      
      this.backends.set(pluginName, backendInfo)
      
      // 根据后端类型启动
      const backendType = await this.detectBackendType(pluginPath)
      
      if (backendType === 'rust') {
        await this.loadRustPlugin(pluginName, pluginPath)
      } else {
        console.log(`[PluginRuntime] 插件 ${pluginName} 没有后端或后端类型不支持`)
        return null
      }
      
      backendInfo.status = 'running'
      console.log(`[PluginRuntime] 插件后端已启动: ${backendInfo.apiUrl}`)
      
      return backendInfo.apiUrl
    } catch (error) {
      console.error(`[PluginRuntime] 启动插件后端失败:`, error)
      const info = this.backends.get(pluginName)
      if (info) {
        info.status = 'error'
      }
      return null
    }
  }
  
  /**
   * 停止插件后端
   */
  async stopBackend(pluginName: string): Promise<void> {
    const info = this.backends.get(pluginName)
    if (!info) return
    
    try {
      console.log(`[PluginRuntime] 停止插件后端: ${pluginName}`)
      
      if (info.process) {
        await info.process.kill()
      }
      
      info.status = 'stopped'
      this.backends.delete(pluginName)
      
      console.log(`[PluginRuntime] 插件后端已停止: ${pluginName}`)
    } catch (error) {
      console.error(`[PluginRuntime] 停止插件后端失败:`, error)
    }
  }
  
  /**
   * 获取插件后端信息
   */
  getBackendInfo(pluginName: string): PluginBackendInfo | undefined {
    return this.backends.get(pluginName)
  }
  
  /**
   * 检查插件是否有后端
   */
  private async checkBackendExists(pluginPath: string): Promise<boolean> {
    try {
      // 检查是否存在backend目录
      const backendPath = `${pluginPath}/backend`
      const exists = await invoke<boolean>('plugin_check_path', { path: backendPath })
      return exists
    } catch {
      return false
    }
  }
  
  /**
   * 检测后端类型
   */
  private async detectBackendType(pluginPath: string): Promise<'rust' | null> {
    try {
      // 检查Cargo.toml (Rust动态库)
      const hasCargoToml = await invoke<boolean>('plugin_check_path', { 
        path: `${pluginPath}/backend/Cargo.toml` 
      })
      if (hasCargoToml) return 'rust'
      
      return null
    } catch {
      return null
    }
  }
  

  
  /**
   * 加载Rust插件（动态库）
   */
  private async loadRustPlugin(pluginName: string, pluginPath: string): Promise<void> {
    try {
      console.log(`[PluginRuntime] 加载Rust插件: ${pluginName}`)
      
      // 检测平台和动态库文件
      const platform = await invoke<string>('plugin_get_platform')
      let libName: string
      
      if (platform === 'windows') {
        libName = `${pluginName.replace(/-/g, '_')}_plugin.dll`
      } else if (platform === 'darwin') {
        libName = `lib${pluginName.replace(/-/g, '_')}_plugin.dylib`
      } else {
        libName = `lib${pluginName.replace(/-/g, '_')}_plugin.so`
      }
      
      const libPath = `${pluginPath}/backend/target/release/${libName}`
      
      // 调用Tauri命令加载动态库
      await invoke('plugin_load_rust_library', {
        pluginName,
        libPath
      })
      
      console.log(`[PluginRuntime] Rust插件加载成功: ${pluginName}`)
    } catch (error) {
      console.error(`[PluginRuntime] 加载Rust插件失败:`, error)
      throw error
    }
  }
  
  /**
   * 停止所有后端
   */
  async stopAllBackends(): Promise<void> {
    const promises = Array.from(this.backends.keys()).map(name => 
      this.stopBackend(name)
    )
    await Promise.all(promises)
  }
}

// 全局运行时实例
export const pluginRuntime = new PluginRuntime()
