import { PathResolver } from './pathResolver';
import fs from 'fs';
import path from 'path';

/**
 * 存储管理器 - 管理插件数据持久化
 */
export class StorageManager {
  private pathResolver: PathResolver;
  private cache: Map<string, Map<string, any>> = new Map();

  constructor() {
    this.pathResolver = PathResolver.getInstance();
  }

  async get(pluginId: string, key: string): Promise<any> {
    const pluginCache = this.getPluginCache(pluginId);
    
    if (pluginCache.has(key)) {
      return pluginCache.get(key);
    }

    const configPath = this.pathResolver.getPluginConfig(pluginId);
    
    if (!fs.existsSync(configPath)) {
      return undefined;
    }

    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const value = data[key];
      pluginCache.set(key, value);
      return value;
    } catch (error) {
      console.error(`[Storage] Failed to read ${pluginId}/${key}:`, error);
      return undefined;
    }
  }

  async set(pluginId: string, key: string, value: any): Promise<void> {
    const pluginCache = this.getPluginCache(pluginId);
    pluginCache.set(key, value);

    const configPath = this.pathResolver.getPluginConfig(pluginId);
    
    let data: any = {};
    if (fs.existsSync(configPath)) {
      try {
        data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (error) {
        console.warn(`[Storage] Failed to read existing config for ${pluginId}`);
      }
    }

    data[key] = value;

    try {
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[Storage] Failed to write ${pluginId}/${key}:`, error);
      throw error;
    }
  }

  async delete(pluginId: string, key: string): Promise<void> {
    const pluginCache = this.getPluginCache(pluginId);
    pluginCache.delete(key);

    const configPath = this.pathResolver.getPluginConfig(pluginId);
    
    if (!fs.existsSync(configPath)) {
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      delete data[key];
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[Storage] Failed to delete ${pluginId}/${key}:`, error);
      throw error;
    }
  }

  async getAll(pluginId: string): Promise<Record<string, any>> {
    const configPath = this.pathResolver.getPluginConfig(pluginId);
    
    if (!fs.existsSync(configPath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      console.error(`[Storage] Failed to read all data for ${pluginId}:`, error);
      return {};
    }
  }

  async setAll(pluginId: string, data: Record<string, any>): Promise<void> {
    const configPath = this.pathResolver.getPluginConfig(pluginId);
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
      
      const pluginCache = this.getPluginCache(pluginId);
      pluginCache.clear();
      Object.entries(data).forEach(([key, value]) => {
        pluginCache.set(key, value);
      });
    } catch (error) {
      console.error(`[Storage] Failed to write all data for ${pluginId}:`, error);
      throw error;
    }
  }

  clearCache(pluginId?: string): void {
    if (pluginId) {
      this.cache.delete(pluginId);
    } else {
      this.cache.clear();
    }
  }

  private getPluginCache(pluginId: string): Map<string, any> {
    if (!this.cache.has(pluginId)) {
      this.cache.set(pluginId, new Map());
    }
    return this.cache.get(pluginId)!;
  }
}
