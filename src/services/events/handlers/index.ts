import { type HandlerDescriptor } from "../handlerManager";
import { handleAvatarMultiClick } from "./onAvatarMultiClick";

// Central registry for all event handlers (flat, per-file features)
export function allHandlerDescriptors(): HandlerDescriptor[] {
  const dAvatarMultiClick: HandlerDescriptor<'AVATAR_MULTI_CLICK'> = {
    key: 'interaction:avatar-multi-click-demo',
    event: 'AVATAR_MULTI_CLICK',
    blocking: true,
    isEnabled: () => true, // wire to a setting if needed later
    handle: handleAvatarMultiClick,
  };

  return [
    dAvatarMultiClick as HandlerDescriptor,
    // dScheduleIdle as HandlerDescriptor,
  ];
}

