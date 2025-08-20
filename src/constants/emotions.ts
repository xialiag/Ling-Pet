import type { EmotionDescription } from '../types/emotion';
import {
  codeToEmotion as _codeToEmotion,
  getEmotionCodePrompt as _getEmotionCodePrompt,
  getDefaultEmotionCode as _getDefaultEmotionCode,
} from '../services/emotionPack'

export function codeToEmotion(code: number): EmotionDescription { return _codeToEmotion(code) }
export function getEmotionCodePrompt(): string { return _getEmotionCodePrompt() }
export function getDefaultEmotionCode(): number { return _getDefaultEmotionCode() }
