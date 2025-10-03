import { PathResolver } from './pathResolver';
import fs from 'fs';

/**
 * 运行时注入 - 将插件注入到渲染进程
 */
export class RuntimeInjection {
  private pathResolver: PathResolver;

  constructor() {
    this.pathResolver = PathResolver.getInstance();
  }

  async injectPluginToRenderer(window: any, pluginId: string): Promise<void> {
    const pluginEntry = this.pathResolver.getPluginEntry(pluginId);
    
    if (!fs.existsSync(pluginEntry)) {
      throw new Error(`Plugin entry not found: ${pluginEntry}`);
    }

    const pluginCode = fs.readFileSync(pluginEntry, 'utf-8');
    const wrappedCode = this.wrapPluginCode(pluginId, pluginCode);
    
    await window.webContents.executeJavaScript(wrappedCode);
    console.log(`[RuntimeInjection] Injected plugin ${pluginId} to renderer`);
  }

  private wrapPluginCode(pluginId: string, code: string): string {
    return `
      (function() {
        const pluginId = '${pluginId}';
        const pluginModule = { exports: {} };
        const exports = pluginModule.exports;
        
        const pluginAPI = window.__PLUGIN_API__;
        
        try {
          ${code}
          
          if (typeof pluginModule.exports.default === 'function') {
            pluginModule.exports.default(pluginAPI);
          } else if (typeof pluginModule.exports === 'function') {
            pluginModule.exports(pluginAPI);
          }
          
          console.log('[Plugin] Loaded:', pluginId);
        } catch (error) {
          console.error('[Plugin] Failed to load ${pluginId}:', error);
        }
      })();
    `;
  }

  getPreloadScript(): string {
    return `
      const { contextBridge, ipcRenderer } = require('electron');
      
      contextBridge.exposeInMainWorld('__PLUGIN_API__', {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, callback) => {
          const subscription = (event, ...args) => callback(...args);
          ipcRenderer.on(channel, subscription);
          return () => ipcRenderer.removeListener(channel, subscription);
        },
        send: (channel, ...args) => ipcRenderer.send(channel, ...args)
      });
    `;
  }

  async injectAllPlugins(window: any, pluginIds: string[]): Promise<void> {
    for (const pluginId of pluginIds) {
      try {
        await this.injectPluginToRenderer(window, pluginId);
      } catch (error) {
        console.error(`[RuntimeInjection] Failed to inject ${pluginId}:`, error);
      }
    }
  }
}
