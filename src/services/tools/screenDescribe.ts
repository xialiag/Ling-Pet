// import {tool} from 'ai'
// import z from 'zod';
// import { describeScreens } from '../screenAnalysis/screenDescription'

// export const screenDescribeTool = tool({
//   description: '对指定或当前可截图窗口进行视觉描述，返回文本结果。如果你想查看某个窗口，就需要调用这个工具',
//   inputSchema: z.object({
//     windowId: z.string().optional().describe('要描述的窗口ID，留空表示自动检测多个窗口'),
//   }),
//   execute: async ({ windowId }) => {
//     try {
//       let target: number[] | null = null
//       const raw = (windowId ?? '').trim()
//       if (raw.length > 0) {
//         const n = Number(raw)
//         if (!Number.isFinite(n)) {
//           return 'invalid windowId'
//         }
//         target = [n]
//       }

//       const result = await describeScreens(target)
//       return result
//     } catch (e: any) {
//       const msg = e instanceof Error ? e.message : String(e)
//       return 'screenDescribe failed: ' + msg
//     }
//   }
// })