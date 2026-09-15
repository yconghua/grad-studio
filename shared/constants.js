/**
 * 前后端共享常量（单一事实来源）
 *
 * 采用 CommonJS（module.exports）写法：主进程（CJS / require）可直接引用；
 * 渲染层（Vite / ESM）通过 esbuild 的 CJS 互操作也能 `import` 具名导出。
 * 这样 ROLE_ADMIN 等魔法值从两端各自维护收敛为一处声明，消除不一致风险。
 *
 * 注意：本文件只放「两端都可能用到的纯常量」，不含任何 Node / 浏览器专属 API。
 */
module.exports = {
  // 权限角色（两级）：admin 管理员 / user 普通用户
  ROLE_ADMIN: 'admin',
  ROLE_USER: 'user',

  // 新增 / 重置用户时生成的随机密码位数（6 位纯数字）
  DEFAULT_PASSWORD_LENGTH: 6,

  // bcrypt 哈希成本（越大越慢越安全）
  BCRYPT_ROUNDS: 10,

  // MySQL 默认端口
  DEFAULT_DB_PORT: 3306,

  // 连接池上限
  CONNECTION_LIMIT: 10
}
