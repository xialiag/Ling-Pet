import type { Tool } from '../types'
import { useHypothesesStore } from '../../../stores/hypotheses'
import { useMemoryStore } from '../../../stores/memory'
import type { ExecToolResult } from '../types'

export const hypothesisAddTool: Tool = {
  name: 'hypothesisAdd',
  description:
    '参数：content（推测内容，字符串）\n' +
    '  功能：新增一条“推测”，自动分配随机 id。当你对用户的一些判断并不一定准确时，你可以加在这里。如果用户对你有什么要求，你也可以记在这里。\n' +
    '  例子：hypothesisAdd("用户最近可能在准备考试")',
  async call(content?: string): Promise<ExecToolResult> {
    const store = useHypothesesStore()
    const id = store.addHypothesis(content ?? '')
    return { ok: true, continue: false, result: JSON.stringify({ id }) }
  },
}

export const hypothesisUpdateTool: Tool = {
  name: 'hypothesisUpdate',
  description:
    '参数：id（推测ID）, content（新内容；为空字符串则删除）\n' +
    '  功能：使用 id 更新一条“推测”；当 content 为 "" 时删除该条。注意：推测仅代表你的主观判断，不保证正确。\n' +
    '  例子（更新）：hypothesisUpdate("lxt8m2y3-8n1g6k2r", "用户也许更喜欢深色主题")\n' +
    '  例子（删除）：hypothesisUpdate("lxt8m2y3-8n1g6k2r", "")',
  async call(id?: string, content?: string): Promise<ExecToolResult> {
    const store = useHypothesesStore()
    store.updateHypothesis(id ?? '', content ?? '')
    return { ok: true, continue: false, result: JSON.stringify({ id, deleted: (content ?? '') === '' }) }
  },
}

export const memoryAddTool: Tool = {
  name: 'memoryAdd',
  description:
    '参数：content（记忆内容，字符串）\n' +
    '  功能：新增一条记忆，自动分配随机 id，返回该 id。\n' +
    '  例子：memoryAdd("用户喜欢喝冰美式")',
  async call(content?: string): Promise<ExecToolResult> {
    const store = useMemoryStore()
    const id = store.addMemory(content ?? '')
    return { ok: true, continue: false, result: JSON.stringify({ id }) }
  },
}

export const memoryUpdateTool: Tool = {
  name: 'memoryUpdate',
  description:
    '参数：id（记忆ID）, content（新内容；为空字符串则删除）\n' +
    '  功能：使用 id 更新一条记忆；当 content 为 "" 时删除该记忆。\n' +
    '  例子（更新）：memoryUpdate("lxt8l3bq-2k9p1u5q", "用户常在晚上学习")\n' +
    '  例子（删除）：memoryUpdate("lxt8l3bq-2k9p1u5q", "")',
  async call(id?: string, content?: string): Promise<ExecToolResult> {
    const store = useMemoryStore()
    store.updateMemory(id ?? '', content ?? '')
    return { ok: true, continue: false, result: JSON.stringify({ id, deleted: (content ?? '') === '' }) }
  },
}

