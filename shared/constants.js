/**
 * 前后端共享常量（单一事实来源）
 *
 * 采用 CommonJS（module.exports）写法：主进程（CJS / require）可直接引用；
 * 渲染层（Vite / ESM）通过 esbuild 的 CJS 互操作也能 `import` 具名导出。
 *
 * 注意：本文件只放「两端都可能用到的纯常量」，不含任何 Node / 浏览器专属 API。
 *
 * 角色体系：
 *   四类角色 —— super_admin 超级管理员（平台运维）/ group_admin 课题组管理员 / mentor 导师 / student 学生。
 *   旧的 admin / mentor / student 三级角色体系已废弃，菜单与权限全部按新角色重排。
 *   业务枚举（课题状态、组会类型、成果类型等）待数据库字段设计时按模块补充。
 */
module.exports = {
  // ===== 权限角色（四类） =====
  ROLE_SUPER_ADMIN: 'super_admin', // 超级管理员（平台运维，不参与课题组内业务）
  ROLE_GROUP_ADMIN: 'group_admin', // 课题组管理员（课题组最高管理角色）
  ROLE_MENTOR: 'mentor',           // 导师（管理分配给自己的学生）
  ROLE_STUDENT: 'student',         // 学生（在读研究生）

  // ===== 账号状态 =====
  ACCOUNT_STATUS_ACTIVE: 'active',
  ACCOUNT_STATUS_DISABLED: 'disabled',
  ACCOUNT_STATUS_LEAVE: 'leave',

  // ===== 角色默认密码（单一事实来源）=====
  // 新增用户 / 重置密码统一使用；首次登录强制修改密码（must_change_password=1）
  DEFAULT_PASSWORD_BY_ROLE: {
    super_admin: 'admin123456', // 超级管理员
    group_admin: 'ga123456@',   // 课题组管理员
    mentor: 'ds123456@',        // 导师
    student: 'xs123456@'        // 学生
  },
  // 新增 / 重置用户时生成的随机密码位数（6 位纯数字；当前已被角色默认密码取代，仅保留兼容）
  DEFAULT_PASSWORD_LENGTH: 6,

  // bcrypt 哈希成本（越大越慢越安全）
  BCRYPT_ROUNDS: 10,
  // MySQL 默认端口
  DEFAULT_DB_PORT: 3306,
  // 连接池上限
  CONNECTION_LIMIT: 10
}
