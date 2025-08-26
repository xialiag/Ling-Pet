import { ScreenshotableWindow } from "tauri-plugin-screenshots-api";
import { describeScreens } from "../../screenAnalysis/screenDescription";
import { useAIConfigStore } from "../../../stores/configs/aiConfig";
import { chatWithPetStream } from "../../chatAndVoice/chatWithPet";
import { useConversationStore } from "../../../stores/conversation";
import { usePetStateStore } from "../../../stores/petState";

const aiConfig = useAIConfigStore();
const petState = usePetStateStore();
const conversation = useConversationStore();

const USERPROMPT =
  `System: 你已经很久没有收到消息回复啦，于是你忍不住偷偷看了一下他的电脑屏幕，发现他刚刚打开了一个新窗口
<screen-content>
{screenContent};
</screen-content>
你要对他说些什么呢？
`;

export async function handleNewWindows(newWindows: ScreenshotableWindow[]) {
  if (!Array.isArray(newWindows) || newWindows.length !== 1) return;

  if (!aiConfig.apiKey || !aiConfig.baseURL || !aiConfig.model) {
    console.warn("AI服务配置不完整，无法进行屏幕分析");
    return;
  }
  if (conversation.responseItems.length > 0) {
    console.log("当前有未完成的对话，放弃");
    return;
  }
  if (Date.now() - petState.lastClickTimestamp < 10000) {
    return;
  }

  const analysisResult = await describeScreens(newWindows.map((w) => w.id));
  await chatWithPetStream(
    USERPROMPT.replace('{screenContent}', analysisResult)
  );
}

