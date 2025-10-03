#!/usr/bin/env node

/**
 * 插件打包工具
 * 将编译后的插件打包成 .zip 文件用于分发
 */

const fs = require('fs-extra');
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');
const crypto = require('crypto');

class PluginPackager {
  constructor(pluginDir, options = {}) {
    this.pluginDir = path.resolve(pluginDir);
    this.pluginName = path.basename(this.pluginDir);
    this.options = {
      outDir: options.outDir || path.join(__dirname, '../../releases/plugins'),
      includeSource: options.includeSource || false,
      ...options
    };
  }

  async package() {
    console.log(`\n📦 打包插件: ${this.pluginName}`);
    console.log(`   源目录: ${this.pluginDir}`);

    try {
      // 1. 验证插件目录
      await this.validate();

      // 2. 读取版本信息和后端配置
      const version = await this.getVersion();
      const hasBackend = await this.hasBackend();

      // 3. 创建输出目录
      await fs.ensureDir(this.options.outDir);

      // 4. 确定平台后缀
      let platformSuffix = '';
      if (hasBackend) {
        // 如果有后端，添加平台标识
        const platform = process.platform;
        const platformMap = {
          'win32': 'win32',
          'darwin': 'darwin',
          'linux': 'linux'
        };
        platformSuffix = `-${platformMap[platform] || platform}`;
        console.log(`   ⚙️  检测到 Rust 后端，生成平台特定包: ${platformMap[platform]}`);
      }

      // 5. 打包
      const zipPath = path.join(
        this.options.outDir,
        `${this.pluginName}-${version}${platformSuffix}.zip`
      );

      await this.createZip(zipPath);

      // 6. 生成校验和
      const checksum = await this.generateChecksum(zipPath);

      // 7. 生成元数据
      await this.generateMetadata(zipPath, version, checksum, platformSuffix || '');

      console.log(`✅ 打包完成: ${path.basename(zipPath)}`);
      console.log(`   大小: ${this.formatSize(fs.statSync(zipPath).size)}`);
      console.log(`   SHA256: ${checksum}\n`);

      return zipPath;
    } catch (error) {
      console.error(`❌ 打包失败: ${error.message}`);
      throw error;
    }
  }

  async validate() {
    // 检查必需文件
    const requiredFiles = ['package.json', 'index.js'];

    for (const file of requiredFiles) {
      const filePath = path.join(this.pluginDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`缺少必需文件: ${file}`);
      }
    }

    // 验证 package.json
    const pkg = await fs.readJson(path.join(this.pluginDir, 'package.json'));
    if (!pkg.name || !pkg.version) {
      throw new Error('package.json 缺少 name 或 version 字段');
    }

    console.log(`   ✓ 验证通过`);
  }

  async getVersion() {
    const pkg = await fs.readJson(path.join(this.pluginDir, 'package.json'));
    return pkg.version;
  }

  async hasBackend() {
    // 检查是否存在 backend 目录和编译后的动态库
    const backendDir = path.join(this.pluginDir, 'backend');
    if (!fs.existsSync(backendDir)) {
      return false;
    }

    // 检查是否有编译后的动态库文件
    const platform = process.platform;
    let libName;
    if (platform === 'win32') {
      libName = 'plugin.dll';
    } else if (platform === 'darwin') {
      libName = 'libplugin.dylib';
    } else {
      libName = 'libplugin.so';
    }

    const libPath = path.join(backendDir, libName);
    return fs.existsSync(libPath);
  }

  async createZip(outputPath) {
    return new Promise(async (resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        console.log(`   ✓ 已创建压缩包 (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);

      // 生成 manifest.json（从 package.json 转换）
      try {
        const packageJsonPath = path.join(this.pluginDir, 'package.json');
        const packageJson = await fs.readJson(packageJsonPath);

        // 处理入口文件路径（将 .ts 转换为 .js）
        let entryFile = packageJson.main || 'index.js';
        if (entryFile.endsWith('.ts')) {
          entryFile = entryFile.replace(/\.ts$/, '.js');
        }

        const manifest = {
          id: packageJson.name,
          name: packageJson.displayName || packageJson.name,
          version: packageJson.version,
          description: packageJson.description || '',
          author: packageJson.author || '',
          homepage: packageJson.homepage || '',
          entry: entryFile,
          icon: packageJson.icon || '',
          permissions: packageJson.permissions || [],
          dependencies: packageJson.pluginDependencies || {},
          backend: packageJson.backend || { enabled: false },
          config: packageJson.config || {}
        };

        // 将 manifest 添加到压缩包
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
        console.log(`   ✓ 生成 manifest.json`);
      } catch (error) {
        console.warn(`   ⚠ 无法生成 manifest.json: ${error.message}`);
      }

      // 添加文件到压缩包
      const filesToInclude = [
        'package.json',
        'index.js',
        'index.js.map',
        'README.md',
        'LICENSE'
      ];

      const dirsToInclude = [
        'assets',
        'backend',
        'components',
        'styles',
        'locales'
      ];

      // 添加文件
      for (const file of filesToInclude) {
        const filePath = path.join(this.pluginDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }

      // 添加目录
      for (const dir of dirsToInclude) {
        const dirPath = path.join(this.pluginDir, dir);
        if (fs.existsSync(dirPath)) {
          archive.directory(dirPath, dir);
        }
      }

      archive.finalize();
    });
  }

  async generateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async generateMetadata(zipPath, version, checksum, platformSuffix) {
    const pkg = await fs.readJson(path.join(this.pluginDir, 'package.json'));
    const stats = fs.statSync(zipPath);

    // 处理平台后缀
    let platform = 'universal';
    if (platformSuffix && typeof platformSuffix === 'string' && platformSuffix.length > 0) {
      platform = platformSuffix.replace(/^-/, ''); // 移除开头的 '-'
    }

    const metadata = {
      name: pkg.name,
      version: version,
      description: pkg.description || '',
      author: pkg.author || '',
      homepage: pkg.homepage || '',
      license: pkg.license || '',
      file: path.basename(zipPath),
      size: stats.size,
      checksum: checksum,
      algorithm: 'sha256',
      createdAt: new Date().toISOString(),
      dependencies: pkg.dependencies || {},
      permissions: pkg.permissions || [],
      platform: platform
    };

    const metadataPath = zipPath.replace('.zip', '.json');
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });

    console.log(`   ✓ 生成元数据: ${path.basename(metadataPath)}`);
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// CLI 接口
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法: node packager.js <plugin-dir> [options]');
    console.log('\n选项:');
    console.log('  --out-dir <dir>    指定输出目录');
    console.log('  --include-source   包含源代码');
    process.exit(1);
  }

  const pluginDir = args[0];
  const options = {
    includeSource: args.includes('--include-source')
  };

  const outDirIndex = args.indexOf('--out-dir');
  if (outDirIndex !== -1 && args[outDirIndex + 1]) {
    options.outDir = args[outDirIndex + 1];
  }

  const packager = new PluginPackager(pluginDir, options);
  await packager.package();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { PluginPackager };
