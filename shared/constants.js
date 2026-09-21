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
  // ===== 权限角色（三级） =====
  ROLE_ADMIN: 'admin',
  ROLE_MENTOR: 'mentor',
  ROLE_STUDENT: 'student',
  // 普通用户（兼容历史数据；权限与导航按「学生」处理）
  ROLE_USER: 'user',

  // ===== 账号状态 =====
  ACCOUNT_STATUS_ACTIVE: 'active',
  ACCOUNT_STATUS_DISABLED: 'disabled',
  ACCOUNT_STATUS_LEAVE: 'leave',

  // 新增 / 重置用户时生成的随机密码位数（6 位纯数字）
  DEFAULT_PASSWORD_LENGTH: 6,
  // bcrypt 哈希成本（越大越慢越安全）
  BCRYPT_ROUNDS: 10,
  // MySQL 默认端口
  DEFAULT_DB_PORT: 3306,
  // 连接池上限
  CONNECTION_LIMIT: 10,

  // ===== 项目（科研管理）=====
  PROJECT_STATUS_ONGOING: 'ongoing', // 进行中
  PROJECT_STATUS_DONE: 'done', // 已结题
  PROJECT_STATUS_PAUSED: 'paused', // 已暂停
  PROJECT_TYPE_PROJECT: 'project', // 科研项目
  PROJECT_TYPE_SUBJECT: 'subject', // 课题申报

  // ===== 任务 =====
  TASK_STATUS_TODO: 'todo', // 待办
  TASK_STATUS_DOING: 'doing', // 进行中
  TASK_STATUS_DONE: 'done', // 已完成
  TASK_PRIORITY_HIGH: 'high', // 高
  TASK_PRIORITY_MEDIUM: 'medium', // 中
  TASK_PRIORITY_LOW: 'low', // 低

  // ===== 成果类型 =====
  ACHIEVEMENT_TYPE_PAPER: 'paper', // 论文
  ACHIEVEMENT_TYPE_PATENT: 'patent', // 专利
  ACHIEVEMENT_TYPE_SOFTWARE: 'software', // 软著
  ACHIEVEMENT_TYPE_AWARD: 'award', // 获奖
  ACHIEVEMENT_TYPE_COMPETITION: 'competition', // 竞赛
  ACHIEVEMENT_TYPE_OTHER: 'other', // 其他

  // ===== 论文收录 =====
  PAPER_INDEX_SCI: 'sci', // SCI
  PAPER_INDEX_EI: 'ei', // EI
  PAPER_INDEX_CORE: 'core', // 核心期刊
  PAPER_INDEX_GENERAL: 'general', // 普通期刊

  // ===== 专利类型 =====
  PATENT_TYPE_INVENTION: 'invention', // 发明专利
  PATENT_TYPE_UTILITY: 'utility', // 实用新型
  PATENT_TYPE_DESIGN: 'design', // 外观设计
  PATENT_TYPE_SOFTWARE: 'software', // 软件著作权

  // ===== 经费 =====
  FUND_TYPE_INCOME: 'income', // 收入 / 到账
  FUND_TYPE_EXPENSE: 'expense', // 支出 / 报销

  // ===== 设备 / 借用 =====
  DEVICE_STATUS_NORMAL: 'normal', // 正常
  DEVICE_STATUS_FAULT: 'fault', // 故障
  DEVICE_STATUS_SCRAPPED: 'scrapped', // 报废
  BORROW_STATUS_BORROWED: 'borrowed', // 借用中
  BORROW_STATUS_RETURNED: 'returned', // 已归还

  // ===== 考勤 =====
  ATTENDANCE_STATUS_PRESENT: 'present', // 出勤
  ATTENDANCE_STATUS_LATE: 'late', // 迟到
  ATTENDANCE_STATUS_LEAVE: 'leave', // 请假
  ATTENDANCE_STATUS_ABSENT: 'absent', // 缺勤

  // ===== 排班 =====
  DUTY_TYPE_CLEAN: 'clean', // 卫生值日
  DUTY_TYPE_DUTY: 'duty', // 值班

  // ===== 入组离组 =====
  JOIN_LEAVE_TYPE_JOIN: 'join', // 入组
  JOIN_LEAVE_TYPE_LEAVE: 'leave', // 离组
  JOIN_LEAVE_STATUS_PENDING: 'pending', // 待审核
  JOIN_LEAVE_STATUS_APPROVED: 'approved', // 已通过
  JOIN_LEAVE_STATUS_REJECTED: 'rejected', // 已驳回

  // ===== 资源分类（资源中心，一张 resource 表按分类复用）=====
  RESOURCE_CATEGORY_DOC: 'doc', // 文档库
  RESOURCE_CATEGORY_DATASET: 'dataset', // 数据集
  RESOURCE_CATEGORY_CODE: 'code', // 代码库
  RESOURCE_CATEGORY_TOOL: 'tool', // 软件工具
  RESOURCE_CATEGORY_TEMPLATE: 'template', // 模板中心
  RESOURCE_CATEGORY_DRIVE: 'drive', // 共享网盘

  // ===== 组会 =====
  MEETING_STATUS_SCHEDULED: 'scheduled', // 已排期
  MEETING_STATUS_DONE: 'done', // 已召开
  MEETING_STATUS_CANCELLED: 'cancelled', // 已取消

  // ===== 活动 / 报名 =====
  ACTIVITY_STATUS_OPEN: 'open', // 报名中
  ACTIVITY_STATUS_CLOSED: 'closed', // 报名截止
  ACTIVITY_STATUS_DONE: 'done', // 已结束
  SIGNUP_STATUS_SIGNED: 'signed', // 已报名
  SIGNUP_STATUS_CANCELLED: 'cancelled', // 已取消

  // ===== 讨论区 =====
  FORUM_TYPE_POST: 'post', // 帖子
  FORUM_TYPE_QA: 'qa', // 问答
  FORUM_TYPE_SHARE: 'share', // 分享

  // ===== 审批 =====
  APPROVAL_STATUS_PENDING: 'pending', // 待审批
  APPROVAL_STATUS_APPROVED: 'approved', // 已通过
  APPROVAL_STATUS_REJECTED: 'rejected', // 已驳回

  // ===== 待办 =====
  TODO_STATUS_PENDING: 'pending', // 未完成
  TODO_STATUS_DONE: 'done', // 已完成
  TODO_PRIORITY_HIGH: 'high',
  TODO_PRIORITY_MEDIUM: 'medium',
  TODO_PRIORITY_LOW: 'low',

  // ===== 日程 =====
  SCHEDULE_TYPE_MEETING: 'meeting', // 会议
  SCHEDULE_TYPE_DEADLINE: 'deadline', // 截止
  SCHEDULE_TYPE_REMINDER: 'reminder', // 提醒
  SCHEDULE_TYPE_OTHER: 'other', // 其他

  // ===== 公告 =====
  NOTICE_TYPE_NOTICE: 'notice', // 通知
  NOTICE_TYPE_NEWS: 'news', // 动态
  NOTICE_TYPE_URGENT: 'urgent', // 紧急
  NOTICE_STATUS_DRAFT: 'draft', // 草稿
  NOTICE_STATUS_PUBLISHED: 'published', // 已发布

  // ===== 消息 =====
  MESSAGE_STATUS_UNREAD: 'unread', // 未读
  MESSAGE_STATUS_READ: 'read', // 已读

  // ===== 操作日志动作 =====
  LOG_ACTION_CREATE: 'create',
  LOG_ACTION_UPDATE: 'update',
  LOG_ACTION_DELETE: 'delete',
  LOG_ACTION_LOGIN: 'login',
  LOG_ACTION_LOGOUT: 'logout',

  // ===== 周报 =====
  WEEKLY_REPORT_STATUS_DRAFT: 'draft',
  WEEKLY_REPORT_STATUS_SUBMITTED: 'submitted',
  WEEKLY_REPORT_STATUS_REVIEWED: 'reviewed',
  WEEKLY_REPORT_STATUS_ARCHIVED: 'archived',

  // ===== 任务看板 =====
  TASK_STATUS_DELAYED: 'delayed',

  // ===== 毕业里程碑 =====
  MILESTONE_OPENING: 'opening',
  MILESTONE_MIDTERM: 'midterm',
  MILESTONE_PRE_DEFENSE: 'pre_defense',
  MILESTONE_BLIND_REVIEW: 'blind_review',
  MILESTONE_DEFENSE: 'defense',
  MILESTONE_STATUS_PENDING: 'pending',
  MILESTONE_STATUS_IN_PROGRESS: 'in_progress',
  MILESTONE_STATUS_DONE: 'done',
  MILESTONE_STATUS_DELAYED: 'delayed'
}
