// Live2D模型管理服务
import { appDataDir, join } from '@tauri-apps/api/path'
import { 
  exists, 
  readDir, 
  readTextFile, 
  writeTextFile, 
  copyFile, 
  mkdir,
  remove
} from '@tauri-apps/plugin-fs'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { 
  Live2DModelInfo, 
  Live2DModelMetadata
} from '../types/live2d'

export class Live2DModelService {
  private static instance: Live2DModelService
  private modelsDir: string | null = null

  private constructor() {}

  static getInstance(): Live2DModelService {
    if (!Live2DModelService.instance) {
      Live2DModelService.instance = new Live2DModelService()
    }
    return Live2DModelService.instance
  }

  /**
   * 获取应用数据目录中的模型存储路径
   */
  async getModelsDataDir(): Promise<string> {
    if (this.modelsDir) {
      return this.modelsDir
    }

    try {
      const dataDir = await appDataDir()
      this.modelsDir = await join(dataDir, 'models')
      
      // 确保目录存在
      if (!(await exists(this.modelsDir))) {
        await mkdir(this.modelsDir, { recursive: true })
      }
      
      return this.modelsDir
    } catch (error) {
      console.error('Failed to get models data directory:', error)
      throw new Error('Failed to initialize models directory')
    }
  }

  /**
   * 导入模型目录到数据目录（保持原有目录结构）
   */
  async importModel(sourcePath: string): Promise<string> {
    try {
      const modelsDir = await this.getModelsDataDir()
      
      // 从源路径提取目录名作为模型ID
      const modelId = sourcePath.split(/[/\\]/).pop() || 'unknown_model'
      const targetPath = await join(modelsDir, modelId)
      
      // 检查目标目录是否已存在
      if (await exists(targetPath)) {
        throw new Error(`Model with ID "${modelId}" already exists`)
      }
      
      // 递归复制整个目录
      await this.copyDirectory(sourcePath, targetPath)
      
      // 查找配置文件
      const configFile = await this.findModelConfigFile(targetPath)
      if (!configFile) {
        // 如果没有找到配置文件，清理已复制的目录
        await remove(targetPath, { recursive: true })
        throw new Error('No valid Live2D model configuration file found (model3.json or model.json)')
      }
      
      // 创建元数据文件
      const metadata: Live2DModelMetadata = {
        id: modelId,
        name: modelId,
        importedAt: new Date().toISOString(),
        configFile
      }
      
      const metadataPath = await join(targetPath, '.metadata.json')
      await writeTextFile(metadataPath, JSON.stringify(metadata, null, 2))
      
      return modelId
    } catch (error) {
      console.error('Failed to import model:', error)
      throw new Error(`Failed to import model: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // 创建目标目录
      await mkdir(targetPath, { recursive: true })
      
      // 读取源目录内容
      const entries = await readDir(sourcePath)
      
      for (const entry of entries) {
        const sourceItemPath = await join(sourcePath, entry.name)
        const targetItemPath = await join(targetPath, entry.name)
        
        if (entry.isDirectory) {
          // 递归复制子目录
          await this.copyDirectory(sourceItemPath, targetItemPath)
        } else {
          // 复制文件
          await copyFile(sourceItemPath, targetItemPath)
        }
      }
    } catch (error) {
      console.error('Failed to copy directory:', error)
      throw error
    }
  }

  /**
   * 扫描模型目录，查找配置文件（支持model3.json和model.json）
   */
  async findModelConfigFile(modelPath: string): Promise<string | null> {
    try {
      const configFiles = ['model3.json', 'model.json']
      
      // 递归搜索配置文件
      const foundFile = await this.searchConfigFileRecursively(modelPath, configFiles)
      return foundFile
    } catch (error) {
      console.error('Failed to find model config file:', error)
      return null
    }
  }

  /**
   * 递归搜索配置文件
   */
  private async searchConfigFileRecursively(dirPath: string, configFiles: string[]): Promise<string | null> {
    try {
      const entries = await readDir(dirPath)
      
      // 首先在当前目录查找配置文件
      for (const entry of entries) {
        if (!entry.isDirectory && configFiles.includes(entry.name)) {
          // 返回相对于模型根目录的路径
          const relativePath = dirPath.replace(await this.getModelsDataDir(), '').replace(/^[/\\]/, '')
          const modelId = relativePath.split(/[/\\]/)[0]
          const configRelativePath = dirPath.replace(await join(await this.getModelsDataDir(), modelId), '').replace(/^[/\\]/, '')
          return configRelativePath ? await join(configRelativePath, entry.name) : entry.name
        }
      }
      
      // 然后递归搜索子目录
      for (const entry of entries) {
        if (entry.isDirectory) {
          const subDirPath = await join(dirPath, entry.name)
          const found = await this.searchConfigFileRecursively(subDirPath, configFiles)
          if (found) {
            return found
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error searching config file:', error)
      return null
    }
  }

  /**
   * 获取所有可用模型列表
   */
  async getAvailableModels(): Promise<Live2DModelInfo[]> {
    try {
      const modelsDir = await this.getModelsDataDir()
      
      if (!(await exists(modelsDir))) {
        return []
      }
      
      const entries = await readDir(modelsDir)
      const models: Live2DModelInfo[] = []
      
      for (const entry of entries) {
        if (entry.isDirectory) {
          const modelPath = await join(modelsDir, entry.name)
          const metadataPath = await join(modelPath, '.metadata.json')
          
          try {
            let metadata: Live2DModelMetadata
            
            if (await exists(metadataPath)) {
              // 读取现有元数据
              const metadataContent = await readTextFile(metadataPath)
              metadata = JSON.parse(metadataContent)
            } else {
              // 为没有元数据的模型创建元数据
              const configFile = await this.findModelConfigFile(modelPath)
              if (!configFile) {
                console.warn(`Skipping model ${entry.name}: no valid config file found`)
                continue
              }
              
              metadata = {
                id: entry.name,
                name: entry.name,
                importedAt: new Date().toISOString(),
                configFile
              }
              
              // 保存元数据
              await writeTextFile(metadataPath, JSON.stringify(metadata, null, 2))
            }
            
            models.push({
              id: metadata.id,
              name: metadata.name,
              path: modelPath,
              configFile: metadata.configFile
            })
          } catch (error) {
            console.warn(`Failed to load model ${entry.name}:`, error)
          }
        }
      }
      
      return models
    } catch (error) {
      console.error('Failed to get available models:', error)
      return []
    }
  }

  /**
   * 删除指定模型
   */
  async deleteModel(modelId: string): Promise<void> {
    try {
      const modelsDir = await this.getModelsDataDir()
      const modelPath = await join(modelsDir, modelId)
      
      if (!(await exists(modelPath))) {
        throw new Error(`Model with ID "${modelId}" not found`)
      }
      
      await remove(modelPath, { recursive: true })
    } catch (error) {
      console.error('Failed to delete model:', error)
      throw new Error(`Failed to delete model: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 获取模型的安全访问URL
   */
  getModelUrl(modelId: string, fileName: string): string {
    try {
      // 构建完整的文件路径
      const filePath = `${this.modelsDir}/${modelId}/${fileName}`
      // 使用Tauri的convertFileSrc转换为安全的资源URL
      return convertFileSrc(filePath)
    } catch (error) {
      console.error('Failed to get model URL:', error)
      throw new Error(`Failed to get model URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 获取模型配置文件的完整路径
   */
  async getModelConfigPath(modelId: string): Promise<string | null> {
    try {
      const models = await this.getAvailableModels()
      const model = models.find(m => m.id === modelId)
      
      if (!model) {
        return null
      }
      
      return await join(model.path, model.configFile)
    } catch (error) {
      console.error('Failed to get model config path:', error)
      return null
    }
  }
}

// 导出单例实例
export const live2dModelService = Live2DModelService.getInstance()
/**
 * 便捷
函数：初始化模型服务并加载可用模型到store
 */
export async function initializeLive2DModels() {
  try {
    const models = await live2dModelService.getAvailableModels()
    console.log(`已加载 ${models.length} 个Live2D模型`)
    return models
  } catch (error) {
    console.error('初始化Live2D模型失败:', error)
    return []
  }
}

/**
 * 便捷函数：验证模型是否有效
 */
export async function validateModel(modelId: string): Promise<boolean> {
  try {
    const configPath = await live2dModelService.getModelConfigPath(modelId)
    return configPath !== null
  } catch (error) {
    console.error(`验证模型 ${modelId} 失败:`, error)
    return false
  }
}