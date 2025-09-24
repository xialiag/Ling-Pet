import { useMemoryStore } from "../../../stores/memory";
import { useHypothesesStore } from "../../../stores/hypotheses";
import { getScreenshotableWindows } from "../../screenAnalysis/screenDescription";
import { useScheduleStore } from "../../../stores/schedule";

export function getMemoryPrompt(): string {
  return `
#### 记忆

以下是你之前积累的记忆：
${useMemoryStore().getAllAsJSON()}

`
}

export function getHypothesesPrompt(): string {
  return `
#### 假设

以下是你之前对用户特点的推测：
${useHypothesesStore().getAllAsJSON()}
十分推荐频繁地添加或修改这些推测，以便更好地理解用户。

`
}

export async function getScreenshotsPrompt(): Promise<string> {
  return `
#### 截图

以下是当前可截图窗口的列表：
${JSON.stringify(await getScreenshotableWindows())}
当你想查看窗口时，记得在对应的工具中填写id。

`
}

export function getTaskListPrompt(): string {
  let taskJsonString = useScheduleStore().serializeTasksJSON({ max: 10})
  return `
#### 任务列表

以下是你已经安排的任务列表（仅展示最近的10个）：
${taskJsonString}
任务会在时间到达时触发，你可以参考这些来决定当下该做什么。

`
}