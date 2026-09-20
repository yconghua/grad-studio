/**
 * 协同办公服务（Service Layer）—— 组会 / 活动 / 活动报名 / 任务 / 讨论区 / 审批
 *
 * 标准 CRUD 用工厂生成；报名去重与名额校验、帖子浏览/回复计数、审批流转在下方补充。
 */
const {
  meetingRepo,
  activityRepo,
  activitySignupRepo,
  taskRepo,
  forumPostRepo,
  forumReplyRepo,
  approvalRepo
} = require('../db/repositories/collabRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')
const logService = require('./logService')
const systemService = require('./systemService')
const {
  ACTIVITY_STATUS_OPEN,
  SIGNUP_STATUS_SIGNED,
  SIGNUP_STATUS_CANCELLED,
  APPROVAL_STATUS_APPROVED,
  APPROVAL_STATUS_REJECTED
} = require('../../shared/constants')

const collab = {
  // 组会：管理类写操作
  meeting: createCrudService(meetingRepo, { label: '组会', write: 'manager', creatorField: 'created_by' }),
  // 活动：管理类写操作（组织者创建）
  activity: createCrudService(activityRepo, { label: '活动', write: 'manager', creatorField: 'created_by' }),
  // 任务协作：成员可创建（负责人 assignee_id 由前端选，创建人回填）
  task: createCrudService(taskRepo, { label: '任务', write: 'member', creatorField: 'created_by' }),
  // 帖子：成员可发（作者回填当前用户）
  forumPost: createCrudService(forumPostRepo, { label: '帖子', write: 'member', creatorField: 'author_id' }),
  // 审批：成员发起（申请人=当前用户），审核走 reviewApproval
  approval: createCrudService(approvalRepo, { label: '审批', write: 'member', creatorField: 'applicant_id' }),

  /**
   * 活动报名：校验活动状态与名额上限，去重后写入。
   * @param {number} activityId 活动 id
   */
  async signup(activityId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (activityId === null || activityId === undefined) return { success: false, message: '缺少活动标识' }
    const me = permission.currentUserId()
    try {
      const activity = await activityRepo.get(activityId)
      if (!activity) return { success: false, message: '活动不存在' }
      if (activity.status !== ACTIVITY_STATUS_OPEN) return { success: false, message: '该活动不在报名阶段' }
      // 名额上限校验（仅当设置了上限）
      if (activity.max_signups) {
        const count = await activitySignupRepo.count({ activity_id: activityId, status: SIGNUP_STATUS_SIGNED })
        if (count >= activity.max_signups) return { success: false, message: '报名人数已满' }
      }
      // 去重（唯一键 uk_activity_user 兜底）
      const exist = await activitySignupRepo.list({ activity_id: activityId, user_id: me })
      if (exist.length) return { success: false, message: '已报名，请勿重复报名' }
      const id = await activitySignupRepo.create({ activity_id: activityId, user_id: me, status: SIGNUP_STATUS_SIGNED })
      logService.record('create', 'activity_signup', id, { activity_id: activityId })
      // 自动通知报名人：报名成功
      try {
        await systemService.notify({
          receiver_id: me,
          sender_id: null,
          title: '报名成功',
          content: `你已成功报名活动「${activity.title || '（未命名）'}」。`,
          type: 'activity'
        })
        // 自动通知活动组织者：有人报名了（组织者不是自己时才发）
        if (activity.created_by && Number(activity.created_by) !== Number(me)) {
          await systemService.notify({
            receiver_id: activity.created_by,
            sender_id: me,
            title: '新的活动报名',
            content: `你发布的活动「${activity.title || '（未命名）'}」有新成员报名。`,
            type: 'activity'
          })
        }
      } catch (e) { /* 通知失败不影响主流程 */ }
      return { success: true, id, message: '报名成功' }
    } catch (err) {
      console.error('[activity.signup] 数据库异常:', err)
      return { success: false, message: '报名失败，请稍后重试' }
    }
  },

  /**
   * 取消报名。
   * @param {number} activityId 活动 id
   */
  async cancelSignup(activityId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (activityId === null || activityId === undefined) return { success: false, message: '缺少活动标识' }
    const me = permission.currentUserId()
    try {
      const list = await activitySignupRepo.list({ activity_id: activityId, user_id: me })
      if (!list.length) return { success: false, message: '尚未报名' }
      await activitySignupRepo.update(list[0].id, { status: SIGNUP_STATUS_CANCELLED })
      logService.record('update', 'activity_signup', list[0].id, { status: SIGNUP_STATUS_CANCELLED })
      return { success: true, message: '已取消报名' }
    } catch (err) {
      console.error('[activity.cancelSignup] 数据库异常:', err)
      return { success: false, message: '取消失败，请稍后重试' }
    }
  },

  // 某活动的报名列表（含报名人信息），按报名时间排序
  async signupList(activityId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    try {
      const list = await activitySignupRepo.list({ activity_id: activityId }, 'id ASC')
      return { success: true, list }
    } catch (err) {
      console.error('[activity.signupList] 数据库异常:', err)
      return { success: false, message: '查询报名列表失败' }
    }
  },

  /**
   * 帖子浏览（浏览量原子自增）。
   * @param {number} postId 帖子 id
   */
  async viewPost(postId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (postId === null || postId === undefined) return { success: false, message: '缺少帖子标识' }
    try {
      await forumPostRepo.increment(postId, 'view_count', 1)
      return { success: true }
    } catch (err) {
      console.error('[forumPost.view] 数据库异常:', err)
      return { success: false, message: '浏览计数失败' }
    }
  },

  /**
   * 发表回复：写入回复并原子自增帖子回复数。
   * @param {number} postId 帖子 id
   * @param {string} content 回复内容
   * @param {number|null} parentId 父回复 id（楼中楼）
   */
  async reply(postId, content, parentId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (postId === null || postId === undefined) return { success: false, message: '缺少帖子标识' }
    if (!content || !String(content).trim()) return { success: false, message: '回复内容不能为空' }
    try {
      const post = await forumPostRepo.get(postId)
      if (!post) return { success: false, message: '帖子不存在' }
      const id = await forumReplyRepo.create({
        post_id: postId,
        parent_id: parentId || null,
        content: String(content).trim(),
        author_id: permission.currentUserId()
      })
      await forumPostRepo.increment(postId, 'reply_count', 1)
      logService.record('create', 'forum_reply', id, { post_id: postId })
      // 自动通知楼主：有人回复了你的帖子（回复人不是楼主本人时才发）
      try {
        const me = permission.currentUserId()
        if (post.author_id && Number(post.author_id) !== Number(me)) {
          await systemService.notify({
            receiver_id: post.author_id,
            sender_id: me,
            title: '帖子有新回复',
            content: `你的帖子「${post.title || '（未命名）'}」收到新回复：${String(content).slice(0, 80)}`,
            type: 'forum'
          })
        }
      } catch (e) { /* 通知失败不影响主流程 */ }
      return { success: true, id, message: '回复成功' }
    } catch (err) {
      console.error('[forum.reply] 数据库异常:', err)
      return { success: false, message: '回复失败，请稍后重试' }
    }
  },

  // 某帖子的回复列表（按时间正序）
  async replyList(postId) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    try {
      const list = await forumReplyRepo.list({ post_id: postId }, 'id ASC')
      return { success: true, list }
    } catch (err) {
      console.error('[forum.replyList] 数据库异常:', err)
      return { success: false, message: '查询回复失败' }
    }
  },

  /**
   * 审批审核：仅导师 / 管理员。
   * @param {number} id 审批 id
   * @param {boolean} approved 是否通过
   * @param {string} remark 审批意见
   */
  async reviewApproval(id, approved, remark) {
    if (!permission.isManager()) return { success: false, message: '无权限：仅导师或管理员可审批' }
    if (id === null || id === undefined) return { success: false, message: '缺少审批标识' }
    try {
      const exist = await approvalRepo.get(id)
      if (!exist) return { success: false, message: '审批不存在' }
      if (exist.status !== 'pending') return { success: false, message: '该审批已处理，不可重复审批' }
      await approvalRepo.update(id, {
        status: approved ? APPROVAL_STATUS_APPROVED : APPROVAL_STATUS_REJECTED,
        approver_id: permission.currentUserId(),
        handle_time: new Date(),
        handle_remark: remark || ''
      })
      logService.record('update', 'approval', id, { approved })
      // 自动通知申请人：审批结果
      try {
        await systemService.notify({
          receiver_id: exist.applicant_id,
          sender_id: permission.currentUserId(),
          title: approved ? '审批已通过' : '审批已驳回',
          content: `你的申请「${exist.title || '（未命名）'}」已${approved ? '通过' : '驳回'}。${remark ? `审批意见：${remark}` : ''}`,
          type: 'approval'
        })
      } catch (e) { /* 通知失败不影响主流程 */ }
      return { success: true, message: approved ? '已通过' : '已驳回' }
    } catch (err) {
      console.error('[approval.review] 数据库异常:', err)
      return { success: false, message: '审批失败' }
    }
  }
}

// 任务创建后自动通知负责人（被分配人不是创建人本人时才通知）
const _taskCreate = collab.task.create
collab.task.create = async (payload) => {
  const res = await _taskCreate(payload)
  if (res && res.success) {
    const assigneeId = payload && payload.assignee_id
    const me = permission.currentUserId()
    if (assigneeId && Number(assigneeId) !== Number(me)) {
      try {
        const task = await taskRepo.get(res.id)
        await systemService.notify({
          receiver_id: assigneeId,
          sender_id: me,
          title: '你被分配了新任务',
          content: task && task.title ? `任务「${task.title}」已分配给你，请及时处理。` : '你有新任务待处理。',
          type: 'task'
        })
      } catch (e) { /* 通知失败不影响主流程 */ }
    }
  }
  return res
}

// 帖子删除权限：管理员可删任何人的；导师 / 学生只能删自己的
const _forumPostRemove = collab.forumPost.remove
collab.forumPost.remove = async (id) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
  try {
    const post = await forumPostRepo.get(id)
    if (!post) return { success: false, message: '帖子不存在' }
    if (!permission.isAdmin() && post.author_id !== permission.currentUserId()) {
      return { success: false, message: '无权限：只能删除自己的帖子' }
    }
  } catch (e) {
    console.error('[forumPost.remove] 校验失败:', e)
    return { success: false, message: '删除失败' }
  }
  return _forumPostRemove(id)
}

// 任务删除权限：管理员可删任何人的；导师 / 学生只能删自己创建的
const _taskRemove = collab.task.remove
collab.task.remove = async (id) => {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  if (id === null || id === undefined) return { success: false, message: '缺少记录标识' }
  try {
    const task = await taskRepo.get(id)
    if (!task) return { success: false, message: '任务不存在' }
    if (!permission.isAdmin() && task.created_by !== permission.currentUserId()) {
      return { success: false, message: '无权限：只能删除自己创建的任务' }
    }
  } catch (e) {
    console.error('[task.remove] 校验失败:', e)
    return { success: false, message: '删除失败' }
  }
  return _taskRemove(id)
}

module.exports = collab
