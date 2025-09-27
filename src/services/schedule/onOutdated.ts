import { ScheduleTaskContent } from "../../stores/schedule";

// Stub for handling outdated tasks. Implement your logic here.
export async function onOutdated(
  content: ScheduleTaskContent,
  ctx: { scheduledAt: number; outdatedAt?: number }
): Promise<void> {
  console.log('[onOutdated] invoked', { content, ...ctx, now: Date.now() })
  // TODO: implement what to do when a task is outdated
}
