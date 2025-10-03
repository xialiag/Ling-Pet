#!/usr/bin/env node

/**
 * 开发模式 - 监听插件变化并自动重新编译
 */

const chokidar = require('chokidar');
const path = require('path');
const { PluginCompiler } = require('./compiler.cjs');

class DevWatcher {
  constructor(pluginPath, options = {}) {
    this.pluginPath = path.resolve(pluginPath);
    this.pluginName = path.basename(this.pluginPath);
    this.options = options;
    this.compiler = null;
    this.isCompiling = false;
    this.pendingCompile = false;
  }

  async start() {
    console.log(`\n👀 监听插件: ${this.pluginName}`);
    console.log(`   路径: ${this.pluginPath}\n`);

    // 初始编译
    await this.compile();

    // 设置文件监听
    const watcher = chokidar.watch(this.pluginPath, {
      ignored: [
        /(^|[\/\\])\../, // 隐藏文件
        '**/node_modules/**',
        '**/target/**',
        '**/dist/**',
        '**/*.map'
      ],
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('change', (filePath) => this.handleChange(filePath))
      .on('add', (filePath) => this.handleChange(filePath))
      .on('unlink', (filePath) => this.handleChange(filePath))
      .on('error', (error) => console.error(`监听错误: ${error}`));

    console.log('✅ 监听已启动，等待文件变化...\n');

    // 保持进程运行
    process.on('SIGINT', () => {
      console.log('\n\n👋 停止监听');
      watcher.close();
      process.exit(0);
    });
  }

  async handleChange(filePath) {
    const relativePath = path.relative(this.pluginPath, filePath);
    console.log(`📝 文件变化: ${relativePath}`);

    if (this.isCompiling) {
      this.pendingCompile = true;
      return;
    }

    await this.compile();

    // 如果在编译期间有新的变化，再次编译
    if (this.pendingCompile) {
      this.pendingCompile = false;
      await this.compile();
    }
  }

  async compile() {
    this.isCompiling = true;

    try {
      const startTime = Date.now();
      
      this.compiler = new PluginCompiler(this.pluginPath, {
        minify: false, // 开发模式不压缩
        sourcemap: true,
        ...this.options
      });

      await this.compiler.compile();

      const duration = Date.now() - startTime;
      console.log(`⚡ 编译完成 (${duration}ms)\n`);
    } catch (error) {
      console.error(`❌ 编译错误: ${error.message}\n`);
    } finally {
      this.isCompiling = false;
    }
  }
}

// CLI 接口
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node dev-watch.js <plugin-path>');
    console.log('\n示例:');
    console.log('  node dev-watch.js ../plugins/my-plugin');
    process.exit(1);
  }

  const pluginPath = args[0];
  const watcher = new DevWatcher(pluginPath);
  await watcher.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { DevWatcher };
