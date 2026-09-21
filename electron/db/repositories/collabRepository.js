/**
 * 协同办公模块仓库（Repository Layer）—— 对应协同办公导航下 7 张业务表
 *
 * 每张表通过 crudFactory 生成带「字段白名单」的通用 CRUD 实例（安全约定见 crudFactory）。
 * forum_post 的浏览数 / 回复数用 crudFactory.increment 做原子自增，避免「读-改-写」竞态。
 */
const { createCrudRepo } = require('./crudFactory')

// 组会
const meetingRepo = createCrudRepo('meeting', {
  writable: [
    'title', 'type', 'meeting_date', 'location', 'host_id',
    'attendees', 'summary', 'status', 'created_by'
  ]
})

// 活动
const activityRepo = createCrudRepo('activity', {
  writable: [
    'title', 'type', 'description', 'location', 'start_time', 'end_time',
    'signup_deadline', 'max_signups', 'organizer_id', 'status', 'created_by'
  ]
})

// 活动报名
const activitySignupRepo = createCrudRepo('activity_signup', {
  writable: ['activity_id', 'user_id', 'remark', 'status']
})

// 任务协作
const taskRepo = createCrudRepo('task', {
  writable: [
    'title', 'description', 'project_id', 'assignee_id', 'priority',
    'status', 'progress', 'due_date', 'created_by'
  ]
})

// 讨论区帖子
const forumPostRepo = createCrudRepo('forum_post', {
  writable: ['title', 'content', 'type', 'author_id', 'view_count', 'reply_count', 'pinned']
})

// 讨论区回复
const forumReplyRepo = createCrudRepo('forum_reply', {
  writable: ['post_id', 'parent_id', 'content', 'author_id']
})

// 审批中心
const approvalRepo = createCrudRepo('approval', {
  writable: [
    'title', 'type', 'content', 'applicant_id', 'approver_id', 'status',
    'apply_time', 'handle_time', 'handle_remark'
  ]
})

// 周报
const weeklyReportRepo = createCrudRepo('weekly_report', {
  writable: [
    'student_id', 'week_start', 'week_end', 'progress', 'issues',
    'plan_next', 'attachment', 'status', 'mentor_comment', 'mentor_score',
    'mentor_id', 'reviewed_at'
  ]
})

// 会议议程
const meetingAgendaRepo = createCrudRepo('meeting_agenda', {
  writable: ['meeting_id', 'order_no', 'content', 'speaker_id']
})

// 会议已读回执
const meetingReadRepo = createCrudRepo('meeting_read', {
  writable: ['meeting_id', 'user_id']
})

module.exports = {
  meetingRepo,
  activityRepo,
  activitySignupRepo,
  taskRepo,
  forumPostRepo,
  forumReplyRepo,
  approvalRepo,
  weeklyReportRepo,
  meetingAgendaRepo,
  meetingReadRepo
}
