import { chatForSchedule } from '../../services/chatAndVoice/chatForSchedule';

export async function handleScheduleIdle(_payload: { ts: number }) {
  try {
    console.log(`[schedule-plugin] SCHEDULE_IDLE at ${new Date(_payload.ts).toISOString()}`);
    await chatForSchedule(
      '他已经有一段时间没有跟你交互了，是不是应该规划一下下一次主动跟他说些什么呀。' +
      '根据你自己的想法，定下一个下一次聊天的主题吧~' +
      '（请勿为本次schedule回复任何Message，计划好下一次主动聊天的时间和话题就好。可以是讲个小故事，也可以是随便问点什么增加回忆哦~）'
    );
  } catch (err) {
    console.warn('[schedule-plugin] chatForSchedule failed:', err);
  }
}

