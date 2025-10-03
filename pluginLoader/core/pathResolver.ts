import path from 'path';
import fs from 'fs';

/**
 * 路径解析器 - 统一管理开发和生产环境的路径
 */
export class PathResolver {
  private static instance: PathResolver;
  private isDev: boolean;
  private appRoot: string;
  private pluginsRoot: string;
  private dataRoot: string;

  private constructor() {
    // 判断是否为开发环境
    this.isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    
    // 应用根目录
    this.appRoot = this.isDev 
      ? process.cwd() 
      : path.dirname(process.execPath);
    
    // 插件目录
    this.pluginsRoot = this.isDev
      ? path.join(process.cwd(), 'pluginLoader', 'plugins')
      : path.join(this.appRoot, 'plugins');
    
    // 数据目录（用户可写）
    this.dataRoot = this.isDev
      ? path.join(process.cwd(), 'plugin-data')
      : path.join(this.getUserDataPath(), 'plugin-data');
    
    this.ensureDirectories();
  }

  static getInstance(): PathResolver {
    if (!PathResolver.instance) {
      PathResolver.instance = new PathResolver();
    }
    return PathResolver.instance;
  }

  private getUserDataPath(): string {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE || '';
    
    switch (platform) {
      case 'win32':
        // Windows: %APPDATA%/YourApp
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'YourApp');
      case 'darwin':
        // macOS: ~/Library/Application Support/YourApp
        return path.join(home, 'Library', 'Application Support', 'YourApp');
      case 'linux':
        // Linux: ~/.config/yourapp
        return path.join(home, '.config', 'yourapp');
      default:
        // 其他 Unix-like 系统
        return path.join(home, '.config', 'yourapp');
    }
  }

  private ensureDirectories() {
    [this.pluginsRoot, this.dataRoot].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getPluginsRoot(): string {
    return this.pluginsRoot;
  }

  getPluginDir(pluginId: string): string {
    return path.join(this.pluginsRoot, pluginId);
  }

  getPluginEntry(pluginId: string): string {
    const pluginDir = this.getPluginDir(pluginId);
    const pkgPath = path.join(pluginDir, 'package.json');
    
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const entry = pkg.main || 'index.js';
      return path.join(pluginDir, entry);
    }
    
    return path.join(pluginDir, 'index.js');
  }

  getPluginAssetsDir(pluginId: string): string {
    return path.join(this.getPluginDir(pluginId), 'assets');
  }

  getPluginBackend(pluginId: string): string {
    const backendDir = path.join(this.getPluginDir(pluginId), 'backend');
    const platform = process.platform;
    const ext = platform === 'win32' ? '.dll' : platform === 'darwin' ? '.dylib' : '.so';
    const prefix = platform === 'win32' ? '' : 'lib';
    return path.join(backendDir, `${prefix}plugin${ext}`);
  }

  getPluginDataDir(pluginId: string): string {
    const dataDir = path.join(this.dataRoot, pluginId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
  }

  getPluginConfig(pluginId: string): string {
    return path.join(this.getPluginDataDir(pluginId), 'config.json');
  }

  getPluginCacheDir(pluginId: string): string {
    const cacheDir = path.join(this.getPluginDataDir(pluginId), 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  getPluginLogDir(pluginId: string): string {
    const logDir = path.join(this.dataRoot, 'logs', pluginId);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
  }

  isDevelopment(): boolean {
    return this.isDev;
  }

  getAppRoot(): string {
    return this.appRoot;
  }

  getDataRoot(): string {
    return this.dataRoot;
  }
}
