import { EventEmitter } from 'events';
import { PathResolver } from './pathResolver';
import fs from 'fs';
import path from 'path';

/**
 * 热加载管理器 - 开发时自动重载插件
 */
export class HotReloadManager extends EventEmitter {
  private watchers: Map<string, any> = new Map();
  private pathResolver: PathResolver;
  private reloadDebounce: Map<string, NodeJS.Timeout> = new Map();
  private pluginLoader: any;

  constructor(pluginLoader: any) {
    super();
    this.pathResolver = PathResolver.getInstance();
    this.pluginLoader = pluginLoader;
  }

  enableHotReload(pluginId: string): void {
    if (!this.pathResolver.isDevelopment()) {
      console.warn('[HotReload] Hot reload is only available in development mode');
      return;
    }

    if (this.watchers.has(pluginId)) {
      return;
    }

    const pluginDir = this.pathResolver.getPluginDir(pluginId);
    
    if (!fs.existsSync(pluginDir)) {
      console.warn(`[HotReload] Plugin directory not found: ${pluginDir}`);
      return;
    }

    try {
      const chokidar = require('chokidar');
      
      const watcher = chokidar.watch(pluginDir, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        }
      });

      watcher.on('change', (filePath: string) => {
        this.handleFileChange(pluginId, filePath);
      });

      watcher.on('add', (filePath: string) => {
        this.handleFileChange(pluginId, filePath);
      });

      this.watchers.set(pluginId, watcher);
      console.log(`[HotReload] Watching plugin: ${pluginId}`);
    } catch (error) {
      console.warn('[HotReload] chokidar not available. Install with: npm install chokidar');
    }
  }

  disableHotReload(pluginId: string): void {
    const watcher = this.watchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(pluginId);
      console.log(`[HotReload] Stopped watching plugin: ${pluginId}`);
    }
  }

  private handleFileChange(pluginId: string, filePath: string): void {
    console.log(`[HotReload] File changed: ${filePath}`);

    const existingTimeout = this.reloadDebounce.get(pluginId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      await this.reloadPlugin(pluginId);
      this.reloadDebounce.delete(pluginId);
    }, 500);

    this.reloadDebounce.set(pluginId, timeout);
  }

  private async reloadPlugin(pluginId: string): Promise<void> {
    try {
      console.log(`[HotReload] Reloading plugin: ${pluginId}`);
      
      this.clearModuleCache(pluginId);
      
      await this.pluginLoader.unloadPlugin(pluginId);
      await this.pluginLoader.loadPlugin(pluginId);
      
      this.emit('plugin-reloaded', pluginId);
      console.log(`[HotReload] Plugin reloaded successfully: ${pluginId}`);
    } catch (error) {
      console.error(`[HotReload] Failed to reload plugin ${pluginId}:`, error);
      this.emit('reload-error', pluginId, error);
    }
  }

  private clearModuleCache(pluginId: string): void {
    const pluginDir = this.pathResolver.getPluginDir(pluginId);
    
    Object.keys(require.cache).forEach(key => {
      if (key.startsWith(pluginDir)) {
        delete require.cache[key];
        console.log(`[HotReload] Cleared cache: ${key}`);
      }
    });
  }

  cleanup(): void {
    this.watchers.forEach((watcher, pluginId) => {
      this.disableHotReload(pluginId);
    });
  }
}
