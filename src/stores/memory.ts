import { defineStore } from 'pinia'

const defaultCharacterState =
  `#### 角色背景
空，可根据基本设定来丰富。

#### 用户画像推测
**用户特征**
空，还没有产生过推测。

**用户要求**
空

**用户正在专注的事项**
空

#### 历史交互事件
空，还没有发生过事件。
角色与用户是初次见面
`

const defaultHistoryTasks = `#### 首次测试任务
**动机**：首次任务，测试是否能够顺利修改文档
**计划**：当你看到此文档时，将“已完成”填写至结果。
**结果**：
`

export const useMemoryStore = defineStore('memory', {
  state: () => ({
    characterState: defaultCharacterState,
    historyTasks: defaultHistoryTasks,
    lastActivityQueryAt: 0,
  }),
  actions: {
    getCharacterState() {
      return this.characterState;
    },
    applyPatchToCharacterState(patch: string) {
      this.characterState = this.applyPatch(patch, this.characterState);
    },
    applyPatchToHistoryTasks(patch: string) {
      this.historyTasks = this.applyPatch(patch, this.historyTasks);
    },
    /**
     * 根据自定义 Patch 语法（见用户提供的规范）将变更应用到 characterState 文本。
     * 语法要点：
     * - 整体以 *** Begin Patch / *** End Patch 包裹
     * - 一个或多个分块，以 @@ [header] 开头
     * - 分块内每行以前缀开头：' '（上下文）、'-'（删除）、'+'（新增）
     * - 可选出现 "*** End of File" 标记，忽略即可
     * 应用策略：
     * 1) 优先在目标范围（由 header 锚定的区段，或全文）中查找 expected 块（由 ' ' 与 '-' 合成）并替换为 replacement 块（由 ' ' 与 '+' 合成）
     * 2) 若未找到，则尝试仅基于上下文（' ' 行）定位并在其后插入新增（'+' 行）
     * 3) 若仍失败：
     *    - 若存在 header：在该 header 区段末尾追加 replacement；如 header 不存在，则在文末新建 header 并追加 replacement
     */
    applyPatch(patch: string, text: string) {
      const BEGIN = '*** Begin Patch';
      const END = '*** End Patch';
      const HUNK_START = '@@';
      const END_OF_FILE = '*** End of File';

      // 如果不像一个 patch，就直接报错
      const trimmed = patch.trim();
      if (!trimmed.startsWith(BEGIN) || !trimmed.endsWith(END)) {
        throw new Error('Invalid patch format');
      }

      // 工具：分割为行（保留空行）
      const toLines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');
      const fromLines = (lines: string[]) => lines.join('\n');

      type Hunk = { header: string; lines: string[] };
      const patchLines = toLines(trimmed);

      // 提取 @@ 分块
      const hunks: Hunk[] = [];
      let i = 0;
      // 跳过第一行 *** Begin Patch
      if (patchLines[i].trim() === BEGIN) i++;
      while (i < patchLines.length) {
        const line = patchLines[i];
        if (line.trim() === END) break;
        if (line.startsWith(HUNK_START)) {
          // 解析 header
          const header = line.slice(2).trim();
          i++;
          const hunkLines: string[] = [];
          while (i < patchLines.length) {
            const l = patchLines[i];
            if (l.startsWith(HUNK_START) || l.trim() === END || l.trim() === END_OF_FILE) break;
            // 只接受以 ' ', '-', '+' 开头的行；其他行当作上下文（以空格补齐）
            if (l.startsWith(' ') || l.startsWith('-') || l.startsWith('+')) {
              hunkLines.push(l);
            } else {
              hunkLines.push(' ' + l);
            }
            i++;
          }
          hunks.push({ header, lines: hunkLines });
          // 如果遇到 *** End of File，跳过它
          if (i < patchLines.length && patchLines[i].trim() === END_OF_FILE) i++;
        } else {
          // 非法或空行，跳过
          i++;
        }
      }

      // 当前 character 行数组
      const docLines = toLines(text);

      // 一些小工具函数
      const findHeaderIndex = (header: string): number => {
        if (!header) return -1;
        return docLines.findIndex(l => l.trim() === header.trim());
      };

      const findNextSectionAfter = (startIdx: number): number => {
        if (startIdx < 0) return -1;
        for (let k = startIdx + 1; k < docLines.length; k++) {
          // 简单约定：以 "#" 开头视为下一个分节（markdown 风格）
          if (docLines[k].trim().startsWith('#')) return k;
        }
        return docLines.length; // 到文末
      };

      const stripPrefix = (s: string) => (s.length ? s.slice(1) : s);

      const buildExpectedAndReplacement = (hunkLines: string[]) => {
        const expected: string[] = [];
        const replacement: string[] = [];
        for (const hl of hunkLines) {
          if (!hl) {
            expected.push('');
            replacement.push('');
            continue;
          }
          const tag = hl[0];
          const text = stripPrefix(hl);
          if (tag === ' ') {
            expected.push(text);
            replacement.push(text);
          } else if (tag === '-') {
            expected.push(text);
          } else if (tag === '+') {
            replacement.push(text);
          }
        }
        return { expected, replacement };
      };

      const buildContextOnly = (hunkLines: string[]) => hunkLines.filter(l => l.startsWith(' ')).map(stripPrefix);

      const findSubsequence = (hay: string[], needle: string[], start = 0, end = hay.length) => {
        if (needle.length === 0) return -1;
        const lastStart = Math.max(start, 0);
        const lastIdx = Math.min(end, hay.length) - needle.length;
        for (let s = lastStart; s <= lastIdx; s++) {
          let ok = true;
          for (let j = 0; j < needle.length; j++) {
            if (hay[s + j] !== needle[j]) { ok = false; break; }
          }
          if (ok) return s;
        }
        return -1;
      };

      const insertAt = (arr: string[], idx: number, items: string[]) => {
        arr.splice(idx, 0, ...items);
      };

      const replaceAt = (arr: string[], idx: number, removeCount: number, items: string[]) => {
        arr.splice(idx, removeCount, ...items);
      };

      // 应用每个 hunk
      for (const h of hunks) {
        const { expected, replacement } = buildExpectedAndReplacement(h.lines);
        const contextOnly = buildContextOnly(h.lines);
        const hasRemovals = h.lines.some(l => l.startsWith('-'));
        const requiresExactMatch = hasRemovals || contextOnly.length > 0;
        const headerLabel = h.header?.trim() ?? '';

        // 确定搜索范围
        let searchStart = 0;
        let searchEnd = docLines.length;
        const headerIdx = h.header ? findHeaderIndex(h.header) : -1;
        if (headerIdx >= 0) {
          searchStart = headerIdx + 1;
          searchEnd = findNextSectionAfter(headerIdx);
        }

        // 1) 期望块替换
        let where = findSubsequence(docLines, expected, searchStart, searchEnd);
        if (where >= 0) {
          replaceAt(docLines, where, expected.length, replacement);
          continue;
        }

        // 2) 仅上下文匹配后插入新增
        if (contextOnly.length > 0) {
          const ctxWhere = findSubsequence(docLines, contextOnly, searchStart, searchEnd);
          if (ctxWhere >= 0) {
            const insertPos = ctxWhere + contextOnly.length; // 紧跟上下文末尾插入
            insertAt(docLines, insertPos, replacement.filter(l => !contextOnly.includes(l)));
            continue;
          }
        }

        if (requiresExactMatch) {
          const locationMsg = headerLabel ? ` near "${headerLabel}"` : '';
          throw new Error(`Patch hunk${locationMsg} did not match target content`);
        }

        // 3) 兜底：基于 header 追加；若无 header 或未找到，则在文末追加
        if (headerIdx >= 0) {
          const secEnd = findNextSectionAfter(headerIdx);
          insertAt(docLines, secEnd, replacement);
        } else {
          // 如果提供了 header 但未找到，先创建 header
          if (h.header) {
            if (docLines.length > 0 && docLines[docLines.length - 1] !== '') docLines.push('');
            docLines.push(h.header);
          }
          insertAt(docLines, docLines.length, replacement);
        }
      }

      return fromLines(docLines).replace(/\n+$/, '').trimEnd();
    }
  },
  tauri: {
    saveOnChange: true,
    saveStrategy: 'debounce',
    saveInterval: 300,
  },
});