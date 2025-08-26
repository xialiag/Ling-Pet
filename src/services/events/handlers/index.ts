import { type HandlerDescriptor } from "../handlerManager";
import { handleAvatarMultiClick } from "./onAvatarMultiClick";
import { handleNewWindows } from "./onNewWindows";
import { handleScheduleIdle } from "./onScheduleIdle";
import { useScreenAnalysisConfigStore } from "../../../stores/configs/screenAnalysisConfig";

// Central registry for all event handlers (flat, per-file features)
export function allHandlerDescriptors(): HandlerDescriptor[] {
  const sac = useScreenAnalysisConfigStore();

  const dAvatarMultiClick: HandlerDescriptor<'AVATAR_MULTI_CLICK'> = {
    key: 'interaction:avatar-multi-click-demo',
    event: 'AVATAR_MULTI_CLICK',
    blocking: true,
    isEnabled: () => true, // wire to a setting if needed later
    handle: handleAvatarMultiClick,
  };

  const dNewWindows: HandlerDescriptor<'NEW_WINDOWS'> = {
    key: 'screen:new-windows-auto-reply',
    event: 'NEW_WINDOWS',
    blocking: true,
    isEnabled: () => sac.enableNewWindowAutoReply,
    handle: handleNewWindows,
  };

  const dScheduleIdle: HandlerDescriptor<'SCHEDULE_IDLE'> = {
    key: 'schedule:on-idle-chat',
    event: 'SCHEDULE_IDLE',
    blocking: true,
    isEnabled: () => true,
    handle: handleScheduleIdle,
  };

  return [
    dNewWindows as HandlerDescriptor,
    dAvatarMultiClick as HandlerDescriptor,
    dScheduleIdle as HandlerDescriptor,
  ];
}

