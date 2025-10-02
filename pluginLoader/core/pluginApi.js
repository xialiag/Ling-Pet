/**
 * 插件API - 提供给插件开发者使用的工具函数
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * 定义插件
 */
export function definePlugin(definition) {
    return definition;
}
/**
 * 创建Hook包装器
 */
export function createHookWrapper(original, before, after) {
    return ((...args) => {
        try {
            // 执行before hook，可能修改参数
            const modifiedArgs = before ? before(...args) : undefined;
            const finalArgs = modifiedArgs || args;
            // 执行原函数
            const result = original(...finalArgs);
            // 执行after hook，可能修改返回值
            return after ? after(result, ...finalArgs) : result;
        }
        catch (error) {
            console.error('[Plugin Hook Error]', error);
            throw error;
        }
    });
}
/**
 * 创建异步Hook包装器
 */
export function createAsyncHookWrapper(original, before, after) {
    return ((...args) => __awaiter(this, void 0, void 0, function* () {
        try {
            // 执行before hook
            const modifiedArgs = before ? yield before(...args) : undefined;
            const finalArgs = modifiedArgs || args;
            // 执行原函数
            const result = yield original(...finalArgs);
            // 执行after hook
            return after ? yield after(result, ...finalArgs) : result;
        }
        catch (error) {
            console.error('[Plugin Async Hook Error]', error);
            throw error;
        }
    }));
}
/**
 * 深度代理对象，用于拦截属性访问
 */
export function createDeepProxy(target, handler) {
    return new Proxy(target, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (handler.get) {
                return handler.get(target, prop, receiver);
            }
            // 如果是对象，递归代理
            if (value && typeof value === 'object') {
                return createDeepProxy(value, handler);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            if (handler.set) {
                return handler.set(target, prop, value, receiver);
            }
            return Reflect.set(target, prop, value, receiver);
        }
    });
}
/**
 * 安全执行插件代码
 */
export function safeExecute(fn, errorHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield fn();
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[Plugin Safe Execute Error]', err);
            errorHandler === null || errorHandler === void 0 ? void 0 : errorHandler(err);
            return undefined;
        }
    });
}
/**
 * 事件总线 - 用于插件间通信
 */
export class PluginEventBus {
    constructor() {
        this.listeners = new Map();
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        // 返回取消监听函数
        return () => {
            var _a;
            (_a = this.listeners.get(event)) === null || _a === void 0 ? void 0 : _a.delete(handler);
        };
    }
    emit(event, ...args) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args);
                }
                catch (error) {
                    console.error(`[Plugin Event Error] ${event}`, error);
                }
            });
        }
    }
    off(event, handler) {
        var _a;
        if (!handler) {
            this.listeners.delete(event);
        }
        else {
            (_a = this.listeners.get(event)) === null || _a === void 0 ? void 0 : _a.delete(handler);
        }
    }
}
