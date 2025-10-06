#!/usr/bin/env node

/**
 * 插件编译工具 - 基于 esbuild
 * 支持 TypeScript/JavaScript 编译和打包
 */

const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

class PluginCompiler {
  constructor(pluginPath, options = {}) {
    this.pluginPath = path.resolve(pluginPath);
    this.pluginName = path.basename(this.pluginPath);
    this.options = {
      outDir: options.outDir || path.join(__dirname, '../../dist/plugins', this.pluginName),
      minify: options.minify !== false,
      sourcemap: options.sourcemap !== false,
      watch: options.watch || false,
      ...options
    };
  }

  async compile() {
    console.log(`\n🔨 编译插件: ${this.pluginName}`);
    console.log(`   源目录: ${this.pluginPath}`);
    console.log(`   输出目录: ${this.options.outDir}`);

    try {
      // 1. 清理输出目录
      await fs.emptyDir(this.options.outDir);

      // 2. 查找入口文件
      const entryPoint = this.findEntryPoint();
      if (!entryPoint) {
        throw new Error('找不到入口文件 (index.ts/index.js)');
      }

      // 3. 编译 TypeScript/JavaScript
      await this.buildJS(entryPoint);

      // 4. 编译 Rust 后端（如果存在）
      await this.buildRustBackend();

      // 5. 复制资源文件
      await this.copyAssets();

      // 6. 生成 package.json
      await this.generatePackageJson();

      console.log(`✅ 编译完成: ${this.pluginName}\n`);
      return true;
    } catch (error) {
      console.error(`❌ 编译失败: ${error.message}`);
      if (this.options.verbose) {
        console.error(error);
      }
      return false;
    }
  }

  findEntryPoint() {
    const candidates = ['index.ts', 'index.js', 'src/index.ts', 'src/index.js'];
    for (const candidate of candidates) {
      const fullPath = path.join(this.pluginPath, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  async buildJS(entryPoint) {
    console.log('   📦 编译 JavaScript/TypeScript...');

    // 创建一个虚拟的 Vue 模块文件
    const vueShimPath = path.join(this.options.outDir, '__vue-shim.js');
    await fs.writeFile(vueShimPath, `
export const defineComponent = __vue.defineComponent;
export const h = __vue.h;
export const ref = __vue.ref;
export const computed = __vue.computed;
export const watch = __vue.watch;
export const onMounted = __vue.onMounted;
export const onUnmounted = __vue.onUnmounted;
export const onBeforeMount = __vue.onBeforeMount;
export const onBeforeUnmount = __vue.onBeforeUnmount;
export const onUpdated = __vue.onUpdated;
export const onBeforeUpdate = __vue.onBeforeUpdate;
`);

    const buildOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      outfile: path.join(this.options.outDir, 'index.js'),
      format: 'iife',  // 使用 IIFE 格式，兼容 new Function()
      globalName: 'PluginModule',
      platform: 'browser',  // 改为 browser 平台
      target: 'es2020',
      minify: this.options.minify,
      sourcemap: this.options.sourcemap,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
        '.json': 'json'
      },
      logLevel: 'warning',
      // 添加 banner 来设置 module.exports
      banner: {
        js: 'var module = { exports: {} };'
      },
      footer: {
        js: 'module.exports = PluginModule.default || PluginModule;'
      },
      // 使用 alias 来替换 vue 导入
      alias: {
        'vue': vueShimPath
      }
    };

    if (this.options.watch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('   👀 监听文件变化...');
    } else {
      await esbuild.build(buildOptions);
      console.log('   ✓ JavaScript 编译完成');
      
      // 删除临时的 shim 文件
      try {
        await fs.remove(vueShimPath);
      } catch (error) {
        // 忽略删除错误
      }
    }
  }

  async buildRustBackend() {
    const backendDir = path.join(this.pluginPath, 'backend');
    const cargoToml = path.join(backendDir, 'Cargo.toml');

    if (!fs.existsSync(cargoToml)) {
      return; // 没有 Rust 后端
    }

    console.log('   🦀 编译 Rust 后端...');

    try {
      const { execSync } = require('child_process');
      execSync('cargo build --release', {
        cwd: backendDir,
        stdio: 'inherit'
      });

      // 复制编译产物
      const targetDir = path.join(backendDir, 'target/release');
      const backendOutDir = path.join(this.options.outDir, 'backend');
      await fs.ensureDir(backendOutDir);

      const platform = process.platform;
      let libName;
      
      if (platform === 'win32') {
        libName = 'plugin.dll';
      } else if (platform === 'darwin') {
        libName = 'libplugin.dylib';
      } else {
        libName = 'libplugin.so';
      }

      const sourcePath = path.join(targetDir, libName);
      const destPath = path.join(backendOutDir, libName);

      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        console.log(`   ✓ Rust 后端编译完成: ${libName}`);
      } else {
        console.warn(`   ⚠️  找不到编译产物: ${libName}`);
      }
    } catch (error) {
      console.error(`   ❌ Rust 编译失败: ${error.message}`);
      throw error;
    }
  }

  async copyAssets() {
    console.log('   📁 复制资源文件...');

    const assetsToCopy = [
      { src: 'README.md', required: false },
      { src: 'LICENSE', required: false },
      { src: 'manifest.json', required: false },
      { src: 'assets', required: false, isDir: true },
      { src: 'components', required: false, isDir: true },
      { src: 'styles', required: false, isDir: true },
      { src: 'locales', required: false, isDir: true },
      { src: 'pages', required: false, isDir: true }
    ];

    for (const asset of assetsToCopy) {
      const srcPath = path.join(this.pluginPath, asset.src);
      const destPath = path.join(this.options.outDir, asset.src);

      if (fs.existsSync(srcPath)) {
        await fs.copy(srcPath, destPath, {
          filter: (src) => {
            // 过滤掉 TypeScript 源文件（保留 .d.ts）
            if (src.endsWith('.ts') && !src.endsWith('.d.ts')) {
              return false;
            }
            return true;
          }
        });
        console.log(`   ✓ 已复制: ${asset.src}`);
      } else if (asset.required) {
        throw new Error(`缺少必需文件: ${asset.src}`);
      }
    }
  }

  async generatePackageJson() {
    const srcPackageJson = path.join(this.pluginPath, 'package.json');
    const destPackageJson = path.join(this.options.outDir, 'package.json');

    if (fs.existsSync(srcPackageJson)) {
      const pkg = await fs.readJson(srcPackageJson);
      
      // 清理开发依赖
      delete pkg.devDependencies;
      delete pkg.scripts;
      
      // 确保有基本字段
      pkg.main = pkg.main || 'index.js';
      pkg.type = 'module';

      await fs.writeJson(destPackageJson, pkg, { spaces: 2 });
      console.log('   ✓ 生成 package.json');
    }
  }
}

// CLI 接口
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node compiler.js <plugin-path> [options]');
    console.log('\n选项:');
    console.log('  --watch          监听模式');
    console.log('  --no-minify      不压缩代码');
    console.log('  --no-sourcemap   不生成 sourcemap');
    console.log('  --out-dir <dir>  指定输出目录');
    process.exit(1);
  }

  const pluginPath = args[0];
  const options = {
    watch: args.includes('--watch'),
    minify: !args.includes('--no-minify'),
    sourcemap: !args.includes('--no-sourcemap'),
    verbose: args.includes('--verbose')
  };

  const outDirIndex = args.indexOf('--out-dir');
  if (outDirIndex !== -1 && args[outDirIndex + 1]) {
    options.outDir = args[outDirIndex + 1];
  }

  const compiler = new PluginCompiler(pluginPath, options);
  const success = await compiler.compile();
  
  if (!options.watch) {
    process.exit(success ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PluginCompiler };
