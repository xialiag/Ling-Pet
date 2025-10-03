const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 插件构建工具
 */
async function buildPlugin(pluginName) {
  const pluginDir = path.join(__dirname, '..', 'plugins', pluginName);
  const outputDir = path.join(__dirname, '..', '..', 'dist', 'plugins', pluginName);
  
  console.log(`\n=== Building plugin: ${pluginName} ===`);
  console.log(`Source: ${pluginDir}`);
  console.log(`Output: ${outputDir}`);
  
  if (!fs.existsSync(pluginDir)) {
    console.error(`Error: Plugin directory not found: ${pluginDir}`);
    return false;
  }

  try {
    // 1. 清理输出目录
    if (fs.existsSync(outputDir)) {
      fs.removeSync(outputDir);
    }
    fs.ensureDirSync(outputDir);

    // 2. 编译TypeScript
    const indexTsPath = path.join(pluginDir, 'index.ts');
    if (fs.existsSync(indexTsPath)) {
      console.log('Compiling TypeScript...');
      try {
        // 使用 esbuild 编译 TypeScript
        execSync(`npx esbuild ${indexTsPath} --bundle --platform=node --format=esm --outfile=${path.join(outputDir, 'index.js')} --sourcemap`, { 
          cwd: pluginDir,
          stdio: 'inherit'
        });
      } catch (error) {
        console.warn('TypeScript compilation failed, continuing...');
      }
    }

    // 3. 编译Rust后端（如果存在）
    const backendDir = path.join(pluginDir, 'backend');
    if (fs.existsSync(backendDir) && fs.existsSync(path.join(backendDir, 'Cargo.toml'))) {
      console.log('Building Rust backend...');
      try {
        execSync('cargo build --release', { 
          cwd: backendDir,
          stdio: 'inherit'
        });
        
        // 复制编译后的库
        const targetDir = path.join(backendDir, 'target', 'release');
        const platform = process.platform;
        
        let libName, outputName;
        if (platform === 'win32') {
          libName = 'plugin.dll';
          outputName = 'plugin.dll';
        } else if (platform === 'darwin') {
          libName = 'libplugin.dylib';
          outputName = 'libplugin.dylib';
        } else {
          libName = 'libplugin.so';
          outputName = 'libplugin.so';
        }
        
        const sourcePath = path.join(targetDir, libName);
        const destPath = path.join(outputDir, 'backend', outputName);
        
        if (fs.existsSync(sourcePath)) {
          fs.ensureDirSync(path.dirname(destPath));
          fs.copySync(sourcePath, destPath);
          console.log(`Copied backend: ${outputName}`);
        } else {
          console.warn(`Backend library not found: ${sourcePath}`);
        }
      } catch (error) {
        console.error('Rust backend build failed:', error.message);
      }
    }

    // 4. 复制必要文件
    console.log('Copying plugin files...');
    
    const filesToCopy = [
      'package.json',
      'index.js',
      'register.js',
      'README.md'
    ];
    
    filesToCopy.forEach(file => {
      const sourcePath = path.join(pluginDir, file);
      if (fs.existsSync(sourcePath)) {
        fs.copySync(sourcePath, path.join(outputDir, file));
      }
    });

    // 5. 生成 manifest.json（从 package.json 转换）
    const packageJsonPath = path.join(pluginDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      console.log('Generating manifest.json...');
      const packageJson = fs.readJsonSync(packageJsonPath);
      
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
      
      fs.writeJsonSync(path.join(outputDir, 'manifest.json'), manifest, { spaces: 2 });
      console.log('Generated manifest.json');
    }

    // 复制assets目录
    const assetsDir = path.join(pluginDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      fs.copySync(assetsDir, path.join(outputDir, 'assets'));
      console.log('Copied assets directory');
    }

    // 复制components目录（如果是编译后的）
    const componentsDir = path.join(pluginDir, 'components');
    if (fs.existsSync(componentsDir)) {
      fs.copySync(componentsDir, path.join(outputDir, 'components'), {
        filter: (src) => !src.endsWith('.ts') || src.endsWith('.d.ts')
      });
    }

    // 复制utils目录
    const utilsDir = path.join(pluginDir, 'utils');
    if (fs.existsSync(utilsDir)) {
      fs.copySync(utilsDir, path.join(outputDir, 'utils'), {
        filter: (src) => !src.endsWith('.ts') || src.endsWith('.d.ts')
      });
    }

    console.log(`✓ Plugin ${pluginName} built successfully!\n`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to build plugin ${pluginName}:`, error);
    return false;
  }
}

async function buildAllPlugins() {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  
  if (!fs.existsSync(pluginsDir)) {
    console.error('Plugins directory not found');
    return;
  }

  const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${plugins.length} plugins to build`);

  let successCount = 0;
  let failCount = 0;

  for (const plugin of plugins) {
    const success = await buildPlugin(plugin);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n=== Build Summary ===');
  console.log(`Total: ${plugins.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  buildAllPlugins().catch(console.error);
} else {
  const pluginName = args[0];
  buildPlugin(pluginName).catch(console.error);
}
