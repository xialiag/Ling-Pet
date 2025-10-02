// Live2D模型相关类型定义

export interface Live2DModelInfo {
  id: string           // 模型唯一标识（使用目录名）
  name: string         // 显示名称
  path: string         // 模型目录路径
  configFile: string   // 配置文件相对路径（可能是model3.json或model.json）
}

export interface Live2DModelMetadata {
  id: string
  name: string
  importedAt: string
  configFile: string
}

export enum Live2DModelError {
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  INVALID_MODEL_FORMAT = 'INVALID_MODEL_FORMAT',
  IMPORT_FAILED = 'IMPORT_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  LOAD_FAILED = 'LOAD_FAILED'
}