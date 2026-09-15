// 前后端共享常量（渲染层薄壳）
//
// 真实定义在根目录 shared/constants.js（单一事实来源，主进程直接 require）；
// 这里只做再导出，不重复定义任何值，让渲染层拥有友好的相对导入路径（@/config/constants）。
//
// 关键：用 default import 取出 CJS module.exports，再具名导出。
// 不要写 `export { ROLE_ADMIN } from '...cjs'` —— esbuild 在 dev（unbundled）
// 单独转换 CJS 文件时只会合成 `export default`，不会合成具名导出，会报
// "does not provide an export named 'ROLE_ADMIN'"。default import 是跨
// dev / build / bundle 都稳定工作的 CJS 互操作写法。
import sharedConstants from '../../shared/constants.js'

export const ROLE_ADMIN = sharedConstants.ROLE_ADMIN
