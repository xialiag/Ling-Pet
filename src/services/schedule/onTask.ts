// Stub onTask implementation. You can implement your own logic here.
// It will be called automatically when a scheduled item is due.
import { ScheduleTaskContent } from '../../stores/schedule'
import { scheduleStartChat } from '../chat/frontendChat'

export async function onTask(content: ScheduleTaskContent): Promise<void> {
  const now = Date.now()
  console.log('[onTask] invoked', now)

  try {
    scheduleStartChat(content)
  } catch (e) {
    console.error('[onTask] failed', e)
  }
}
