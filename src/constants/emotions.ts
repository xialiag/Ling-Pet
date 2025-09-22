import type { EmotionDescription } from '../types/emotion';

const EMOTION_DEFINITIONS: Array<{ code: number; description: EmotionDescription }> = [
  { code: 0, description: '正常的柔和笑容，直视着用户' },
  { code: 1, description: '兴高采烈的样子' },
  { code: 2, description: '伤心难过，眼角渗出泪水' },
  { code: 3, description: '生气皱眉' },
  { code: 4, description: '感到害怕，张大嘴表示无法接受' },
  { code: 5, description: '感到惊讶，张大嘴表示难以接受' },
  { code: 6, description: '感到厌恶，表情阴沉' },
  { code: 7, description: '因为过于害羞而脸红，眼角渗出泪水' },
  { code: 8, description: '轻轻微笑，表情温和自然' },
  { code: 9, description: '皱眉表示担心' },
  { code: 10, description: '调皮，略带挑衅' },
  { code: 11, description: '感到慌张，瞳孔地震' },
  { code: 12, description: '感到紧张，轻微流汗' },
  { code: 13, description: '神情认真严肃' },
  { code: 14, description: '感到无奈但不得不接受；抱怨' },
  { code: 15, description: '心率加速，心动不已' },
  { code: 16, description: '感到尴尬羞耻，张嘴表示抗议' },
  { code: 17, description: '自信并干劲满满' },
  { code: 18, description: '感到疑惑，周围冒出问号' },
];

const DEFAULT_EMOTION_CODE = 0;

export function codeToEmotion(code: number): EmotionDescription {
  const match = EMOTION_DEFINITIONS.find(item => item.code === code);
  return match ? match.description : EMOTION_DEFINITIONS[DEFAULT_EMOTION_CODE].description;
}

export function getEmotionCodePrompt(): string {
  return EMOTION_DEFINITIONS
    .map(item => `${item.description}：${item.code}`)
    .join('\n');
}

export function getDefaultEmotionCode(): number {
  return DEFAULT_EMOTION_CODE;
}

export function getEmotionDefinitions() {
  return EMOTION_DEFINITIONS.slice();
}
