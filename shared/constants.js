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
 *   账号状态统一为 TINYINT：1 启用 / 0 禁用。
 */
module.exports = {
  // ===== 权限角色（四类） =====
  ROLE_SUPER_ADMIN: 'super_admin', // 超级管理员（平台运维）
  ROLE_GROUP_ADMIN: 'group_admin', // 课题组管理员（课题组最高管理角色）
  ROLE_MENTOR: 'mentor',           // 导师（管理分配给自己的学生）
  ROLE_STUDENT: 'student',         // 学生

  // ===== 账号状态（TINYINT） =====
  ACCOUNT_STATUS_ENABLED: 1,   // 启用
  ACCOUNT_STATUS_DISABLED: 0,  // 禁用

  // ===== 任务状态（TINYINT，与 schemas/13_task.sql 一致） =====
  TASK_STATUS_TODO: 1,        // 待办
  TASK_STATUS_DOING: 2,       // 进行中
  TASK_STATUS_REVIEW: 3,      // 待验收
  TASK_STATUS_DONE: 4,        // 已完成
  TASK_STATUS_CANCELED: 5,    // 已取消

  // ===== 任务优先级（TINYINT，与 schemas/13_task.sql 一致） =====
  TASK_PRIORITY_LOW: 1,       // 低
  TASK_PRIORITY_MEDIUM: 2,    // 中
  TASK_PRIORITY_HIGH: 3,      // 高
  TASK_PRIORITY_URGENT: 4,     // 紧急

  // ===== 笔记类别（学生私人笔记，与 schemas/18_note.sql 一致） =====
  // value 入库，label 为前端显示名；默认类别 other
  NOTE_CATEGORIES: [
    { value: 'experiment', label: '实验记录' },
    { value: 'literature', label: '文献笔记' },
    { value: 'meeting', label: '组会笔记' },
    { value: 'idea', label: '研究想法' },
    { value: 'failure', label: '失败记录' },
    { value: 'weekly', label: '周报素材' },
    { value: 'project', label: '项目笔记' },
    { value: 'other', label: '其他' }
  ],

  // ===== 角色默认密码（单一事实来源） =====
  // 新增用户 / 管理员重置密码统一使用；首次登录强制修改密码（must_change_password=1）
  // 所有默认密码均满足强度规则（长度≥6 且包含大小写字母）
  DEFAULT_PASSWORD_BY_ROLE: {
    super_admin: 'SuperAdmin123', // 超级管理员（仅系统初始化写入）
    group_admin: 'GroupAdmin123', // 课题组管理员
    mentor: 'Mentor123',          // 导师
    student: 'Student123'         // 学生
  },

  // ===== 密码强度规则 =====
  PASSWORD_MIN_LENGTH: 6, // 密码最短长度

  // bcrypt 哈希成本（越大越慢越安全）
  BCRYPT_ROUNDS: 10,
  // MySQL 默认端口
  DEFAULT_DB_PORT: 3306,
  // 连接池上限
  CONNECTION_LIMIT: 10
}
