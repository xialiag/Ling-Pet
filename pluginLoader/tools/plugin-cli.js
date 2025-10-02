#!/usr/bin/env node

/**
 * 插件开发 CLI 工具
 * 提供命令行界面来管理插件开发
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const commands = {
  // 创建新插件
  create: (name) => {
    if (!name) {
      console.error('❌ 请提供插件名称');
      console.log('用法: plugin-cli create <plugin-name>');
      process.exit(1);
    }

    const pluginDir = path.join(__dirname, '../plugins', name);
    
    if (fs.existsSync(pluginDir)) {
      console.error(`❌ 插件目录已存在: ${pluginDir}`);
      process.exit(1);
    }

    console.log(`📦 创建插件: ${name}`);
    fs.mkdirSync(pluginDir, { recursive: true });

    // 生成 manifest.json
    const manifest = {
      id: `com.lingpet.${name}`,
      name: name,
      version: '1.0.0',
      description: '插件描述',
      author: 'Your Name',
      entry: 'index.js',
      icon: 'icon.png',
      permissions: ['hook:component'],
      dependencies: {},
      backend: { enabled: false },
      config: {}
    };

    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // 生成 index.ts
    const indexContent = `import { definePlugin } from '../../core/pluginApi'
import type { PluginContext } from '../../types/api'

export default definePlugin({
  name: '${name}',
  version: '1.0.0',
  
  async onLoad(context: PluginContext) {
    context.debug('${name} 已加载')
  },
  
  async onUnload(context: PluginContext) {
    context.debug('${name} 已卸载')
  }
})
`;

    fs.writeFileSync(path.join(pluginDir, 'index.ts'), indexContent);

    // 生成 README.md
    const readme = `# ${name}

## 功能

描述你的插件功能

## 开发

\`\`\`bash
npm run build
\`\`\`
`;

    fs.writeFileSync(path.join(pluginDir, 'README.md'), readme);

    // 创建占位图标
    fs.writeFileSync(path.join(pluginDir, 'icon.txt'), name.toUpperCase());

    console.log('✅ 插件创建成功！');
    console.log('\n下一步:');
    console.log(`1. 编辑 plugins/${name}/index.ts`);
    console.log('2. npm run build');
  },

  // 构建插件
  build: (name) => {
    console.log('🔨 构建插件...');
    
    const pluginsDir = path.join(__dirname, '../plugins');
    process.chdir(pluginsDir);
    
    if (name) {
      execSync(`node build-with-esbuild.js ${name}`, { stdio: 'inherit' });
    } else {
      execSync('node build-with-esbuild.js', { stdio: 'inherit' });
    }
  },

  // 验证插件
  validate: (name) => {
    if (!name) {
      console.error('❌ 请提供插件名称');
      console.log('用法: plugin-cli validate <plugin-name>');
      process.exit(1);
    }

    const pluginDir = path.join(__dirname, '../plugins', name);
    
    if (!fs.existsSync(pluginDir)) {
      console.error(`❌ 插件不存在: ${name}`);
      process.exit(1);
    }

    console.log(`🔍 验证插件: ${name}\n`);

    const errors = [];
    const warnings = [];

    // 检查 manifest.json
    const manifestPath = path.join(pluginDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      errors.push('缺少 manifest.json');
    } else {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        
        if (!manifest.id) errors.push('manifest.json 缺少 id');
        if (!manifest.name) errors.push('manifest.json 缺少 name');
        if (!manifest.version) errors.push('manifest.json 缺少 version');
        if (!manifest.entry) errors.push('manifest.json 缺少 entry');
        
        // 检查入口文件
        const entryPath = path.join(pluginDir, manifest.entry);
        if (!fs.existsSync(entryPath)) {
          errors.push(`入口文件不存在: ${manifest.entry}`);
        } else {
          const content = fs.readFileSync(entryPath, 'utf-8');
          // 检查是否有外部导入
          const importRegex = /import .* from ['"](?!\.)[^'"]+['"]/g;
          const externalImports = content.match(importRegex);
          if (externalImports) {
            errors.push(`发现外部依赖: ${externalImports.join(', ')}`);
          }
        }
        
        if (!manifest.permissions || manifest.permissions.length === 0) {
          warnings.push('未声明权限');
        }
      } catch (error) {
        errors.push(`manifest.json 格式错误: ${error.message}`);
      }
    }

    // 输出结果
    if (errors.length > 0) {
      console.log('❌ 错误:');
      errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  警告:');
      warnings.forEach(warn => console.log(`  - ${warn}`));
    }
    
    if (errors.length === 0) {
      console.log('\n✅ 验证通过');
    } else {
      console.log('\n❌ 验证失败');
      process.exit(1);
    }
  },

  // 列出所有插件
  list: () => {
    const pluginsDir = path.join(__dirname, '../plugins');
    const items = fs.readdirSync(pluginsDir);
    
    console.log('📦 已安装的插件:\n');
    
    items.forEach(item => {
      const itemPath = path.join(pluginsDir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        const manifestPath = path.join(itemPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            console.log(`  ${manifest.name} (${manifest.version})`);
            console.log(`    ID: ${manifest.id}`);
            console.log(`    描述: ${manifest.description || '无'}\n`);
          } catch {
            console.log(`  ${item} (无效的 manifest.json)\n`);
          }
        }
      }
    });
  },

  // 测试加载器
  test: () => {
    console.log('🧪 测试插件加载器...\n');
    execSync('npx tsx tools/test-loader.ts', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  },

  // 帮助信息
  help: () => {
    console.log('插件开发 CLI 工具\n');
    console.log('用法: plugin-cli <command> [options]\n');
    console.log('命令:');
    console.log('  create <name>      创建新插件');
    console.log('  build [name]       构建插件（不指定名称则构建所有）');
    console.log('  validate <name>    验证插件');
    console.log('  list               列出所有插件');
    console.log('  test               测试插件加载器');
    console.log('  help               显示帮助信息');
  }
};

// 解析命令
const command = process.argv[2];
const arg = process.argv[3];

if (!command || command === 'help') {
  commands.help();
} else if (commands[command]) {
  commands[command](arg);
} else {
  console.error(`❌ 未知命令: ${command}`);
  commands.help();
  process.exit(1);
}
