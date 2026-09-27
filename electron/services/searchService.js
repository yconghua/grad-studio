/**
 * 全局搜索服务（Service Layer）—— search:global 通道的业务逻辑
 *
 * 核心约束：按角色计算「可见范围」再查询，防止越权搜到不该看的数据。
 *   - 超级管理员：不限组，可搜全部业务模块 + 个人数据；
 *   - 课题组管理员：仅搜自己管理的课题组内数据（成员 / 公告 / 组会 / 课题 / 任务 / 学位 / 成果 / 知识库）；
 *   - 导师：所在组数据 + 名下学生（成员结果限定为学生）；
 *   - 学生：所在组公开数据 + 本人个人数据（文献 / 日志 / 周报 / 档案）。
 * 每条结果附带 route（前端点击直接跳转的目标菜单路径）。
 */
const { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR } = require('../../shared/constants')
const permission = require('./permission')
const searchRepository = require('../db/repositories/searchRepository')

// 给结果数组每条记录追加跳转路由
function withRoute(rows, route) {
  return (rows || []).map((r) => ({ ...r, route }))
}

// 空数组兜底为 [-1]（IN 条件恒为空，避免 SQL 语法问题）
function safeIds(ids) {
  return ids && ids.length ? ids : [-1]
}

// 组装结果：只保留非空模块
function pack(results) {
  const out = {}
  for (const k of Object.keys(results)) {
    if (results[k] && results[k].length) out[k] = results[k]
  }
  return out
}

async function globalSearch(payload = {}) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  const role = permission.currentRole()
  const keyword = String((payload && payload.keyword) || '').trim()
  if (!keyword) return { success: true, results: {} }

  try {
    // 非超管：先取可见课题组
    let groupIds = null
    if (role !== ROLE_SUPER_ADMIN) {
      const mine = await searchRepository.myGroupIds(userId)
      groupIds = safeIds(mine)
    }

    const results = {}

    if (role === ROLE_SUPER_ADMIN) {
      results.groups = withRoute(await searchRepository.searchGroups(keyword), '/platform/groups')
      results.members = withRoute(await searchRepository.searchMembers(keyword, null, null), '/platform/users')
      results.notices = withRoute(await searchRepository.searchNotices(keyword, null), '/platform/overview')
      results.meetings = withRoute(await searchRepository.searchMeetings(keyword, null), '/platform/overview')
      results.subjects = withRoute(await searchRepository.searchSubjects(keyword, null), '/platform/overview')
      results.tasks = withRoute(await searchRepository.searchTasks(keyword, null), '/platform/overview')
      results.degreeNodes = withRoute(await searchRepository.searchDegreeNodes(keyword, null), '/platform/overview')
      results.degreeRecords = withRoute(await searchRepository.searchDegreeRecords(keyword, null), '/platform/overview')
      results.achievements = withRoute(await searchRepository.searchAchievements(keyword, null), '/platform/overview')
      results.knowledge = withRoute(await searchRepository.searchKnowledge(keyword, null), '/platform/overview')
      results.literatures = withRoute(await searchRepository.searchAllLiteratures(keyword), '/platform/overview')
      results.researchLogs = withRoute(await searchRepository.searchAllResearchLogs(keyword), '/platform/overview')
      results.weeklyReports = withRoute(await searchRepository.searchAllWeeklyReports(keyword), '/platform/overview')
      results.archives = withRoute(await searchRepository.searchAllArchives(keyword), '/platform/overview')
    } else if (role === ROLE_GROUP_ADMIN) {
      results.members = withRoute(await searchRepository.searchMembers(keyword, groupIds, null), '/member')
      results.notices = withRoute(await searchRepository.searchNotices(keyword, groupIds), '/notice')
      results.meetings = withRoute(await searchRepository.searchMeetings(keyword, groupIds), '/meeting')
      results.subjects = withRoute(await searchRepository.searchSubjects(keyword, groupIds), '/subject')
      results.tasks = withRoute(await searchRepository.searchTasks(keyword, groupIds), '/task')
      results.degreeNodes = withRoute(await searchRepository.searchDegreeNodes(keyword, groupIds), '/degree')
      results.degreeRecords = withRoute(await searchRepository.searchDegreeRecords(keyword, groupIds), '/degree')
      results.achievements = withRoute(await searchRepository.searchAchievements(keyword, groupIds), '/achievement')
      results.knowledge = withRoute(await searchRepository.searchKnowledge(keyword, groupIds), '/knowledge')
    } else if (role === ROLE_MENTOR) {
      const studentIds = safeIds(await searchRepository.myStudentIds(userId))
      results.members = withRoute(await searchRepository.searchMembers(keyword, groupIds, studentIds), '/students')
      results.notices = withRoute(await searchRepository.searchNotices(keyword, groupIds), '/notice')
      results.meetings = withRoute(await searchRepository.searchMeetings(keyword, groupIds), '/meeting')
      results.subjects = withRoute(await searchRepository.searchSubjects(keyword, groupIds), '/subject')
      results.tasks = withRoute(await searchRepository.searchTasks(keyword, groupIds), '/task')
      results.degreeNodes = withRoute(await searchRepository.searchDegreeNodes(keyword, groupIds), '/degree')
      results.degreeRecords = withRoute(await searchRepository.searchDegreeRecords(keyword, groupIds), '/degree')
      results.achievements = withRoute(await searchRepository.searchAchievements(keyword, groupIds), '/achievement')
      results.knowledge = withRoute(await searchRepository.searchKnowledge(keyword, groupIds), '/knowledge')
    } else {
      // 学生：组内公开数据 + 本人个人数据
      results.notices = withRoute(await searchRepository.searchNotices(keyword, groupIds), '/notice')
      results.meetings = withRoute(await searchRepository.searchMeetings(keyword, groupIds), '/meeting')
      results.subjects = withRoute(await searchRepository.searchSubjects(keyword, groupIds), '/my-work')
      results.tasks = withRoute(await searchRepository.searchTasks(keyword, groupIds), '/my-work')
      results.achievements = withRoute(await searchRepository.searchAchievements(keyword, groupIds), '/achievement')
      results.knowledge = withRoute(await searchRepository.searchKnowledge(keyword, groupIds), '/knowledge')
      results.literatures = withRoute(await searchRepository.searchLiteratures(keyword, userId), '/literature')
      results.researchLogs = withRoute(await searchRepository.searchResearchLogs(keyword, userId), '/research-record')
      results.weeklyReports = withRoute(await searchRepository.searchWeeklyReports(keyword, userId), '/research-record')
      results.archives = withRoute(await searchRepository.searchArchives(keyword, userId), '/archive')
    }

    return { success: true, results: pack(results) }
  } catch (err) {
    console.error('[searchService.globalSearch] 数据库异常:', err)
    return { success: false, message: '搜索失败，请稍后重试' }
  }
}

module.exports = { globalSearch }
