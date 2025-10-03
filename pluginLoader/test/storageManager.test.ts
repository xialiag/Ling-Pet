/**
 * StorageManager 测试
 */

import { StorageManager } from '../core/storageManager';
import { PathResolver } from '../core/pathResolver';
import fs from 'fs';

describe('StorageManager', () => {
  let storageManager: StorageManager;
  const testPluginId = 'test-plugin';

  beforeAll(() => {
    storageManager = new StorageManager();
  });

  afterAll(() => {
    // 清理测试数据
    const pathResolver = PathResolver.getInstance();
    const configPath = pathResolver.getPluginConfig(testPluginId);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  test('should set and get value', async () => {
    await storageManager.set(testPluginId, 'testKey', 'testValue');
    const value = await storageManager.get(testPluginId, 'testKey');
    expect(value).toBe('testValue');
  });

  test('should set and get object', async () => {
    const testObj = { foo: 'bar', num: 123 };
    await storageManager.set(testPluginId, 'testObj', testObj);
    const value = await storageManager.get(testPluginId, 'testObj');
    expect(value).toEqual(testObj);
  });

  test('should return undefined for non-existent key', async () => {
    const value = await storageManager.get(testPluginId, 'nonExistent');
    expect(value).toBeUndefined();
  });

  test('should delete value', async () => {
    await storageManager.set(testPluginId, 'toDelete', 'value');
    await storageManager.delete(testPluginId, 'toDelete');
    const value = await storageManager.get(testPluginId, 'toDelete');
    expect(value).toBeUndefined();
  });

  test('should get all values', async () => {
    await storageManager.set(testPluginId, 'key1', 'value1');
    await storageManager.set(testPluginId, 'key2', 'value2');
    const all = await storageManager.getAll(testPluginId);
    expect(all).toHaveProperty('key1', 'value1');
    expect(all).toHaveProperty('key2', 'value2');
  });

  test('should set all values', async () => {
    const data = { a: 1, b: 2, c: 3 };
    await storageManager.setAll(testPluginId, data);
    const all = await storageManager.getAll(testPluginId);
    expect(all).toEqual(data);
  });

  test('should use cache', async () => {
    await storageManager.set(testPluginId, 'cached', 'value');
    
    // 第一次读取会从文件
    const value1 = await storageManager.get(testPluginId, 'cached');
    
    // 第二次读取应该从缓存
    const value2 = await storageManager.get(testPluginId, 'cached');
    
    expect(value1).toBe(value2);
  });

  test('should clear cache', async () => {
    await storageManager.set(testPluginId, 'test', 'value');
    storageManager.clearCache(testPluginId);
    
    // 清除缓存后应该能重新读取
    const value = await storageManager.get(testPluginId, 'test');
    expect(value).toBe('value');
  });
});
