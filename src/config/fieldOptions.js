// 表单 / 表格下拉选项集中定义（单一事实来源）
//
// 各业务页面需要的「枚举 -> 中文 label」下拉选项统一在这里维护，
// value 取自 shared/constants.js 的枚举常量，避免每个页面各自写死重复选项。
import {
  PROJECT_STATUS_ONGOING, PROJECT_STATUS_DONE, PROJECT_STATUS_PAUSED,
  PROJECT_TYPE_PROJECT, PROJECT_TYPE_SUBJECT,
  TASK_STATUS_TODO, TASK_STATUS_DOING, TASK_STATUS_DONE,
  TASK_PRIORITY_HIGH, TASK_PRIORITY_MEDIUM, TASK_PRIORITY_LOW,
  ACHIEVEMENT_TYPE_PAPER, ACHIEVEMENT_TYPE_PATENT, ACHIEVEMENT_TYPE_SOFTWARE,
  ACHIEVEMENT_TYPE_AWARD, ACHIEVEMENT_TYPE_COMPETITION, ACHIEVEMENT_TYPE_OTHER,
  PAPER_INDEX_SCI, PAPER_INDEX_EI, PAPER_INDEX_CORE, PAPER_INDEX_GENERAL,
  PATENT_TYPE_INVENTION, PATENT_TYPE_UTILITY, PATENT_TYPE_DESIGN, PATENT_TYPE_SOFTWARE,
  FUND_TYPE_INCOME, FUND_TYPE_EXPENSE,
  DEVICE_STATUS_NORMAL, DEVICE_STATUS_FAULT, DEVICE_STATUS_SCRAPPED,
  BORROW_STATUS_BORROWED, BORROW_STATUS_RETURNED,
  ATTENDANCE_STATUS_PRESENT, ATTENDANCE_STATUS_LATE, ATTENDANCE_STATUS_LEAVE, ATTENDANCE_STATUS_ABSENT,
  DUTY_TYPE_CLEAN, DUTY_TYPE_DUTY,
  JOIN_LEAVE_TYPE_JOIN, JOIN_LEAVE_TYPE_LEAVE,
  JOIN_LEAVE_STATUS_PENDING, JOIN_LEAVE_STATUS_APPROVED, JOIN_LEAVE_STATUS_REJECTED,
  RESOURCE_CATEGORY_DOC, RESOURCE_CATEGORY_DATASET, RESOURCE_CATEGORY_CODE,
  RESOURCE_CATEGORY_TOOL, RESOURCE_CATEGORY_TEMPLATE, RESOURCE_CATEGORY_DRIVE,
  MEETING_STATUS_SCHEDULED, MEETING_STATUS_DONE, MEETING_STATUS_CANCELLED,
  ACTIVITY_STATUS_OPEN, ACTIVITY_STATUS_CLOSED, ACTIVITY_STATUS_DONE,
  SIGNUP_STATUS_SIGNED, SIGNUP_STATUS_CANCELLED,
  FORUM_TYPE_POST, FORUM_TYPE_QA, FORUM_TYPE_SHARE,
  APPROVAL_STATUS_PENDING, APPROVAL_STATUS_APPROVED, APPROVAL_STATUS_REJECTED,
  TODO_STATUS_PENDING, TODO_STATUS_DONE,
  TODO_PRIORITY_HIGH, TODO_PRIORITY_MEDIUM, TODO_PRIORITY_LOW,
  SCHEDULE_TYPE_MEETING, SCHEDULE_TYPE_DEADLINE, SCHEDULE_TYPE_REMINDER, SCHEDULE_TYPE_OTHER,
  NOTICE_TYPE_NOTICE, NOTICE_TYPE_NEWS, NOTICE_TYPE_URGENT,
  NOTICE_STATUS_DRAFT, NOTICE_STATUS_PUBLISHED,
  MESSAGE_STATUS_UNREAD, MESSAGE_STATUS_READ,
  ACCOUNT_STATUS_ACTIVE, ACCOUNT_STATUS_DISABLED, ACCOUNT_STATUS_LEAVE,
  ROLE_ADMIN, ROLE_MENTOR, ROLE_STUDENT, ROLE_USER
} from './constants'

export const PROJECT_STATUS_OPTIONS = [
  { label: '进行中', value: PROJECT_STATUS_ONGOING },
  { label: '已结题', value: PROJECT_STATUS_DONE },
  { label: '已暂停', value: PROJECT_STATUS_PAUSED }
]

export const PROJECT_TYPE_OPTIONS = [
  { label: '科研项目', value: PROJECT_TYPE_PROJECT },
  { label: '课题申报', value: PROJECT_TYPE_SUBJECT }
]

export const TASK_STATUS_OPTIONS = [
  { label: '待办', value: TASK_STATUS_TODO },
  { label: '进行中', value: TASK_STATUS_DOING },
  { label: '已完成', value: TASK_STATUS_DONE }
]

export const PRIORITY_OPTIONS = [
  { label: '高', value: TASK_PRIORITY_HIGH },
  { label: '中', value: TASK_PRIORITY_MEDIUM },
  { label: '低', value: TASK_PRIORITY_LOW }
]

export const ACHIEVEMENT_TYPE_OPTIONS = [
  { label: '论文', value: ACHIEVEMENT_TYPE_PAPER },
  { label: '专利', value: ACHIEVEMENT_TYPE_PATENT },
  { label: '软著', value: ACHIEVEMENT_TYPE_SOFTWARE },
  { label: '获奖', value: ACHIEVEMENT_TYPE_AWARD },
  { label: '竞赛', value: ACHIEVEMENT_TYPE_COMPETITION },
  { label: '其他', value: ACHIEVEMENT_TYPE_OTHER }
]

export const PAPER_INDEX_OPTIONS = [
  { label: 'SCI', value: PAPER_INDEX_SCI },
  { label: 'EI', value: PAPER_INDEX_EI },
  { label: '核心期刊', value: PAPER_INDEX_CORE },
  { label: '普通期刊', value: PAPER_INDEX_GENERAL }
]

export const PATENT_TYPE_OPTIONS = [
  { label: '发明专利', value: PATENT_TYPE_INVENTION },
  { label: '实用新型', value: PATENT_TYPE_UTILITY },
  { label: '外观设计', value: PATENT_TYPE_DESIGN },
  { label: '软件著作权', value: PATENT_TYPE_SOFTWARE }
]

export const FUND_TYPE_OPTIONS = [
  { label: '收入', value: FUND_TYPE_INCOME },
  { label: '支出', value: FUND_TYPE_EXPENSE }
]

export const DEVICE_STATUS_OPTIONS = [
  { label: '正常', value: DEVICE_STATUS_NORMAL },
  { label: '故障', value: DEVICE_STATUS_FAULT },
  { label: '报废', value: DEVICE_STATUS_SCRAPPED }
]

export const BORROW_STATUS_OPTIONS = [
  { label: '借用中', value: BORROW_STATUS_BORROWED },
  { label: '已归还', value: BORROW_STATUS_RETURNED }
]

export const ATTENDANCE_STATUS_OPTIONS = [
  { label: '出勤', value: ATTENDANCE_STATUS_PRESENT },
  { label: '迟到', value: ATTENDANCE_STATUS_LATE },
  { label: '请假', value: ATTENDANCE_STATUS_LEAVE },
  { label: '缺勤', value: ATTENDANCE_STATUS_ABSENT }
]

export const DUTY_TYPE_OPTIONS = [
  { label: '卫生值日', value: DUTY_TYPE_CLEAN },
  { label: '值班', value: DUTY_TYPE_DUTY }
]

export const JOIN_LEAVE_TYPE_OPTIONS = [
  { label: '入组', value: JOIN_LEAVE_TYPE_JOIN },
  { label: '离组', value: JOIN_LEAVE_TYPE_LEAVE }
]

export const JOIN_LEAVE_STATUS_OPTIONS = [
  { label: '待审核', value: JOIN_LEAVE_STATUS_PENDING },
  { label: '已通过', value: JOIN_LEAVE_STATUS_APPROVED },
  { label: '已驳回', value: JOIN_LEAVE_STATUS_REJECTED }
]

export const RESOURCE_CATEGORY_OPTIONS = [
  { label: '文档库', value: RESOURCE_CATEGORY_DOC },
  { label: '数据集', value: RESOURCE_CATEGORY_DATASET },
  { label: '代码库', value: RESOURCE_CATEGORY_CODE },
  { label: '软件工具', value: RESOURCE_CATEGORY_TOOL },
  { label: '模板中心', value: RESOURCE_CATEGORY_TEMPLATE },
  { label: '共享网盘', value: RESOURCE_CATEGORY_DRIVE }
]

export const MEETING_STATUS_OPTIONS = [
  { label: '已排期', value: MEETING_STATUS_SCHEDULED },
  { label: '已召开', value: MEETING_STATUS_DONE },
  { label: '已取消', value: MEETING_STATUS_CANCELLED }
]

export const ACTIVITY_STATUS_OPTIONS = [
  { label: '报名中', value: ACTIVITY_STATUS_OPEN },
  { label: '报名截止', value: ACTIVITY_STATUS_CLOSED },
  { label: '已结束', value: ACTIVITY_STATUS_DONE }
]

export const SIGNUP_STATUS_OPTIONS = [
  { label: '已报名', value: SIGNUP_STATUS_SIGNED },
  { label: '已取消', value: SIGNUP_STATUS_CANCELLED }
]

export const FORUM_TYPE_OPTIONS = [
  { label: '帖子', value: FORUM_TYPE_POST },
  { label: '问答', value: FORUM_TYPE_QA },
  { label: '分享', value: FORUM_TYPE_SHARE }
]

export const APPROVAL_STATUS_OPTIONS = [
  { label: '待审批', value: APPROVAL_STATUS_PENDING },
  { label: '已通过', value: APPROVAL_STATUS_APPROVED },
  { label: '已驳回', value: APPROVAL_STATUS_REJECTED }
]

export const TODO_STATUS_OPTIONS = [
  { label: '未完成', value: TODO_STATUS_PENDING },
  { label: '已完成', value: TODO_STATUS_DONE }
]

export const SCHEDULE_TYPE_OPTIONS = [
  { label: '会议', value: SCHEDULE_TYPE_MEETING },
  { label: '截止', value: SCHEDULE_TYPE_DEADLINE },
  { label: '提醒', value: SCHEDULE_TYPE_REMINDER },
  { label: '其他', value: SCHEDULE_TYPE_OTHER }
]

export const NOTICE_TYPE_OPTIONS = [
  { label: '通知', value: NOTICE_TYPE_NOTICE },
  { label: '动态', value: NOTICE_TYPE_NEWS },
  { label: '紧急', value: NOTICE_TYPE_URGENT }
]

export const NOTICE_STATUS_OPTIONS = [
  { label: '草稿', value: NOTICE_STATUS_DRAFT },
  { label: '已发布', value: NOTICE_STATUS_PUBLISHED }
]

export const MESSAGE_STATUS_OPTIONS = [
  { label: '未读', value: MESSAGE_STATUS_UNREAD },
  { label: '已读', value: MESSAGE_STATUS_READ }
]

export const ACCOUNT_STATUS_OPTIONS = [
  { label: '正常', value: ACCOUNT_STATUS_ACTIVE },
  { label: '禁用', value: ACCOUNT_STATUS_DISABLED },
  { label: '离组', value: ACCOUNT_STATUS_LEAVE }
]

export const ROLE_OPTIONS = [
  { label: '管理员', value: ROLE_ADMIN },
  { label: '导师', value: ROLE_MENTOR },
  { label: '学生', value: ROLE_STUDENT },
]

export const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' }
]

export const DEGREE_TYPE_OPTIONS = [
  { label: '硕士', value: 'master' },
  { label: '博士', value: 'doctor' }
]
