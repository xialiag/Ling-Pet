import { generateText, ModelMessage, stepCountIs } from "ai";
import { useSessionStore } from "../../stores/session";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { useAIConfigStore } from "../../stores/configs/aiConfig";
import { addNotificationTool } from "../tools/addNotification";
import { addSchedule, deleteSchedule } from "../tools/scheduleRelated";
import { applyPatchToCharacterState } from "../tools/characterState";
import { backendFinalUserPrompt, getBackendCharacterUserPrompt, getBackendSystemPrompt, getBackendTasksUserPrompt } from "./prompts";

function generateChat(messages: ModelMessage[]) {
  const ac = useAIConfigStore();
  const deepseek = createDeepSeek({ apiKey: ac.apiKey, baseURL: ac.baseURL });

  return generateText({
    model: deepseek('deepseek-chat'),
    messages,
    tools: {
      addNotificationTool,
      addSchedule,
      deleteSchedule,
      applyPatchToCharacterState,
    },
    stopWhen: stepCountIs(20)
  })
}

export async function backendChat(recentEvents: string | Promise<string>) {
  const ss = useSessionStore();
  recentEvents = await recentEvents;

  // 构建消息列表
  const messages: ModelMessage[] = [
    { role: 'system', content: getBackendSystemPrompt() },
    { role: 'user', content: getBackendCharacterUserPrompt() },
    { role: 'user', content: getBackendTasksUserPrompt() },
    { role: 'user', content: recentEvents },
    { role: 'user', content: backendFinalUserPrompt }
  ]

  console.log('后台session启动:', messages);
  console.log('length: ', JSON.stringify(messages).length);

  const result = await generateChat(messages);

  messages.push(...result.response.messages);
  ss.addBackendSession(messages as any);
  ss.$tauri.save()

  console.log('后台AI回复：', result.response.messages);
}