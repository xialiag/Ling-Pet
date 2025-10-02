// Live2D模型服务验证函数
import { live2dModelService } from './live2dModelService'

/**
 * 验证Live2D模型服务的基本功能
 * 这个函数可以在开发时调用来测试服务是否正常工作
 */
export async function verifyLive2DModelService(): Promise<boolean> {
  try {
    console.log('开始验证Live2D模型服务...')
    
    // 1. 测试获取模型数据目录
    const modelsDir = await live2dModelService.getModelsDataDir()
    console.log('模型数据目录:', modelsDir)
    
    // 2. 测试获取可用模型列表
    const availableModels = await live2dModelService.getAvailableModels()
    console.log('可用模型数量:', availableModels.length)
    console.log('可用模型:', availableModels)
    
    // 3. 测试配置文件查找功能（如果有模型的话）
    if (availableModels.length > 0) {
      const firstModel = availableModels[0]
      const configPath = await live2dModelService.getModelConfigPath(firstModel.id)
      console.log(`模型 ${firstModel.id} 的配置文件路径:`, configPath)
      
      // 测试获取模型URL
      const modelUrl = live2dModelService.getModelUrl(firstModel.id, firstModel.configFile)
      console.log(`模型 ${firstModel.id} 的URL:`, modelUrl)
    }
    
    console.log('Live2D模型服务验证完成 ✓')
    return true
  } catch (error) {
    console.error('Live2D模型服务验证失败:', error)
    return false
  }
}

/**
 * 验证模型配置文件检测功能
 */
export async function verifyConfigFileDetection(modelPath: string): Promise<string | null> {
  try {
    const configFile = await live2dModelService.findModelConfigFile(modelPath)
    console.log(`在路径 ${modelPath} 找到配置文件:`, configFile)
    return configFile
  } catch (error) {
    console.error('配置文件检测失败:', error)
    return null
  }
}