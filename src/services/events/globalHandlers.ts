import { createHandlerManager } from './handlerManager';
import { screenAnalysisPluginHandlers } from '../../plugins/screenAnalysis';
import { interactionPluginHandlers } from '../../plugins/interactions';
import { schedulePluginHandlers } from '../../plugins/schedule';

// Aggregate descriptors from multiple feature areas (plugins)
export function createGlobalHandlersManager() {
  const descriptors = [
    ...screenAnalysisPluginHandlers(),
    ...interactionPluginHandlers(),
    ...schedulePluginHandlers(),
  ];

  return createHandlerManager(descriptors);
}
