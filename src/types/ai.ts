// 中文注释：该文件定义与AI交互的核心类型，已重构为仅保留中文信息
import type { ChatCompletionMessageParam, ChatCompletionCreateParams } from 'openai/resources/chat/completions';

// 中文注释：沿用 OpenAI SDK 的消息与请求类型
export type AIMessage = ChatCompletionMessageParam;
export type ChatRequest = ChatCompletionCreateParams;

// 中文注释：桌宠对话响应项——已简化为仅包含中文文本
export interface PetResponseItem {
  message: string; // 中文文本内容
}

// 中文注释：扩展类型，保留可选音频以兼容后续能力（当前不会自动生成）
export interface PetResponseItemWithAudio extends PetResponseItem {
  audioBlob?: Blob;
}
