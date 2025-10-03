#!/usr/bin/env node

/**
 * 一键构建和打包插件
 * 自动处理 TypeScript 编译、Rust 后端构建和打包
 */

const { PluginCompiler } = require('./compiler.cjs');
const { PluginPackager } = require('./packager.cjs');
const path = require('path');
const fs = require('fs-extra');

async function buildAndPackage(pluginName, options = {}) {
  console.log(`\n🚀 开始构建和打包插件: ${pluginName}\n`);
  
  const pluginSourcePath = path.join(__dirname, '../plugins', pluginName);
  const pluginDistPath = path.join(__dirname, '../../dist/plugins', pluginName);
  
  // 检查插件是否存在
  if (!fs.existsSync(pluginSourcePath)) {
    console.error(`❌ 插件目录不存在: ${pluginSourcePath}`);
    return false;
  }

  try {
    // 步骤 1: 编译插件（包括 Rust 后端）
    console.log('📦 步骤 1/2: 编译插件...\n');
    const compiler = new PluginCompiler(pluginSourcePath, {
      minify: options.minify !== false,
      sourcemap: options.sourcemap !== false,
      verbose: options.verbose
    });

    const compileSuccess = await compiler.compile();
    if (!compileSuccess) {
      throw new Error('编译失败');
    }

    // 步骤 2: 打包插件
    console.log('\n📦 步骤 2/2: 打包插件...\n');
    const packagerOptions = {
      includeSource: options.includeSource
    };
    if (options.outDir) {
      packagerOptions.outDir = options.outDir;
    }
    const packager = new PluginPackager(pluginDistPath, packagerOptions);

    const zipPath = await packager.package();

    console.log('\n✅ 构建和打包完成！');
    console.log(`   插件包: ${path.basename(zipPath)}`);
    
    return true;
  } catch (error) {
    console.error(`\n❌ 构建失败: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    return false;
  }
}

async function buildAndPackageAll(options = {}) {
  const pluginsDir = path.join(__dirname, '../plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    console.error('❌ 插件目录不存在');
    return false;
  }

  const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => {
      // 过滤掉示例插件（除非明确要求）
      if (!options.includeExamples) {
        return !name.startsWith('example-') && !name.startsWith('demo-');
      }
      return true;
    });

  console.log(`\n🚀 开始构建 ${plugins.length} 个插件...\n`);

  const results = {
    success: [],
    failed: []
  };

  for (const pluginName of plugins) {
    const success = await buildAndPackage(pluginName, options);
    if (success) {
      results.success.push(pluginName);
    } else {
      results.failed.push(pluginName);
    }
    console.log('\n' + '─'.repeat(60) + '\n');
  }

  // 输出总结
  console.log('=' .repeat(60));
  console.log('📊 构建总结');
  console.log('='.repeat(60));
  console.log(`总计: ${plugins.length}`);
  console.log(`✅ 成功: ${results.success.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);

  if (results.success.length > 0) {
    console.log('\n成功的插件:');
    results.success.forEach(name => console.log(`  ✓ ${name}`));
  }

  if (results.failed.length > 0) {
    console.log('\n失败的插件:');
    results.failed.forEach(name => console.log(`  ✗ ${name}`));
  }

  console.log('\n');

  return results.failed.length === 0;
}

// CLI 接口
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    includeExamples: args.includes('--include-examples'),
    includeSource: args.includes('--include-source'),
    minify: !args.includes('--no-minify'),
    sourcemap: !args.includes('--no-sourcemap'),
    verbose: args.includes('--verbose')
  };

  const outDirIndex = args.indexOf('--out-dir');
  if (outDirIndex !== -1 && args[outDirIndex + 1]) {
    options.outDir = args[outDirIndex + 1];
  }

  // 过滤掉选项参数
  const pluginNames = args.filter(arg => !arg.startsWith('--') && arg !== options.outDir);

  if (pluginNames.length === 0) {
    // 构建所有插件
    const success = await buildAndPackageAll(options);
    process.exit(success ? 0 : 1);
  } else {
    // 构建指定插件
    let allSuccess = true;
    for (const pluginName of pluginNames) {
      const success = await buildAndPackage(pluginName, options);
      if (!success) {
        allSuccess = false;
      }
      if (pluginNames.length > 1) {
        console.log('\n' + '─'.repeat(60) + '\n');
      }
    }
    process.exit(allSuccess ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildAndPackage, buildAndPackageAll };
