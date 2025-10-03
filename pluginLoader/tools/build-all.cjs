#!/usr/bin/env node

/**
 * 批量构建所有插件
 */

const fs = require('fs-extra');
const path = require('path');
const { PluginCompiler } = require('./compiler.cjs');
const { PluginPackager } = require('./packager.cjs');

async function buildAll(options = {}) {
  const pluginsDir = path.join(__dirname, '../plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    console.error('❌ 插件目录不存在');
    process.exit(1);
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

  console.log(`\n🔨 开始构建 ${plugins.length} 个插件...\n`);

  const results = {
    success: [],
    failed: []
  };

  for (const pluginName of plugins) {
    const pluginPath = path.join(pluginsDir, pluginName);
    
    try {
      // 1. 编译
      console.log(`\n[${ plugins.indexOf(pluginName) + 1}/${plugins.length}] ${pluginName}`);
      const compiler = new PluginCompiler(pluginPath, {
        minify: options.minify !== false,
        sourcemap: options.sourcemap !== false
      });

      const compileSuccess = await compiler.compile();
      if (!compileSuccess) {
        throw new Error('编译失败');
      }

      // 2. 打包（如果需要）
      if (options.package) {
        const distPath = path.join(__dirname, '../../dist/plugins', pluginName);
        const packager = new PluginPackager(distPath);
        await packager.package();
      }

      results.success.push(pluginName);
    } catch (error) {
      console.error(`❌ ${pluginName} 构建失败: ${error.message}`);
      results.failed.push({ name: pluginName, error: error.message });
    }
  }

  // 输出总结
  console.log('\n' + '='.repeat(60));
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
    results.failed.forEach(({ name, error }) => {
      console.log(`  ✗ ${name}: ${error}`);
    });
  }

  console.log('\n');

  return results.failed.length === 0;
}

// CLI 接口
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    package: args.includes('--package'),
    includeExamples: args.includes('--include-examples'),
    minify: !args.includes('--no-minify'),
    sourcemap: !args.includes('--no-sourcemap')
  };

  const success = await buildAll(options);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildAll };
