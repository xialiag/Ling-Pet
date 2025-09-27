import { useAIConfigStore } from "../../stores/configs/aiConfig";
import { ModelMessage, stepCountIs, streamText } from "ai";
import { createDeepSeek } from '@ai-sdk/deepseek';
import { fetch } from "@tauri-apps/plugin-http";
import { useConversationStore } from "../../stores/conversation";
import { parsePetResponseItemString } from "../../utils/aiResponse";
import { addNotificationTool } from "../tools/addNotification";
import { useSessionStore } from "../../stores/session";
import { getFrontendPromptBase, getFrontEndTaskPrompt } from "./prompts";
import { ScheduleTaskContent } from "../../stores/schedule";
import { addSchedule, deleteSchedule } from "../tools/scheduleRelated";

function streamChat(messages: ModelMessage[]) {
  const ss = useSessionStore();
  const ac = useAIConfigStore();
  const deepseek = createDeepSeek({ apiKey: ac.apiKey, baseURL: ac.baseURL, fetch: fetch });
  const conversation = useConversationStore();

  let buffer = '';
  return streamText({
    model: deepseek('deepseek-chat'),
    messages,
    tools: {
      addNotificationTool,
      addSchedule,
      deleteSchedule
    },
    onChunk({ chunk }) {
      if (chunk.type === 'text-delta') {
        buffer += chunk.text;
        const itemRegex = /<item>(.*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(buffer)) !== null) {
          const itemContent = match[1];
          console.log('检测到完整item:', itemContent);
          const parsedItem = parsePetResponseItemString(itemContent);

          if (parsedItem) {
            conversation.addItem(parsedItem);
          } else {
            console.warn('解析item失败:', itemContent);
          }
        }
        buffer = buffer.replace(/<item>.*?<\/item>/g, '');
      }
    },
    onFinish({ response }) {
      response.messages.map(msg => {
        ss.addMessage(msg as any);
      });
      console.log('AI回复：', response.messages);
    },
    stopWhen: stepCountIs(20)
  })
}

export async function userStartChat(
  userMessage: string,
): Promise<{ success: boolean; error?: string }> {
  // Lazily access stores here to ensure Pinia is active
  const ac = useAIConfigStore();
  const ss = useSessionStore();
  const conversation = useConversationStore();

  // 检查配置是否完整
  const hasConfig = Boolean(ac.apiKey && ac.baseURL && ac.model)
  if (!hasConfig) {
    return {
      success: false,
      error: '请正确配置AI服务'
    };
  }
  // 如果是新会话，则添加 system prompt 和 user 消息
  if (ss.currentSession.length === 0) {
    ss.addMessage({ role: 'system', content: getFrontendPromptBase() })
    ss.addMessage({ role: 'user', content: `<userMessage>${userMessage}</userMessage>` })
  } else {
    ss.addMessage({ role: 'user', content: `<userMessage>${userMessage}</userMessage>` })
  }
  const messages = ss.currentSession as ModelMessage[];

  console.log('用户消息：', messages);

  const result = streamChat(messages);

  conversation.start();
  await result.consumeStream()
  conversation.finish();
  // for await (const part of result.fullStream) {
  //   console.log('AI回复流：', part);
  // }

  console.log(result);
  ss.$tauri.save();

  return { success: true };
}

export async function scheduleStartChat(content: ScheduleTaskContent) {
  const ss = useSessionStore();
  const conversation = useConversationStore();

  const messages: ModelMessage[] = [
    { role: 'system', content: getFrontEndTaskPrompt(content) },
    { role: 'user', content: '<system>请你开始为角色撰写行动或对话</system>' }
  ];

  messages.map(msg => {
    ss.addMessage(msg as any);
  });
  console.log('Schedule 消息：', messages);

  const result = streamChat(messages);
  conversation.start();
  await result.consumeStream()
  conversation.finish();

  console.log(result);
  ss.$tauri.save();
}