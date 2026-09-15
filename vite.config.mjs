import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 注意：本文件为 ESM（.mjs），Electron 主进程 electron/main.js 仍为 CommonJS。
export default defineConfig({
  plugins: [
    vue(),
    // shared/ 下的常量文件是 CJS（module.exports）写法供主进程 require；
    // Vite dev（unbundled）默认不会给项目内 CJS 加 export default 包装，浏览器直接拿到
    // 原始 module.exports 就会报 "does not provide an export named 'default'"。
    // 这里用最小 transform：把 `module.exports = X` 重写为 `const __cjs = X; export default __cjs`，
    // 只对 shared/ 下含 module.exports 的 .js 生效，不影响 build（build 由 commonjsOptions 处理）。
    {
      name: 'shared-cjs-to-esm',
      transform(code, id) {
        if (!id.includes('/shared/') || !id.endsWith('.js')) return
        if (!/module\.exports\s*=/.test(code)) return
        const rewritten =
          code.replace(/module\.exports\s*=/, 'const __cjs =') +
          '\nexport default __cjs'
        return { code: rewritten, map: null }
      }
    }
  ],
  // 打包后用相对路径，便于 Electron 以 file:// 加载 dist/index.html
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 根目录 shared/constants.js 为 CJS（主进程直接 require），渲染层经 @/config/constants 再导出；
    // 生产构建默认只转换 node_modules 的 CJS，需把 shared/ 也纳入，否则 named export 解析失败
    commonjsOptions: {
      include: [/node_modules/, /shared/]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
