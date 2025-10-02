import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const host = process.env.TAURI_DEV_HOST;

// Custom plugin to copy public files excluding live2d directory during build
function customPublicPlugin() {
  return {
    name: 'custom-public',
    apply: 'build', // Only apply during build, not dev
    generateBundle() {
      const publicDir = resolve('public');
      const outDir = resolve('dist');
      
      if (!existsSync(publicDir)) return;
      
      const copyDir = (src: string, dest: string) => {
        if (!existsSync(dest)) {
          mkdirSync(dest, { recursive: true });
        }
        
        const entries = readdirSync(src);
        
        for (const entry of entries) {
          // Skip live2d directory during build
          if (entry === 'live2d') continue;
          
          const srcPath = join(src, entry);
          const destPath = join(dest, entry);
          
          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        }
      };
      
      copyDir(publicDir, outDir);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue(), customPublicPlugin()],
  
  // Use default public directory for dev, but our custom plugin will handle build
  publicDir: 'public',

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  
  build: {
    // Disable default public directory copying during build since we handle it with our plugin
    copyPublicDir: false
  }
}));
