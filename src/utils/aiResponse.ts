// 中文注释：解析AI响应字符串，仅支持中文消息项
import type { PetResponseItem } from '../types/ai'

// 中文注释：将 <item> 内部文本解析为 PetResponseItem（仅中文，不含分隔符）
export function parsePetResponseItemString(response: string): PetResponseItem | null {
  const message = (response ?? '').trim()
  if (!message) return null
  return { message }
}

// 中文注释：从内容中提取所有 <item>...<\/item> 为 PetResponseItem 数组
export function extractItemsFromContent(content: string): PetResponseItem[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const result: PetResponseItem[] = []
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(content)) !== null) {
    const itemContent = match[1] ?? ''
    const parsed = parsePetResponseItemString(itemContent)
    if (parsed) result.push(parsed)
  }
  return result
}
