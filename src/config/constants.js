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
export const ROLE_MENTOR = sharedConstants.ROLE_MENTOR
export const ROLE_STUDENT = sharedConstants.ROLE_STUDENT
export const ROLE_USER = sharedConstants.ROLE_USER

export const ACCOUNT_STATUS_ACTIVE = sharedConstants.ACCOUNT_STATUS_ACTIVE
export const ACCOUNT_STATUS_DISABLED = sharedConstants.ACCOUNT_STATUS_DISABLED
export const ACCOUNT_STATUS_LEAVE = sharedConstants.ACCOUNT_STATUS_LEAVE

export const PROJECT_STATUS_ONGOING = sharedConstants.PROJECT_STATUS_ONGOING
export const PROJECT_STATUS_DONE = sharedConstants.PROJECT_STATUS_DONE
export const PROJECT_STATUS_PAUSED = sharedConstants.PROJECT_STATUS_PAUSED
export const PROJECT_TYPE_PROJECT = sharedConstants.PROJECT_TYPE_PROJECT
export const PROJECT_TYPE_SUBJECT = sharedConstants.PROJECT_TYPE_SUBJECT

export const TASK_STATUS_TODO = sharedConstants.TASK_STATUS_TODO
export const TASK_STATUS_DOING = sharedConstants.TASK_STATUS_DOING
export const TASK_STATUS_DONE = sharedConstants.TASK_STATUS_DONE
export const TASK_PRIORITY_HIGH = sharedConstants.TASK_PRIORITY_HIGH
export const TASK_PRIORITY_MEDIUM = sharedConstants.TASK_PRIORITY_MEDIUM
export const TASK_PRIORITY_LOW = sharedConstants.TASK_PRIORITY_LOW

export const ACHIEVEMENT_TYPE_PAPER = sharedConstants.ACHIEVEMENT_TYPE_PAPER
export const ACHIEVEMENT_TYPE_PATENT = sharedConstants.ACHIEVEMENT_TYPE_PATENT
export const ACHIEVEMENT_TYPE_SOFTWARE = sharedConstants.ACHIEVEMENT_TYPE_SOFTWARE
export const ACHIEVEMENT_TYPE_AWARD = sharedConstants.ACHIEVEMENT_TYPE_AWARD
export const ACHIEVEMENT_TYPE_COMPETITION = sharedConstants.ACHIEVEMENT_TYPE_COMPETITION
export const ACHIEVEMENT_TYPE_OTHER = sharedConstants.ACHIEVEMENT_TYPE_OTHER

export const PAPER_INDEX_SCI = sharedConstants.PAPER_INDEX_SCI
export const PAPER_INDEX_EI = sharedConstants.PAPER_INDEX_EI
export const PAPER_INDEX_CORE = sharedConstants.PAPER_INDEX_CORE
export const PAPER_INDEX_GENERAL = sharedConstants.PAPER_INDEX_GENERAL

export const PATENT_TYPE_INVENTION = sharedConstants.PATENT_TYPE_INVENTION
export const PATENT_TYPE_UTILITY = sharedConstants.PATENT_TYPE_UTILITY
export const PATENT_TYPE_DESIGN = sharedConstants.PATENT_TYPE_DESIGN
export const PATENT_TYPE_SOFTWARE = sharedConstants.PATENT_TYPE_SOFTWARE

export const FUND_TYPE_INCOME = sharedConstants.FUND_TYPE_INCOME
export const FUND_TYPE_EXPENSE = sharedConstants.FUND_TYPE_EXPENSE

export const DEVICE_STATUS_NORMAL = sharedConstants.DEVICE_STATUS_NORMAL
export const DEVICE_STATUS_FAULT = sharedConstants.DEVICE_STATUS_FAULT
export const DEVICE_STATUS_SCRAPPED = sharedConstants.DEVICE_STATUS_SCRAPPED
export const BORROW_STATUS_BORROWED = sharedConstants.BORROW_STATUS_BORROWED
export const BORROW_STATUS_RETURNED = sharedConstants.BORROW_STATUS_RETURNED

export const ATTENDANCE_STATUS_PRESENT = sharedConstants.ATTENDANCE_STATUS_PRESENT
export const ATTENDANCE_STATUS_LATE = sharedConstants.ATTENDANCE_STATUS_LATE
export const ATTENDANCE_STATUS_LEAVE = sharedConstants.ATTENDANCE_STATUS_LEAVE
export const ATTENDANCE_STATUS_ABSENT = sharedConstants.ATTENDANCE_STATUS_ABSENT

export const DUTY_TYPE_CLEAN = sharedConstants.DUTY_TYPE_CLEAN
export const DUTY_TYPE_DUTY = sharedConstants.DUTY_TYPE_DUTY

export const JOIN_LEAVE_TYPE_JOIN = sharedConstants.JOIN_LEAVE_TYPE_JOIN
export const JOIN_LEAVE_TYPE_LEAVE = sharedConstants.JOIN_LEAVE_TYPE_LEAVE
export const JOIN_LEAVE_STATUS_PENDING = sharedConstants.JOIN_LEAVE_STATUS_PENDING
export const JOIN_LEAVE_STATUS_APPROVED = sharedConstants.JOIN_LEAVE_STATUS_APPROVED
export const JOIN_LEAVE_STATUS_REJECTED = sharedConstants.JOIN_LEAVE_STATUS_REJECTED

export const RESOURCE_CATEGORY_DOC = sharedConstants.RESOURCE_CATEGORY_DOC
export const RESOURCE_CATEGORY_DATASET = sharedConstants.RESOURCE_CATEGORY_DATASET
export const RESOURCE_CATEGORY_CODE = sharedConstants.RESOURCE_CATEGORY_CODE
export const RESOURCE_CATEGORY_TOOL = sharedConstants.RESOURCE_CATEGORY_TOOL
export const RESOURCE_CATEGORY_TEMPLATE = sharedConstants.RESOURCE_CATEGORY_TEMPLATE
export const RESOURCE_CATEGORY_DRIVE = sharedConstants.RESOURCE_CATEGORY_DRIVE

export const MEETING_STATUS_SCHEDULED = sharedConstants.MEETING_STATUS_SCHEDULED
export const MEETING_STATUS_DONE = sharedConstants.MEETING_STATUS_DONE
export const MEETING_STATUS_CANCELLED = sharedConstants.MEETING_STATUS_CANCELLED

export const ACTIVITY_STATUS_OPEN = sharedConstants.ACTIVITY_STATUS_OPEN
export const ACTIVITY_STATUS_CLOSED = sharedConstants.ACTIVITY_STATUS_CLOSED
export const ACTIVITY_STATUS_DONE = sharedConstants.ACTIVITY_STATUS_DONE
export const SIGNUP_STATUS_SIGNED = sharedConstants.SIGNUP_STATUS_SIGNED
export const SIGNUP_STATUS_CANCELLED = sharedConstants.SIGNUP_STATUS_CANCELLED

export const FORUM_TYPE_POST = sharedConstants.FORUM_TYPE_POST
export const FORUM_TYPE_QA = sharedConstants.FORUM_TYPE_QA
export const FORUM_TYPE_SHARE = sharedConstants.FORUM_TYPE_SHARE

export const APPROVAL_STATUS_PENDING = sharedConstants.APPROVAL_STATUS_PENDING
export const APPROVAL_STATUS_APPROVED = sharedConstants.APPROVAL_STATUS_APPROVED
export const APPROVAL_STATUS_REJECTED = sharedConstants.APPROVAL_STATUS_REJECTED

export const TODO_STATUS_PENDING = sharedConstants.TODO_STATUS_PENDING
export const TODO_STATUS_DONE = sharedConstants.TODO_STATUS_DONE
export const TODO_PRIORITY_HIGH = sharedConstants.TODO_PRIORITY_HIGH
export const TODO_PRIORITY_MEDIUM = sharedConstants.TODO_PRIORITY_MEDIUM
export const TODO_PRIORITY_LOW = sharedConstants.TODO_PRIORITY_LOW

export const SCHEDULE_TYPE_MEETING = sharedConstants.SCHEDULE_TYPE_MEETING
export const SCHEDULE_TYPE_DEADLINE = sharedConstants.SCHEDULE_TYPE_DEADLINE
export const SCHEDULE_TYPE_REMINDER = sharedConstants.SCHEDULE_TYPE_REMINDER
export const SCHEDULE_TYPE_OTHER = sharedConstants.SCHEDULE_TYPE_OTHER

export const NOTICE_TYPE_NOTICE = sharedConstants.NOTICE_TYPE_NOTICE
export const NOTICE_TYPE_NEWS = sharedConstants.NOTICE_TYPE_NEWS
export const NOTICE_TYPE_URGENT = sharedConstants.NOTICE_TYPE_URGENT
export const NOTICE_STATUS_DRAFT = sharedConstants.NOTICE_STATUS_DRAFT
export const NOTICE_STATUS_PUBLISHED = sharedConstants.NOTICE_STATUS_PUBLISHED

export const MESSAGE_STATUS_UNREAD = sharedConstants.MESSAGE_STATUS_UNREAD
export const MESSAGE_STATUS_READ = sharedConstants.MESSAGE_STATUS_READ

export const LOG_ACTION_CREATE = sharedConstants.LOG_ACTION_CREATE
export const LOG_ACTION_UPDATE = sharedConstants.LOG_ACTION_UPDATE
export const LOG_ACTION_DELETE = sharedConstants.LOG_ACTION_DELETE
export const LOG_ACTION_LOGIN = sharedConstants.LOG_ACTION_LOGIN
export const LOG_ACTION_LOGOUT = sharedConstants.LOG_ACTION_LOGOUT

export const TASK_STATUS_DELAYED = sharedConstants.TASK_STATUS_DELAYED

export const WEEKLY_REPORT_STATUS_DRAFT = sharedConstants.WEEKLY_REPORT_STATUS_DRAFT
export const WEEKLY_REPORT_STATUS_SUBMITTED = sharedConstants.WEEKLY_REPORT_STATUS_SUBMITTED
export const WEEKLY_REPORT_STATUS_REVIEWED = sharedConstants.WEEKLY_REPORT_STATUS_REVIEWED
export const WEEKLY_REPORT_STATUS_ARCHIVED = sharedConstants.WEEKLY_REPORT_STATUS_ARCHIVED

export const MILESTONE_OPENING = sharedConstants.MILESTONE_OPENING
export const MILESTONE_MIDTERM = sharedConstants.MILESTONE_MIDTERM
export const MILESTONE_PRE_DEFENSE = sharedConstants.MILESTONE_PRE_DEFENSE
export const MILESTONE_BLIND_REVIEW = sharedConstants.MILESTONE_BLIND_REVIEW
export const MILESTONE_DEFENSE = sharedConstants.MILESTONE_DEFENSE
export const MILESTONE_STATUS_PENDING = sharedConstants.MILESTONE_STATUS_PENDING
export const MILESTONE_STATUS_IN_PROGRESS = sharedConstants.MILESTONE_STATUS_IN_PROGRESS
export const MILESTONE_STATUS_DONE = sharedConstants.MILESTONE_STATUS_DONE
export const MILESTONE_STATUS_DELAYED = sharedConstants.MILESTONE_STATUS_DELAYED
