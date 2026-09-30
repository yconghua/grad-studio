/**
 * 级联软删服务（Service Layer）—— 删除用户 / 移除成员时的关联数据清理
 *
 * 原则：全链路保持软删除（is_deleted = 1），不物理删除任何记录。
 * 所有级联清理包在事务中执行（connection.runTransaction），
 * 任一步失败整体回滚，避免出现删一半的不一致状态。
 *
 * 两个入口：
 *   - softDeleteUser(userId)：删除账号时，清理该账号本人名下的全部数据
 *     （个人数据 + 组内关联 + 消息 + 已读标记 + 账号本身）。
 *     公共资产不级联：知识库节点 / 文件、课题、组会、公告、操作日志
 *     仍保留（创建人 / 发布人显示 #id，数据不丢）。
 *   - softRemoveMember(groupId, userId)：移除成员时，清理该成员在本组的
 *     组内关联数据（导师-学生关系、学位记录、任务与进展、组会汇报、课题成员、
 *     成员记录本身）。该成员的个人数据（周报 / 日志 / 文献 / 成果 / 档案）
 *     与账号保留（成员只是离组，账号仍可登录使用）。
 *
 * 说明：系统约束「学生 / 导师账号仅属于一个课题组」（memberService.add 校验），
 * 故按 user_id 单字段软删即等价于组内清理，不会误伤其他组；
 * meeting_report / subject_member 两组额外经子查询显式限定本组，语义更严谨。
 */
const { runTransaction } = require('../db/connection')
const userRepository = require('../db/repositories/userRepository')
const userProfileRepository = require('../db/repositories/userProfileRepository')
const userGroupRepository = require('../db/repositories/userGroupRepository')
const mentorStudentRepository = require('../db/repositories/mentorStudentRepository')
const weeklyReportRepository = require('../db/repositories/weeklyReportRepository')
const researchLogRepository = require('../db/repositories/researchLogRepository')
const literatureRepository = require('../db/repositories/literatureRepository')
const literatureNoteRepository = require('../db/repositories/literatureNoteRepository')
const achievementRepository = require('../db/repositories/achievementRepository')
const paperRepository = require('../db/repositories/paperRepository')
const archiveRecordRepository = require('../db/repositories/archiveRecordRepository')
const meetingReportRepository = require('../db/repositories/meetingReportRepository')
const taskRepository = require('../db/repositories/taskRepository')
const taskProgressRepository = require('../db/repositories/taskProgressRepository')
const studentDegreeRepository = require('../db/repositories/studentDegreeRepository')
const subjectMemberRepository = require('../db/repositories/subjectMemberRepository')
const messageRepository = require('../db/repositories/messageRepository')
const noticeReadRepository = require('../db/repositories/noticeReadRepository')

/**
 * 删除账号：事务内软删账号本身 + 该账号名下的全部关联数据。
 * @param {number} userId 目标用户 id
 * @returns {Promise<{success: boolean, message: string, data?: Object}>}
 */
async function softDeleteUser(userId) {
  try {
    const counts = await runTransaction(async () => {
      const c = {}
      c.users = await userRepository.delete(userId)
      c.userProfiles = await userProfileRepository.softDeleteByField('user_id', userId)
      c.userGroups = await userGroupRepository.softDeleteByField('user_id', userId)
      c.mentorRelations = await mentorStudentRepository.softDeleteByField('mentor_id', userId)
      c.studentRelations = await mentorStudentRepository.softDeleteByField('student_id', userId)
      c.weeklyReports = await weeklyReportRepository.softDeleteByField('student_id', userId)
      c.researchLogs = await researchLogRepository.softDeleteByField('student_id', userId)
      c.literatures = await literatureRepository.softDeleteByField('user_id', userId)
      c.literatureNotes = await literatureNoteRepository.softDeleteByField('user_id', userId)
      c.achievements = await achievementRepository.softDeleteByField('user_id', userId)
      c.papers = await paperRepository.softDeleteByField('user_id', userId)
      c.archives = await archiveRecordRepository.softDeleteByField('user_id', userId)
      c.meetingReports = await meetingReportRepository.softDeleteByField('student_id', userId)
      // 指派给该用户的未完成任务一并软删；该用户作为下发人的任务保留（任务仍属课题组）
      c.tasks = await taskRepository.softDeleteByField('assignee_id', userId)
      c.taskProgress = await taskProgressRepository.softDeleteByField('user_id', userId)
      c.degreeRecords = await studentDegreeRepository.softDeleteByField('student_id', userId)
      c.subjectMembers = await subjectMemberRepository.softDeleteByField('user_id', userId)
      // 消息：收件箱（发给他的）与发件箱（他发出去的）一并软删
      c.inboxMessages = await messageRepository.softDeleteByField('receiver_id', userId)
      c.outboxMessages = await messageRepository.softDeleteByField('sender_id', userId)
      c.noticeReads = await noticeReadRepository.softDeleteByField('user_id', userId)
      return c
    })
    return { success: true, message: '已删除', data: { counts } }
  } catch (err) {
    console.error('[userCascadeService.softDeleteUser] 级联软删失败:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

/**
 * 移除成员（事务内执行体）：软删成员记录本身 + 该成员在本组的组内关联数据。
 * 不自行开启事务，由调用方提供 runTransaction 上下文（支持在替换组等场景并入同一事务）。
 * @param {{ userGroupId: number, groupId: number, userId: number }} param
 *        userGroupId 成员记录 id（user_group 表）；groupId / userId 用于组内关联清理
 * @returns {Promise<Object>} counts 各表软删行数
 */
async function softRemoveMemberTx({ userGroupId, groupId, userId }) {
  const c = {}
  c.userGroup = await userGroupRepository.delete(userGroupId)
  // 该成员在组内作为导师 / 学生的指导关系一并软删（学生 / 导师仅属一个组，单字段即组内范围）
  c.mentorRelations = await mentorStudentRepository.softDeleteByField('mentor_id', userId)
  c.studentRelations = await mentorStudentRepository.softDeleteByField('student_id', userId)
  c.degreeRecords = await studentDegreeRepository.softDeleteByField('student_id', userId)
  // 指派给该成员的任务与进展（学生 / 导师仅属一个组，单字段即组内范围）
  c.tasks = await taskRepository.softDeleteByField('assignee_id', userId)
  c.taskProgress = await taskProgressRepository.softDeleteByField('user_id', userId)
  // 该成员在本组组会 / 课题下的关联（显式经 group_id 子查询限定）
  c.meetingReports = await meetingReportRepository.softDeleteByGroupStudent(groupId, userId)
  c.subjectMembers = await subjectMemberRepository.softDeleteByGroupUser(groupId, userId)
  return c
}

/**
 * 移除成员：事务内软删成员记录本身 + 该成员在本组的组内关联数据。
 * @param {{ userGroupId: number, groupId: number, userId: number }} param
 *        userGroupId 成员记录 id（user_group 表）；groupId / userId 用于组内关联清理
 * @returns {Promise<{success: boolean, message: string, data?: Object}>}
 */
async function softRemoveMember({ userGroupId, groupId, userId }) {
  try {
    const counts = await runTransaction(() => softRemoveMemberTx({ userGroupId, groupId, userId }))
    return { success: true, message: '已移除', data: { counts } }
  } catch (err) {
    console.error('[userCascadeService.softRemoveMember] 级联软删失败:', err)
    return { success: false, message: '移除失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
}

module.exports = {
  softDeleteUser,
  softRemoveMemberTx,
  softRemoveMember
}
