import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { watch } from "vue";
import { useConversationStore } from "../../stores/conversation";
import { storeToRefs } from 'pinia'

const cs = useConversationStore();
const { currentMessage } = storeToRefs(cs)

function openChatBubble() {
  const chatBubbleConfig = {
    title: '聊天气泡',
    url: '/#/chat-bubble',
    label: 'chat-bubble',
    resizable: false,
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: false,
    // 有消息时才创建，因此直接可见，避免二次 show 竞态
    visible: true,
    shadow: false
  };
  new WebviewWindow('chat-bubble', chatBubbleConfig);
}

// 聊天气泡管理：有当前消息则打开/显示气泡窗口，无消息则关闭。
export function chatBubbleManager() {
  let stopChatBubbleWatcher: (() => void) | null = null;
  // 串行化窗口操作，避免并发 close/open 竞态
  let opQueue: Promise<void> = Promise.resolve();

  function startChatBubbleWatching() {
    if (!stopChatBubbleWatcher) {
      stopChatBubbleWatcher = watch(
        () => currentMessage.value,
        (msg) => {
          opQueue = opQueue.then(async () => {
            const chatBubbleWindow = await WebviewWindow.getByLabel('chat-bubble');
            if (!msg) {
              if (chatBubbleWindow) {
                try { await chatBubbleWindow.close(); } catch { /* 已关闭或关闭中 */ }
              }
              return;
            }

            // 有消息
            if (chatBubbleWindow) {
              try {
                const visible = await chatBubbleWindow.isVisible();
                if (!visible) await chatBubbleWindow.show();
              } catch { /* 忽略不可用句柄 */ }
            } else {
              // 不存在则创建（可见）
              openChatBubble();
            }
          });
        },
        { immediate: true }
      );
    }
  }

  function stopChatBubbleWatching() {
    if (stopChatBubbleWatcher) {
      stopChatBubbleWatcher();
      stopChatBubbleWatcher = null;
    }
  }

  return {
    startChatBubbleWatching,
    stopChatBubbleWatching
  };
}
