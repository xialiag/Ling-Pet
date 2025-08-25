import { createHandlerManager } from './handlerManager';
import { allHandlerDescriptors } from './handlers';

// Aggregate descriptors from flat per-file handlers
export function createGlobalHandlersManager() {
  const descriptors = allHandlerDescriptors();
  return createHandlerManager(descriptors);
}
