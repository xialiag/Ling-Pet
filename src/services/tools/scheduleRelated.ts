import {tool} from 'ai'
import { useScheduleStore } from '../../stores/schedule';
import z from 'zod';

export const addSchedule = tool({
  description: '添加一个定时任务，到时间会提醒角色进行这个任务。在添加任务时，请详细填写各个任务描述',
  inputSchema: z.object({
    delaySeconds: z.number().min(0).describe('延迟时间，单位为秒。如果这个事项并不需要延时，可以直接填0'),
    outdatedSeconds: z.number().min(-1).describe('过期时间，单位为秒，-1表示不过期'),
    content: z.object({
      title: z.string().min(1).describe('任务标题，简要说明任务内容'),
      motivation: z.string().min(1).describe('任务动机，解释角色在做这件事情之前的想法是怎样的'),
      plan: z.string().min(1).describe('任务计划，制定详细的行动步骤'),
      expectedOutcome: z.string().min(1).describe('预期结果'),
    }),
  }),
  execute: async ({ delaySeconds, outdatedSeconds, content }) => {
    try {
      const schedule = useScheduleStore();
      const id = schedule.addSchedule(delaySeconds * 1000, content, {
        outdatedInMs: outdatedSeconds >= 0 ? outdatedSeconds * 1000 : undefined,
      });
      const task = schedule.tasks.find(t => t.id === id);
      console.log('[tool:addSchedule] created', content.title, {
        id,
        scheduledAt: task?.scheduledAt,
        outdatedAt: task?.outdatedAt,
        now: Date.now(),
      });
      return `Successfully added schedule with ID ${id}`;
    } catch (error) {
      console.error('Error adding schedule:', error);
      return 'Failed to add schedule';
    }
  }
})

export const deleteSchedule = tool({
  description: '删除一个任务（无论其当前状态如何），从任务列表中移除。',
  inputSchema: z.object({
    id: z.string().min(1).describe('任务ID'),
  }),
  execute: async ({ id }) => {
    try {
      const schedule = useScheduleStore();
      const success = schedule.deleteSchedule(id);
      console.log('[tool:deleteSchedule] called', { id, success });
      if (success) {
        return `Successfully deleted schedule with ID ${id}`;
      } else {
        return `No schedule found with ID ${id}`;
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      return 'Failed to delete schedule';
    }
  }
})