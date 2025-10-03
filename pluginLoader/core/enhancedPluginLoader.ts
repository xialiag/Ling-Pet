import { EventEmitter } from 'events';
import { PathResolver } from './pathResolver';
import { BackendLoader } from './backendLoader';
import { StorageManager } from './storageManager';
import { HotReloadManager } from './hotReload';
import { HookEngine } from './hookEngine';
import { ToolManager } from './toolManager';
import { PluginAPI, PluginContext, PluginMetadata } from '../types/api';
import fs from 'fs';
import path from 'path';

/**
 * 增强的插件加载器 - 完整的生产环境支持
 */
export class EnhancedPluginLoader extends EventEmitter {
  private pathResolver: PathResolver;
  private backendLoader: BackendLoader;
  private storageManager: StorageManager;
  private hotReloadManager: HotReloadManager;
  private hookEngine: HookEngine;
  private toolManager: ToolManager;
  
  private loadedPlugins: Map<string, PluginContext> = new Map();
  private pluginMetadata: Map<string, PluginMetadata> = new Map();

  constructor() {
    super();
    this.pathResolver = PathResolver.getInstance();
    this.backendLoader = new BackendLoader();
    this.storageManager = new StorageManager();
    this.hookEngine = new HookEngine();
    this.toolManager = new ToolManager();
    this.hotReloadManager = new HotReloadManager(this);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.hotReloadManager.on('plugin-reloaded', (pluginId: string) => {
      this.emit('plugin-reloaded', pluginId);
    });

    this.hotReloadManager.on('reload-error', (pluginId: string, error: Error) => {
      this.emit('reload-error', pluginId, error);
    });
  }

  async initialize(): Promise<void> {
    console.log('[PluginLoader] Initializing...');
    console.log('[PluginLoader] Plugins root:', this.pathResolver.getPluginsRoot());
    console.log('[PluginLoader] Data root:', this.pathResolver.getDataRoot());
    
    await this.discoverPlugins();
    await this.loadAllPlugins();
    
    console.log(`[PluginLoader] Initialized with ${this.loadedPlugins.size} plugins`);
  }

  private async discoverPlugins(): Promise<void> {
    const pluginsRoot = this.pathResolver.getPluginsRoot();
    
    if (!fs.existsSync(pluginsRoot)) {
      console.warn('[PluginLoader] Plugins directory not found');
      return;
    }

    const entries = fs.readdirSync(pluginsRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginId = entry.name;
        const metadata = await this.loadPluginMetadata(pluginId);
        
        if (metadata) {
          this.pluginMetadata.set(pluginId, metadata);
          console.log(`[PluginLoader] Discovered plugin: ${pluginId}`);
        }
      }
    }
  }

  private async loadPluginMetadata(pluginId: string): Promise<PluginMetadata | null> {
    const pluginDir = this.pathResolver.getPluginDir(pluginId);
    const packagePath = path.join(pluginDir, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      console.warn(`[PluginLoader] No package.json found for ${pluginId}`);
      return null;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      
      return {
        id: pluginId,
        name: pkg.displayName || pkg.name,
        version: pkg.version,
        description: pkg.description,
        author: pkg.author,
        main: pkg.main || 'index.js',
        capabilities: pkg.plugin?.capabilities || {},
        permissions: pkg.plugin?.permissions || [],
        backend: pkg.plugin?.backend
      };
    } catch (error) {
      console.error(`[PluginLoader] Failed to load metadata for ${pluginId}:`, error);
      return null;
    }
  }

  private async loadAllPlugins(): Promise<void> {
    for (const [pluginId, metadata] of this.pluginMetadata) {
      try {
        await this.loadPlugin(pluginId);
      } catch (error) {
        console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error);
      }
    }
  }

  async loadPlugin(pluginId: string): Promise<void> {
    if (this.loadedPlugins.has(pluginId)) {
      console.warn(`[PluginLoader] Plugin ${pluginId} is already loaded`);
      return;
    }

    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata) {
      throw new Error(`Plugin metadata not found: ${pluginId}`);
    }

    console.log(`[PluginLoader] Loading plugin: ${pluginId}`);

    const pluginEntry = this.pathResolver.getPluginEntry(pluginId);
    
    if (!fs.existsSync(pluginEntry)) {
      throw new Error(`Plugin entry not found: ${pluginEntry}`);
    }

    try {
      delete require.cache[require.resolve(pluginEntry)];
      
      const pluginModule = require(pluginEntry);
      const pluginFactory = pluginModule.default || pluginModule;
      
      if (typeof pluginFactory !== 'function') {
        throw new Error(`Plugin ${pluginId} does not export a factory function`);
      }

      const api = this.createPluginAPI(pluginId);
      const plugin = pluginFactory(api);
      
      if (plugin.activate) {
        await plugin.activate();
      }

      this.loadedPlugins.set(pluginId, plugin);
      
      if (this.pathResolver.isDevelopment()) {
        this.hotReloadManager.enableHotReload(pluginId);
      }

      this.emit('plugin-loaded', pluginId);
      console.log(`[PluginLoader] Plugin loaded: ${pluginId}`);
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    
    if (!plugin) {
      console.warn(`[PluginLoader] Plugin ${pluginId} is not loaded`);
      return;
    }

    console.log(`[PluginLoader] Unloading plugin: ${pluginId}`);

    try {
      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      await this.backendLoader.unload(pluginId);
      
      this.hookEngine.unregisterPluginHooks(pluginId);
      this.toolManager.unregisterPluginTools(pluginId);
      
      this.hotReloadManager.disableHotReload(pluginId);
      
      this.loadedPlugins.delete(pluginId);
      
      this.emit('plugin-unloaded', pluginId);
      console.log(`[PluginLoader] Plugin unloaded: ${pluginId}`);
    } catch (error) {
      console.error(`[PluginLoader] Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private createPluginAPI(pluginId: string): PluginAPI {
    return {
      paths: {
        getPluginDir: () => this.pathResolver.getPluginDir(pluginId),
        getAssetsDir: () => this.pathResolver.getPluginAssetsDir(pluginId),
        getDataDir: () => this.pathResolver.getPluginDataDir(pluginId),
        getCacheDir: () => this.pathResolver.getPluginCacheDir(pluginId),
        getConfigPath: () => this.pathResolver.getPluginConfig(pluginId),
        getPluginBackend: () => this.pathResolver.getPluginBackend(pluginId),
        getLogDir: () => this.pathResolver.getPluginLogDir(pluginId)
      },

      hooks: {
        register: (hookName: string, handler: Function) => {
          this.hookEngine.registerHook(pluginId, hookName, handler);
        },
        unregister: (hookName: string, handler: Function) => {
          this.hookEngine.unregisterHook(pluginId, hookName, handler);
        }
      },

      components: {
        register: (name: string, component: any) => {
          // 组件注册逻辑
          this.emit('component-registered', pluginId, name, component);
        },
        unregister: (name: string) => {
          this.emit('component-unregistered', pluginId, name);
        }
      },

      tools: {
        register: (tool: any) => {
          this.toolManager.registerTool(pluginId, tool);
        },
        unregister: (toolName: string) => {
          this.toolManager.unregisterTool(pluginId, toolName);
        }
      },

      backend: {
        load: async () => {
          return await this.backendLoader.load(pluginId);
        },
        unload: async () => {
          await this.backendLoader.unload(pluginId);
        },
        getBackend: () => {
          return this.backendLoader.getBackend(pluginId);
        }
      },

      storage: {
        get: async (key: string) => {
          return await this.storageManager.get(pluginId, key);
        },
        set: async (key: string, value: any) => {
          await this.storageManager.set(pluginId, key, value);
        },
        delete: async (key: string) => {
          await this.storageManager.delete(pluginId, key);
        },
        getAll: async () => {
          return await this.storageManager.getAll(pluginId);
        },
        setAll: async (data: Record<string, any>) => {
          await this.storageManager.setAll(pluginId, data);
        }
      },

      ui: {
        showNotification: (message: string) => {
          this.emit('notification', pluginId, message);
        },
        showDialog: async (options: any) => {
          return new Promise((resolve) => {
            this.emit('dialog', pluginId, options, resolve);
          });
        }
      },

      logger: {
        info: (...args: any[]) => console.log(`[${pluginId}]`, ...args),
        warn: (...args: any[]) => console.warn(`[${pluginId}]`, ...args),
        error: (...args: any[]) => console.error(`[${pluginId}]`, ...args),
        debug: (...args: any[]) => console.debug(`[${pluginId}]`, ...args)
      }
    };
  }

  getPlugin(pluginId: string): PluginContext | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(pluginId);
  }

  getAllPlugins(): Map<string, PluginContext> {
    return new Map(this.loadedPlugins);
  }

  getAllMetadata(): Map<string, PluginMetadata> {
    return new Map(this.pluginMetadata);
  }

  getHookEngine(): HookEngine {
    return this.hookEngine;
  }

  getToolManager(): ToolManager {
    return this.toolManager;
  }

  async cleanup(): Promise<void> {
    console.log('[PluginLoader] Cleaning up...');
    
    for (const pluginId of this.loadedPlugins.keys()) {
      await this.unloadPlugin(pluginId);
    }
    
    this.hotReloadManager.cleanup();
    this.backendLoader.cleanup();
    
    console.log('[PluginLoader] Cleanup complete');
  }
}
