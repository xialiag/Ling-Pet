export * from './types';
export * from './registry';

// Register built-in/example tools here
import { registerTool } from './registry';
import { addNotificationTool } from './tools/addNotification';
import { addScheduleTool, deleteScheduleTool } from './tools/scheduleRelated';
import { memoryUpdateTool, memoryAddTool, hypothesisAddTool, hypothesisUpdateTool } from './tools/memoryRelated';
import { screenDescribeTool } from './tools/screenDescribe';

export function registerDefaultTools() {
  registerTool(addNotificationTool);
  registerTool(addScheduleTool);
  registerTool(deleteScheduleTool);
  registerTool(memoryAddTool);
  registerTool(memoryUpdateTool);
  registerTool(hypothesisAddTool);
  registerTool(hypothesisUpdateTool);
  registerTool(screenDescribeTool);
}
