import { tool } from "ai";
import { z } from "zod";
import { useMemoryStore } from "../../stores/memory";

const description = `Apply a text patch to the given text.
Your patch language is a stripped‑down, file‑oriented diff format designed to be easy to parse and safe to apply. You can think of it as a high‑level envelope:

*** Begin Patch
[ one or more file sections ]
*** End Patch

For instructions on [context_before] and [context_after]:
- By default, show 1 lines of code immediately above and 1 lines immediately below each change. 
@@ ## 用户画像
[1 line of pre-context]
- [old_text]
+ [new_text]
[1 line of post-context]

The full grammar definition is below:
Patch := Begin { FileOp } End
Begin := "*** Begin Patch" NEWLINE
End := "*** End Patch" NEWLINE
FileOp := "@@" [ header ] NEWLINE { HunkLine } [ "*** End of File" NEWLINE ]
HunkLine := (" " | "-" | "+") text NEWLINE

A full patch can combine several operations:

*** Begin Patch
@@ #### 事实记忆
 用户正在做Agent研究
-用户不喜欢吃甜食
+用户喜欢吃甜食
@@ #### 用户画像推测
+用户可能喜欢二次元美少女
*** End Patch

NOTES:
- Please exactly copy the pre-context, so that the patch can be matched correctly.
- please distinguish between full-width and half-width characters, e.g., Chinese comma "，" vs. English comma "," or Chinese quote "“”" vs. English quote "".
`

export const applyPatchToCharacterState = tool({
  description: description,
  inputSchema: z.object({
    patch: z.string().describe('The unified diff patch to apply'),
  }),
  execute: async ({ patch }) => {
    try {
      useMemoryStore().applyPatchToCharacterState(patch);
      console.log('Applied patch to characterState:', patch);
      console.log('New characterState:', useMemoryStore().characterState);
      return 'Successfully applied patch to memory';
    } catch (error) {
      console.error('Error applying patch to memory:', error);
      return '修改文本失败，请检查你是否混淆了中英文符号，或者没有匹配到正确的上下文行。';
    }
  },
});

export const applyPatchToHistoryTasks = tool({
  description: '和 applyPatchToCharacterState 完全一致，但作用于历史任务文本。在修改历史文本时，请精简地提炼',
  inputSchema: z.object({
    patch: z.string().describe('The unified diff patch to apply'),
  }),
  execute: async ({ patch }) => {
    try {
      useMemoryStore().applyPatchToHistoryTasks(patch);
      console.log('Applied patch to history tasks:', patch);
      return 'Successfully applied patch to history tasks';
    } catch (error) {
      console.error('Error applying patch to history tasks:', error);
      return '修改文本失败，请检查你是否混淆了中英文符号，或者没有匹配到正确的上下文行。';
    }
  },
});