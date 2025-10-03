/**
 * 符号扫描器 - 扫描源码生成可Hook点的映射
 * 运行: pnpm tsx pluginLoader/tools/symbolScanner.ts
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import type { SymbolMap, ComponentSymbol, StoreSymbol, ServiceSymbol } from '../types/api'

const SRC_DIR = join(process.cwd(), 'src')
const OUTPUT_FILE = join(process.cwd(), 'pluginLoader', 'tools', 'symbol-map.json')

/**
 * 扫描Vue组件
 */
async function scanComponents(_dir: string): Promise<ComponentSymbol[]> {
  const components: ComponentSymbol[] = []
  
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.name.endsWith('.vue')) {
        const content = await readFile(fullPath, 'utf-8')
        const relativePath = relative(SRC_DIR, fullPath)
        
        // 提取组件信息
        const componentName = entry.name.replace('.vue', '')
        
        // 提取props
        const propsMatch = content.match(/defineProps<\{([^}]+)\}>/s) || 
                          content.match(/defineProps\(\{([^}]+)\}\)/s)
        
        // 提取emits
        const emitsMatch = content.match(/defineEmits<\{([^}]+)\}>/s) ||
                          content.match(/defineEmits\(\[([^\]]+)\]\)/s)
        
        // 提取expose
        const exposeMatch = content.match(/defineExpose\(\{([^}]+)\}\)/s)
        
        components.push({
          name: componentName,
          path: relativePath,
          props: propsMatch ? extractNames(propsMatch[1]) : [],
          emits: emitsMatch ? extractEmitNames(emitsMatch[1]) : [],
          methods: exposeMatch ? extractNames(exposeMatch[1]) : extractMethods(content),
          computed: extractComputed(content)
        })
      }
    }
  }
  
  await scan(join(SRC_DIR, 'components'))
  return components
}

/**
 * 扫描Pinia Stores
 */
async function scanStores(_dir: string): Promise<StoreSymbol[]> {
  const stores: StoreSymbol[] = []
  
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.name.endsWith('.ts')) {
        const content = await readFile(fullPath, 'utf-8')
        const relativePath = relative(SRC_DIR, fullPath)
        
        // 检查是否是store定义
        if (content.includes('defineStore')) {
          const storeNameMatch = content.match(/defineStore\s*\(\s*['"]([^'"]+)['"]/s)
          if (storeNameMatch) {
            stores.push({
              name: storeNameMatch[1],
              path: relativePath,
              state: extractStateFields(content),
              getters: extractGetters(content),
              actions: extractActions(content)
            })
          }
        }
      }
    }
  }
  
  await scan(join(SRC_DIR, 'stores'))
  return stores
}

/**
 * 扫描服务函数
 */
async function scanServices(_dir: string): Promise<ServiceSymbol[]> {
  const services: ServiceSymbol[] = []
  
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        const content = await readFile(fullPath, 'utf-8')
        const relativePath = relative(SRC_DIR, fullPath)
        
        const functions = extractExportedFunctions(content)
        if (functions.length > 0) {
          services.push({
            name: entry.name.replace('.ts', ''),
            path: relativePath,
            functions
          })
        }
      }
    }
  }
  
  await scan(join(SRC_DIR, 'services'))
  return services
}

/**
 * 辅助函数：提取名称
 */
function extractNames(text: string): string[] {
  const names: string[] = []
  const matches = text.matchAll(/(\w+)\s*[?:]?\s*:/g)
  for (const match of matches) {
    names.push(match[1])
  }
  return names
}

/**
 * 提取emit事件名称
 */
function extractEmitNames(text: string): string[] {
  const names: string[] = []
  // 处理数组形式: ['event1', 'event2']
  const arrayMatches = text.matchAll(/['"](\w+)['"]/g)
  for (const match of arrayMatches) {
    names.push(match[1])
  }
  // 处理对象形式: { event1: ..., event2: ... }
  if (names.length === 0) {
    const objectMatches = text.matchAll(/(\w+)\s*[?:]?\s*:/g)
    for (const match of objectMatches) {
      names.push(match[1])
    }
  }
  return names
}

/**
 * 提取方法
 */
function extractMethods(content: string): string[] {
  const methods: string[] = []
  const matches = content.matchAll(/(?:function|const)\s+(\w+)\s*[=\(]/g)
  for (const match of matches) {
    methods.push(match[1])
  }
  return methods
}

/**
 * 提取computed
 */
function extractComputed(content: string): string[] {
  const computed: string[] = []
  const matches = content.matchAll(/const\s+(\w+)\s*=\s*computed\s*\(/g)
  for (const match of matches) {
    computed.push(match[1])
  }
  return computed
}

/**
 * 提取state字段
 */
function extractStateFields(content: string): string[] {
  const stateMatch = content.match(/state:\s*\(\)\s*=>\s*\(\{([^}]+)\}\)/s)
  if (!stateMatch) return []
  return extractNames(stateMatch[1])
}

/**
 * 提取getters
 */
function extractGetters(content: string): string[] {
  const gettersMatch = content.match(/getters:\s*\{([^}]+)\}/s)
  if (!gettersMatch) return []
  return extractNames(gettersMatch[1])
}

/**
 * 提取actions
 */
function extractActions(content: string): string[] {
  const actionsMatch = content.match(/actions:\s*\{([^}]+)\}/s)
  if (!actionsMatch) return []
  
  const actions: string[] = []
  const matches = actionsMatch[1].matchAll(/(?:async\s+)?(\w+)\s*\(/g)
  for (const match of matches) {
    actions.push(match[1])
  }
  return actions
}

/**
 * 提取导出的函数
 */
function extractExportedFunctions(content: string): string[] {
  const functions: string[] = []
  const matches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/g)
  for (const match of matches) {
    functions.push(match[1])
  }
  return functions
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 Scanning source code for hookable symbols...')
  
  try {
    const [components, stores, services] = await Promise.all([
      scanComponents(SRC_DIR),
      scanStores(SRC_DIR),
      scanServices(SRC_DIR)
    ])
    
    const symbolMap: SymbolMap = {
      components,
      stores,
      services,
      generatedAt: new Date().toISOString()
    }
    
    await writeFile(OUTPUT_FILE, JSON.stringify(symbolMap, null, 2), 'utf-8')
    
    console.log('✅ Symbol map generated successfully!')
    console.log(`📄 Output: ${OUTPUT_FILE}`)
    console.log(`📊 Found:`)
    console.log(`   - ${components.length} components`)
    console.log(`   - ${stores.length} stores`)
    console.log(`   - ${services.length} services`)
  } catch (error) {
    console.error('❌ Failed to generate symbol map:', error)
    process.exit(1)
  }
}

main()
