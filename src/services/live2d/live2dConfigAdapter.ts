// 中文注释: 提供 Live2D 配置路径重写与 Cubism 核心加载
import { convertFileSrc } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'

// 中文注释: 定义常见的模型资源扩展名以判断是否需要转换
const PATH_EXT_PATTERN = /\.(?:moc3?|json|png|jpe?g|mp4|mp3|wav|ogg|m4a)$/i

// 中文注释: 判断字符串是否已经是绝对访问地址
const ABSOLUTE_PROTOCOL_PATTERN = /^(?:https?:|data:|tauri:)/i

// 中文注释: 递归重写任意节点
async function rewriteNode(node: unknown, baseDir: string): Promise<unknown> {
  // 中文注释: 处理数组类型
  if (Array.isArray(node)) {
    return Promise.all(node.map(item => rewriteNode(item, baseDir)))
  }

  // 中文注释: 处理对象类型
  if (node && typeof node === 'object') {
    const entries = await Promise.all(
      Object.entries(node as Record<string, unknown>).map(async ([key, value]) => {
        return [key, await rewriteNode(value, baseDir)] as const
      })
    )
    return Object.fromEntries(entries)
  }

  // 中文注释: 处理字符串类型路径
  if (typeof node === 'string') {
    if (!ABSOLUTE_PROTOCOL_PATTERN.test(node) && PATH_EXT_PATTERN.test(node)) {
      const resolved = await join(baseDir, node)
      return convertFileSrc(resolved)
    }
    return node
  }

  // 中文注释: 其余类型保持原样
  return node
}

// 中文注释: 对外暴露的配置转换函数
export async function transformLive2DConfig<T>(config: T, baseDir: string): Promise<T> {
  const cloned = JSON.parse(JSON.stringify(config))
  return (await rewriteNode(cloned, baseDir)) as T
}

// 中文注释: 仅在需要时加载 Cubism Core
let cubismLoaded = false

export async function ensureCubismCore(): Promise<void> {
  // 中文注释: 避免重复注入脚本
  if (cubismLoaded) return
  const scope = window as unknown as { Live2DCubismCore?: unknown }
  if (scope.Live2DCubismCore) {
    cubismLoaded = true
    return
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/live2d-core/live2dcubismcore.min.js'
    script.async = true
    script.onload = () => {
      cubismLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Cubism core script'))
    document.head.appendChild(script)
  })
}
