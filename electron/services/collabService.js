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
      return { success: true, message: approved ? '已通过' : '已驳回' }
    } catch (err) {
      console.error('[approval.review] 数据库异常:', err)
      return { success: false, message: '审批失败' }
    }
  }
}

module.exports = collab
