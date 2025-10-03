#!/usr/bin/env node

/**
 * 任务运行器 - 简化常用操作
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const tasks = {
  // 清理构建产物
  clean: async () => {
    console.log('🧹 清理构建产物...');
    
    const dirsToClean = [
      path.join(__dirname, '../../dist/plugins'),
      path.join(__dirname, '../../releases/plugins')
    ];

    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        await fs.remove(dir);
        console.log(`   ✓ 已删除: ${path.relative(process.cwd(), dir)}`);
      }
    }

    console.log('✅ 清理完成\n');
  },

  // 安装依赖
  install: async () => {
    console.log('📦 安装依赖...\n');
    
    const pluginsDir = path.join(__dirname, '../plugins');
    const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const plugin of plugins) {
      const pluginPath = path.join(pluginsDir, plugin);
      const packageJson = path.join(pluginPath, 'package.json');

      if (fs.existsSync(packageJson)) {
        console.log(`📦 ${plugin}`);
        try {
          execSync('npm install', {
            cwd: pluginPath,
            stdio: 'inherit'
          });
        } catch (error) {
          console.error(`   ❌ 安装失败: ${error.message}`);
        }
      }
    }

    console.log('\n✅ 依赖安装完成\n');
  },

  // 检查插件
  check: async () => {
    console.log('🔍 检查插件...\n');
    
    const pluginsDir = path.join(__dirname, '../plugins');
    const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const issues = [];

    for (const plugin of plugins) {
      const pluginPath = path.join(pluginsDir, plugin);
      const packageJson = path.join(pluginPath, 'package.json');
      const indexFile = path.join(pluginPath, 'index.ts');

      console.log(`📦 ${plugin}`);

      // 检查必需文件
      if (!fs.existsSync(packageJson)) {
        issues.push(`${plugin}: 缺少 package.json`);
        console.log('   ❌ 缺少 package.json');
      } else {
        console.log('   ✓ package.json');
      }

      if (!fs.existsSync(indexFile) && !fs.existsSync(path.join(pluginPath, 'index.js'))) {
        issues.push(`${plugin}: 缺少入口文件`);
        console.log('   ❌ 缺少入口文件');
      } else {
        console.log('   ✓ 入口文件');
      }

      // 检查 package.json 内容
      if (fs.existsSync(packageJson)) {
        try {
          const pkg = fs.readJsonSync(packageJson);
          
          if (!pkg.name) {
            issues.push(`${plugin}: package.json 缺少 name`);
            console.log('   ❌ 缺少 name 字段');
          }
          
          if (!pkg.version) {
            issues.push(`${plugin}: package.json 缺少 version`);
            console.log('   ❌ 缺少 version 字段');
          }
        } catch (error) {
          issues.push(`${plugin}: package.json 格式错误`);
          console.log('   ❌ package.json 格式错误');
        }
      }

      console.log('');
    }

    // 输出总结
    console.log('='.repeat(60));
    if (issues.length === 0) {
      console.log('✅ 所有插件检查通过');
    } else {
      console.log(`❌ 发现 ${issues.length} 个问题:\n`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    console.log('');
  },

  // 构建所有
  'build-all': async () => {
    console.log('🔨 构建所有插件...\n');
    execSync('node build-all.cjs', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  },

  // 打包所有
  'package-all': async () => {
    console.log('📦 打包所有插件...\n');
    execSync('node build-all.cjs --package', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  },

  // 发布准备
  release: async () => {
    console.log('🚀 准备发布...\n');
    
    // 1. 清理
    await tasks.clean();
    
    // 2. 检查
    await tasks.check();
    
    // 3. 构建和打包
    await tasks['package-all']();
    
    console.log('\n✅ 发布准备完成！');
    console.log('\n输出目录:');
    console.log('  - dist/plugins/     (编译后的插件)');
    console.log('  - releases/plugins/ (打包后的插件)\n');
  },

  // 帮助信息
  help: () => {
    console.log('插件工具任务运行器\n');
    console.log('用法: node tasks.js <task>\n');
    console.log('任务:');
    console.log('  clean         清理构建产物');
    console.log('  install       安装所有插件的依赖');
    console.log('  check         检查所有插件');
    console.log('  build-all     构建所有插件');
    console.log('  package-all   打包所有插件');
    console.log('  release       准备发布（清理+检查+构建+打包）');
    console.log('  help          显示帮助信息\n');
  }
};

// 运行任务
async function main() {
  const taskName = process.argv[2];

  if (!taskName || taskName === 'help') {
    tasks.help();
    return;
  }

  const task = tasks[taskName];
  if (!task) {
    console.error(`❌ 未知任务: ${taskName}\n`);
    tasks.help();
    process.exit(1);
  }

  try {
    await task();
  } catch (error) {
    console.error(`\n❌ 任务失败: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { tasks };
