/**
 * @fileoverview UIohook全局鼠标监听管理器
 * @description 基于uiohook-rs的全局鼠标事件监听，实现桌宠透过功能
 * @author AI Assistant
 * @version 1.0.0
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { debug, info, warn, error } from '@tauri-apps/plugin-log';

export interface GlobalMouseEvent {
  x: number;
  y: number;
  button: 'left' | 'right';
  timestamp: number;
  is_over_pet: boolean;
}

export class UiohookPetManager {
  private isMonitoring = false;
  private pollInterval?: number;
  private isWindowClickThrough = false;
  private lastMouseMoveLog = 0;

  constructor() {
    info('🚀 初始化UIohook桌宠管理器');
  }

  /**
   * 启动UIohook全局鼠标监听
   */
  async startGlobalMonitoring(): Promise<void> {
    try {
      info('🎯 启动UIohook全局鼠标监听');
      
      if (this.isMonitoring) {
        warn('UIohook监听已经在运行中');
        return;
      }

      // 更新桌宠窗口边界信息
      await this.updatePetWindowBounds();

      // 尝试启动UIohook监听
      try {
        await invoke('start_uiohook_monitoring');
        this.isMonitoring = true;
        
        // 开始轮询事件
        this.startEventPolling();
        
        info('✅ UIohook全局鼠标监听启动成功');
      } catch (uiohookError) {
        warn(`UIohook启动失败: ${String(uiohookError)}, 使用备用方案`);
        
        // 如果UIohook失败，使用备用方案：直接监听窗口事件
        this.startFallbackMouseMonitoring();
        this.isMonitoring = true;
        
        info('✅ 备用鼠标监听启动成功');
      }
      
    } catch (err) {
      error(`启动鼠标监听失败: ${String(err)}`);
      throw err;
    }
  }

  /**
   * 停止UIohook全局鼠标监听
   */
  async stopGlobalMonitoring(): Promise<void> {
    try {
      info('🛑 停止UIohook全局鼠标监听');
      
      if (!this.isMonitoring) {
        debug('UIohook监听未运行，无需停止');
        return;
      }

      // 停止事件轮询
      this.stopEventPolling();
      
      // 停止UIohook监听
      await invoke('stop_uiohook_monitoring');
      
      // 确保窗口不透过
      await this.setWindowClickThrough(false);
      
      this.isMonitoring = false;
      
      info('✅ UIohook全局鼠标监听停止成功');
    } catch (err) {
      error(`停止UIohook监听失败: ${String(err)}`);
      throw err;
    }
  }

  /**
   * 更新桌宠窗口边界信息
   */
  private async updatePetWindowBounds(): Promise<void> {
    try {
      const currentWindow = getCurrentWebviewWindow();
      const position = await currentWindow.outerPosition();
      const size = await currentWindow.outerSize();
      
      await invoke('update_pet_window_bounds', {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height
      });
      
      info(`📐 桌宠窗口边界已更新: (${position.x}, ${position.y}) ${size.width}x${size.height}`);
    } catch (err) {
      error(`更新桌宠窗口边界失败: ${String(err)}`);
    }
  }

  /**
   * 开始事件轮询
   */
  private startEventPolling(): void {
    debug('🔄 开始UIohook事件轮询');
    
    this.pollInterval = window.setInterval(async () => {
      try {
        const events = await invoke<GlobalMouseEvent[]>('poll_uiohook_events');
        
        for (const event of events) {
          await this.handleGlobalMouseEvent(event);
        }
      } catch (err) {
        error(`轮询UIohook事件失败: ${String(err)}`);
      }
    }, 16); // 约60FPS的轮询频率
  }

  /**
   * 停止事件轮询
   */
  private stopEventPolling(): void {
    debug('🔄 停止UIohook事件轮询');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  /**
   * 处理全局鼠标事件
   */
  private async handleGlobalMouseEvent(event: GlobalMouseEvent): Promise<void> {
    info(`🌍 处理全局鼠标事件: ${event.button} 在 (${event.x}, ${event.y}) ${event.is_over_pet ? '【在桌宠上】' : '【不在桌宠上】'}`);
    
    // 更详细的位置信息
    debug(`📐 UIohook事件详情: 鼠标(${event.x}, ${event.y}), 按键=${event.button}, 时间=${event.timestamp}, 在桌宠上=${event.is_over_pet}`);
    
    if (event.is_over_pet) {
      if (event.button === 'left') {
        info('🐱 检测到左键点击桌宠 - 执行透过处理');
        await this.handleLeftClickOnPet();
      } else if (event.button === 'right') {
        info('🐱 检测到右键点击桌宠 - 阻止透过并显示菜单');
        await this.handleRightClickOnPet();
      }
    } else {
      debug(`🔍 鼠标不在桌宠上的${event.button}键点击，位置: (${event.x}, ${event.y})`);
    }
  }

  /**
   * 处理左键点击桌宠
   */
  private async handleLeftClickOnPet(): Promise<void> {
    try {
      info('⚡ 开始左键透过处理...');
      
      // 步骤1: 立即设置窗口透过
      await this.setWindowClickThrough(true);
      info('📋 窗口已设置为透过状态');
      
      // 步骤2: 很短的延迟让点击事件通过
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 步骤3: 恢复窗口为不透过
      await this.setWindowClickThrough(false);
      info('📋 窗口已恢复为交互状态');
      
      debug('✅ 左键透过处理完成');
    } catch (err) {
      error(`左键透过处理失败: ${String(err)}`);
      // 确保在出错时也恢复窗口状态
      await this.setWindowClickThrough(false);
    }
  }

  /**
   * 处理右键点击桌宠
   */
  private async handleRightClickOnPet(): Promise<void> {
    try {
      info('🖱️ 处理右键点击桌宠');
      
      // 确保窗口不透过，以便右键菜单能正常工作
      await this.setWindowClickThrough(false);
      
      // 这里可以触发右键菜单显示的逻辑
      // 比如发送自定义事件或调用菜单组件
      debug('📋 右键菜单准备就绪');
      
    } catch (err) {
      error(`右键点击处理失败: ${String(err)}`);
    }
  }

  /**
   * 备用鼠标监听方案（当UIohook失败时使用）
   */
  private startFallbackMouseMonitoring(): void {
    info('🔄 启动备用鼠标监听方案');
    
    // 直接在窗口上监听鼠标事件
    document.addEventListener('mousedown', async (event) => {
      try {
        const isLeftClick = event.button === 0;
        const isRightClick = event.button === 2;
        
        // 获取鼠标相对于页面的位置
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // 获取当前窗口位置和鼠标在屏幕上的绝对位置
        const currentWindow = getCurrentWebviewWindow();
        const windowPosition = await currentWindow.outerPosition();
        const screenX = windowPosition.x + mouseX;
        const screenY = windowPosition.y + mouseY;
        
        info(`🖱️ 鼠标点击位置: 页面内(${mouseX}, ${mouseY}) -> 屏幕坐标(${screenX}, ${screenY})`);
        
        // 检查是否在桌宠窗口范围内
        const isOverPet = await this.checkMouseOverPet(screenX, screenY);
        
        if (isLeftClick) {
          info(`🐱 检测到左键点击桌宠 ${isOverPet ? '【在桌宠上】' : '【不在桌宠上】'} - 执行透过处理`);
          await this.handleLeftClickOnPet();
        } else if (isRightClick) {
          info(`🐱 检测到右键点击桌宠 ${isOverPet ? '【在桌宠上】' : '【不在桌宠上】'} - 阻止透过并显示菜单`);
          await this.handleRightClickOnPet();
        }
      } catch (err) {
        error(`备用鼠标事件处理失败: ${String(err)}`);
      }
    });
    
    // 添加鼠标移动监听，实时显示鼠标位置状态
    document.addEventListener('mousemove', async (event) => {
      try {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        const currentWindow = getCurrentWebviewWindow();
        const windowPosition = await currentWindow.outerPosition();
        const screenX = windowPosition.x + mouseX;
        const screenY = windowPosition.y + mouseY;
        
        const isOverPet = await this.checkMouseOverPet(screenX, screenY);
        
        // 每秒最多输出一次，避免日志过多
        if (!this.lastMouseMoveLog || Date.now() - this.lastMouseMoveLog > 1000) {
          debug(`📍 鼠标位置: 屏幕(${screenX}, ${screenY}) ${isOverPet ? '【在桌宠上】' : '【不在桌宠上】'}`);
          this.lastMouseMoveLog = Date.now();
        }
      } catch (err) {
        // 静默处理移动事件错误，避免日志过多
      }
    });
    
    info('✅ 备用鼠标监听方案启动成功');
  }

  /**
   * 检查鼠标位置是否在桌宠窗口上方
   */
  private async checkMouseOverPet(screenX: number, screenY: number): Promise<boolean> {
    try {
      const currentWindow = getCurrentWebviewWindow();
      const position = await currentWindow.outerPosition();
      const size = await currentWindow.outerSize();
      
      const windowLeft = position.x;
      const windowTop = position.y;
      const windowRight = position.x + size.width;
      const windowBottom = position.y + size.height;
      
      const isOver = screenX >= windowLeft && screenX <= windowRight && 
                     screenY >= windowTop && screenY <= windowBottom;
      
      debug(`📐 桌宠窗口边界: (${windowLeft}, ${windowTop}) 到 (${windowRight}, ${windowBottom})`);
      debug(`📍 鼠标位置: (${screenX}, ${screenY}) -> ${isOver ? '在桌宠上' : '不在桌宠上'}`);
      
      return isOver;
    } catch (err) {
      error(`检查鼠标位置失败: ${String(err)}`);
      return true; // 错误时默认认为在桌宠上
    }
  }

  /**
   * 等待事件传播
   */
  private async waitForEventPropagation(): Promise<void> {
    return new Promise(resolve => {
      // 使用多个动画帧确保充分的时间
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 150); // 适当的延迟时间
        });
      });
    });
  }

  /**
   * 设置窗口点击穿透
   */
  private async setWindowClickThrough(clickThrough: boolean): Promise<void> {
    try {
      if (this.isWindowClickThrough === clickThrough) {
        debug(`窗口透过状态已经是 ${clickThrough}，跳过设置`);
        return;
      }
      
      const currentWindow = getCurrentWebviewWindow();
      await invoke('set_window_click_through', { 
        window: currentWindow,
        clickThrough 
      });
      
      this.isWindowClickThrough = clickThrough;
      info(`🪟 窗口透过状态设置为: ${clickThrough}`);
    } catch (err) {
      error(`设置窗口透过失败: ${String(err)}`);
    }
  }

  /**
   * 获取当前鼠标位置
   */
  async getCurrentMousePosition(): Promise<{ x: number; y: number }> {
    try {
      const [x, y] = await invoke<[number, number]>('get_current_mouse_position');
      debug(`🖱️ 当前鼠标位置: (${x}, ${y})`);
      return { x, y };
    } catch (err) {
      error(`获取鼠标位置失败: ${String(err)}`);
      return { x: 0, y: 0 };
    }
  }

  /**
   * 检查是否正在监听
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    info('🗑️ 销毁UIohook桌宠管理器');
    
    try {
      await this.stopGlobalMonitoring();
    } catch (err) {
      error(`销毁UIohook管理器时出错: ${String(err)}`);
    }
  }
}

// 全局单例实例
let uiohookPetManager: UiohookPetManager | null = null;

/**
 * 获取UIohook桌宠管理器实例
 */
export function getUiohookPetManager(): UiohookPetManager {
  if (!uiohookPetManager) {
    uiohookPetManager = new UiohookPetManager();
  }
  return uiohookPetManager;
}