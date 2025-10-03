import { PathResolver } from './pathResolver';
import fs from 'fs';
import path from 'path';

/**
 * 后端加载器 - 加载和管理Rust后端动态库
 */
export class BackendLoader {
  private pathResolver: PathResolver;
  private loadedBackends: Map<string, PluginBackend> = new Map();

  constructor() {
    this.pathResolver = PathResolver.getInstance();
  }

  async load(pluginId: string): Promise<PluginBackend> {
    if (this.loadedBackends.has(pluginId)) {
      return this.loadedBackends.get(pluginId)!;
    }

    const backendPath = this.pathResolver.getPluginBackend(pluginId);
    
    if (!fs.existsSync(backendPath)) {
      throw new Error(`Backend not found: ${backendPath}`);
    }

    try {
      // 动态加载FFI库
      const ffi = await this.loadFFI();
      const ref = await this.loadRef();
      
      const lib = ffi.Library(backendPath, {
        'plugin_init': ['string', []],
        'plugin_call': ['string', ['string', 'string']],
        'plugin_free_string': ['void', ['string']],
        'plugin_cleanup': ['void', []]
      });

      const initResult = lib.plugin_init();
      console.log(`[Backend] Initialized ${pluginId}:`, initResult);

      const backend = new PluginBackend(pluginId, lib);
      this.loadedBackends.set(pluginId, backend);
      
      return backend;
    } catch (error) {
      console.error(`[Backend] Failed to load ${pluginId}:`, error);
      throw error;
    }
  }

  async unload(pluginId: string): Promise<void> {
    const backend = this.loadedBackends.get(pluginId);
    if (backend) {
      backend.cleanup();
      this.loadedBackends.delete(pluginId);
      console.log(`[Backend] Unloaded ${pluginId}`);
    }
  }

  private async loadFFI(): Promise<any> {
    try {
      return require('ffi-napi');
    } catch (error) {
      console.warn('[Backend] ffi-napi not available, backend features disabled');
      throw new Error('ffi-napi is required for backend support. Install with: npm install ffi-napi');
    }
  }

  private async loadRef(): Promise<any> {
    try {
      return require('ref-napi');
    } catch (error) {
      console.warn('[Backend] ref-napi not available');
      throw new Error('ref-napi is required for backend support. Install with: npm install ref-napi');
    }
  }

  getBackend(pluginId: string): PluginBackend | undefined {
    return this.loadedBackends.get(pluginId);
  }

  cleanup(): void {
    this.loadedBackends.forEach((backend, pluginId) => {
      this.unload(pluginId);
    });
  }
}

/**
 * 插件后端实例
 */
export class PluginBackend {
  constructor(
    private pluginId: string,
    private lib: any
  ) {}

  async call(method: string, params: any = {}): Promise<any> {
    try {
      const paramsJson = JSON.stringify(params);
      const resultJson = this.lib.plugin_call(method, paramsJson);
      const result = JSON.parse(resultJson);
      
      if (result.status === 'error') {
        throw new Error(result.error);
      }
      
      return result.data;
    } catch (error) {
      console.error(`[Backend] Call failed for ${this.pluginId}.${method}:`, error);
      throw error;
    }
  }

  cleanup(): void {
    try {
      this.lib.plugin_cleanup();
    } catch (error) {
      console.error(`[Backend] Cleanup failed for ${this.pluginId}:`, error);
    }
  }

  getPluginId(): string {
    return this.pluginId;
  }
}
