/**
 * PathResolver 测试
 */

import { PathResolver } from '../core/pathResolver';
import path from 'path';
import fs from 'fs';

describe('PathResolver', () => {
  let pathResolver: PathResolver;

  beforeAll(() => {
    pathResolver = PathResolver.getInstance();
  });

  test('should be singleton', () => {
    const instance1 = PathResolver.getInstance();
    const instance2 = PathResolver.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should return plugins root', () => {
    const pluginsRoot = pathResolver.getPluginsRoot();
    expect(pluginsRoot).toBeTruthy();
    expect(typeof pluginsRoot).toBe('string');
  });

  test('should return plugin directory', () => {
    const pluginDir = pathResolver.getPluginDir('test-plugin');
    expect(pluginDir).toContain('test-plugin');
  });

  test('should return plugin entry', () => {
    const entry = pathResolver.getPluginEntry('test-plugin');
    expect(entry).toContain('index.js');
  });

  test('should return assets directory', () => {
    const assetsDir = pathResolver.getPluginAssetsDir('test-plugin');
    expect(assetsDir).toContain('assets');
  });

  test('should return data directory', () => {
    const dataDir = pathResolver.getPluginDataDir('test-plugin');
    expect(dataDir).toBeTruthy();
    // 应该创建目录
    expect(fs.existsSync(dataDir)).toBe(true);
  });

  test('should return backend path', () => {
    const backendPath = pathResolver.getPluginBackend('test-plugin');
    const platform = process.platform;
    
    if (platform === 'win32') {
      expect(backendPath).toContain('.dll');
    } else if (platform === 'darwin') {
      expect(backendPath).toContain('.dylib');
    } else {
      expect(backendPath).toContain('.so');
    }
  });

  test('should detect development mode', () => {
    const isDev = pathResolver.isDevelopment();
    expect(typeof isDev).toBe('boolean');
  });
});
