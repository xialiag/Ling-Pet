// 中文注释: Live2D 模型管理服务
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
import type { Live2DModelInfo, Live2DModelMetadata } from '../../types/live2d'

// 中文注释: 缓存模型目录路径
let modelsDir: string | null = null

// 中文注释: 获取并缓存模型根目录
export async function getModelsDataDir(): Promise<string> {
  if (modelsDir) return modelsDir
  try {
    const dir = await appDataDir()
    const target = await join(dir, 'models')
    if (!(await exists(target))) {
      await mkdir(target, { recursive: true })
    }
    modelsDir = target
    return target
  } catch (error) {
    console.error('获取模型数据目录失败:', error)
    throw new Error('Failed to initialize models directory')
  }
}

// 中文注释: 复制模型目录并写入元数据
export async function importModel(sourcePath: string): Promise<string> {
  const targetRoot = await getModelsDataDir()
  const modelId = sourcePath.split(/[/\\]/).pop() || 'unknown_model'
  const targetPath = await join(targetRoot, modelId)
  if (await exists(targetPath)) {
    throw new Error(`Model with ID "${modelId}" already exists`)
  }
  await copyDirectory(sourcePath, targetPath)
  const configFile = await findModelConfigFile(targetPath)
  if (!configFile) {
    await remove(targetPath, { recursive: true })
    throw new Error('No valid Live2D model configuration file found (*.model3.json or *.model.json)')
  }
  const metadata: Live2DModelMetadata = {
    id: modelId,
    name: modelId,
    importedAt: new Date().toISOString(),
    configFile
  }
  const metadataPath = await join(targetPath, '.metadata.json')
  await writeTextFile(metadataPath, JSON.stringify(metadata, null, 2))
  return modelId
}

// 中文注释: 递归复制目录内容
async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const entries = await readDir(source)
  for (const entry of entries) {
    const from = await join(source, entry.name)
    const to = await join(target, entry.name)
    if (entry.isDirectory) {
      await copyDirectory(from, to)
    } else {
      await copyFile(from, to)
    }
  }
}

// 中文注释: 遍历目录寻找第一个合法配置文件
export async function findModelConfigFile(modelPath: string): Promise<string | null> {
  const queue: Array<{ path: string; rel: string }> = [{ path: modelPath, rel: '' }]
  while (queue.length) {
    const { path, rel } = queue.shift()!
    const entries = await readDir(path)
    for (const entry of entries) {
      if (!entry.isDirectory && isConfigFile(entry.name)) {
        return rel ? `${rel}/${entry.name}` : entry.name
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory) {
        const nextPath = await join(path, entry.name)
        const nextRel = rel ? `${rel}/${entry.name}` : entry.name
        queue.push({ path: nextPath, rel: nextRel })
      }
    }
  }
  return null
}

// 中文注释: 判断文件名是否为合法配置（需同时包含 model 与 json）
function isConfigFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('model') && lower.includes('json')
}

// 中文注释: 读取所有可用模型列表
export async function getAvailableModels(): Promise<Live2DModelInfo[]> {
  const root = await getModelsDataDir()
  if (!(await exists(root))) return []
  const entries = await readDir(root)
  const models: Live2DModelInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory) continue
    const modelPath = await join(root, entry.name)
    const metadataPath = await join(modelPath, '.metadata.json')
    try {
      const metadata = await readMetadata(metadataPath, modelPath, entry.name)
      models.push({ id: metadata.id, name: metadata.name, path: modelPath, configFile: metadata.configFile })
    } catch (error) {
      console.warn(`加载模型 ${entry.name} 失败:`, error)
    }
  }
  return models
}

// 中文注释: 读取或创建模型元数据
async function readMetadata(metaPath: string, modelPath: string, fallbackId: string): Promise<Live2DModelMetadata> {
  if (await exists(metaPath)) {
    const raw = await readTextFile(metaPath)
    return JSON.parse(raw) as Live2DModelMetadata
  }
  const configFile = await findModelConfigFile(modelPath)
  if (!configFile) {
    throw new Error('No config file found for model')
  }
  const metadata: Live2DModelMetadata = {
    id: fallbackId,
    name: fallbackId,
    importedAt: new Date().toISOString(),
    configFile
  }
  await writeTextFile(metaPath, JSON.stringify(metadata, null, 2))
  return metadata
}

// 中文注释: 删除指定模型
export async function deleteModel(modelId: string): Promise<void> {
  const root = await getModelsDataDir()
  const target = await join(root, modelId)
  if (!(await exists(target))) {
    throw new Error(`Model with ID "${modelId}" not found`)
  }
  await remove(target, { recursive: true })
}

// 中文注释: 获取模型文件的本地访问 URL
export function getModelUrl(modelId: string, fileName: string): string {
  if (!modelsDir) {
    throw new Error('Models directory not initialized. Call getModelsDataDir() first.')
  }
  const filePath = `${modelsDir}/${modelId}/${fileName}`
  return convertFileSrc(filePath)
}

// 中文注释: 计算模型配置文件的绝对路径
export async function getModelConfigPath(modelId: string): Promise<string | null> {
  const models = await getAvailableModels()
  const match = models.find(model => model.id === modelId)
  if (!match) return null
  return await join(match.path, match.configFile)
}

// 中文注释: 服务聚合导出
export const live2dModelService = {
  getModelsDataDir,
  importModel,
  findModelConfigFile,
  getAvailableModels,
  deleteModel,
  getModelUrl,
  getModelConfigPath
}

// 中文注释: 初始化可用模型列表
export async function initializeLive2DModels(): Promise<Live2DModelInfo[]> {
  try {
    const models = await getAvailableModels()
    console.log(`已加载 ${models.length} 个Live2D模型`)
    return models
  } catch (error) {
    console.error('初始化Live2D模型失败:', error)
    return []
  }
}

// 中文注释: 验证模型配置是否存在
export async function validateModel(modelId: string): Promise<boolean> {
  try {
    return (await getModelConfigPath(modelId)) !== null
  } catch (error) {
    console.error(`验证模型 ${modelId} 失败:`, error)
    return false
  }
}
