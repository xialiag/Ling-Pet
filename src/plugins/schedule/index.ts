import { type HandlerDescriptor } from '../../services/events/handlerManager';
import { handleScheduleIdle } from './onScheduleIdle';

export function schedulePluginHandlers(): HandlerDescriptor[] {
  const d1 = {
    key: 'schedule:on-idle-chat',
    event: 'SCHEDULE_IDLE',
    blocking: true,
    isEnabled: () => true,
    handle: handleScheduleIdle,
  } as HandlerDescriptor<'SCHEDULE_IDLE'>;

  return [d1 as HandlerDescriptor];
}

