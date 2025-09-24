// 中文注释：多次点击头像的调试/示例事件处理器
import { useConversationStore } from "../../../stores/conversation";
import type { PetResponseItem } from "../../../types/ai";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSilentWavBlob(durationMs = 600): Blob {
  const sampleRate = 16000
  const numSamples = Math.floor((durationMs / 1000) * sampleRate)
  const bytesPerSample = 2
  const dataSize = numSamples * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  let offset = 0
  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
    offset += s.length
  }
  function writeUint32(v: number) { view.setUint32(offset, v, true); offset += 4 }
  function writeUint16(v: number) { view.setUint16(offset, v, true); offset += 2 }

  writeString('RIFF')
  writeUint32(36 + dataSize)
  writeString('WAVE')
  writeString('fmt ')
  writeUint32(16)
  writeUint16(1)
  writeUint16(1)
  writeUint32(sampleRate)
  writeUint32(sampleRate * bytesPerSample)
  writeUint16(bytesPerSample)
  writeUint16(8 * bytesPerSample)
  writeString('data')
  writeUint32(dataSize)

  return new Blob([buffer], { type: 'audio/wav' })
}

// 中文注释：仅构造中文消息项（已移除表情与日语）
function item(zh: string): PetResponseItem {
  return { message: zh }
}

let scenarioIndex = 0

export async function handleAvatarMultiClick(_payload: { ts: number; threshold: number; windowMs: number }) {
  const c = useConversationStore()
  scenarioIndex = (scenarioIndex + 1) % 5

  switch (scenarioIndex) {
    case 0: {
      c.start()
      await c.addItem(item('【S0-1】我来了，这是第一句'))
      await sleep(3000)
      await c.addItem(item('【S0-2】第二句紧跟着出现'))
      await sleep(3000)
      await c.addItem(item('【S0-3】第三句也来了'))
      c.finish()
      break
    }
    case 1: {
      c.finish()
      await c.addItem(item('【S1-1】非流式：看我会延时推进'))
      await c.addItem(item('【S1-2】第二条（应有阅读间隔）'))
      await c.addItem(item('【S1-3】第三条（仍延时推进）'))
      break
    }
    case 2: {
      c.start()
      c.currentMessage = '【S2-AUDIO】先听完这段假装的语音...'
      c.playAudio(createSilentWavBlob(3000))
      await sleep(200)
      await c.addItem(item('【S2-1】音频结束后我先来'))
      await c.addItem(item('【S2-2】然后到我'))
      c.finish()
      break
    }
    case 3: {
      c.start()
      await c.addItem(item('【S3-1】流式开始，立即推进'))
      await c.addItem(item('【S3-2】还是立即推进'))
      c.finish()
      await c.addItem(item('【S3-3】现在应该延时推进了'))
      await c.addItem(item('【S3-4】继续延时推进'))
      break
    }
    default: {
      c.finish()
      await c.addItem(item('【S4-1】正常延时推进（可点头像快进）'))
      await c.addItem(item('【S4-2】再来一条（同样可快进）'))
      break
    }
  }
}
