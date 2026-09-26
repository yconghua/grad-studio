/**
 * 全局搜索服务（Service Layer）—— 顶栏搜索框
 *
 * 搜索范围：成员 / 论文 / 任务 / 公告。
 * 安全关键：结果严格复用各模块可见性规则，学生搜不到无权看的数据。
 *  - 成员：管理员看全部；导师看自己 + 名下学生；学生看自己 + 自己的导师；
 *  - 论文：复用 researchService.paper.list（自带可见性）；
 *  - 任务：与任务列表一致（全员可见列表）；
 *  - 公告：复用 workbenchService.notice.list（学生只看已发布）。
 */
const permission = require('./permission')
const userRepository = require('../db/repositories/userRepository')
const researchService = require('./researchService')
const collabService = require('./collabService')
const workbenchService = require('./workbenchService')

function matches(u, kw) {
  return (
    String(u.real_name || '').includes(kw) ||
    String(u.username || '').includes(kw) ||
    String(u.student_no || '').includes(kw)
  )
}

async function globalSearch(keyword) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const kw = String(keyword || '').trim()
  if (!kw) return { success: true, members: [], papers: [], tasks: [], notices: [] }
  try {
    // 1. 论文 / 任务 / 公告：复用带权限的 service list
    const like = { op: 'LIKE', value: `%${kw}%` }
    const [papersRes, tasksRes, noticesRes] = await Promise.all([
      researchService.paper.list({ title: like }),
      collabService.task.list({ title: like }),
      workbenchService.notice.list({ title: like })
    ])
    const papers = (papersRes && papersRes.success ? papersRes.list : [])
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title, type: p.type || '' }))
    const tasks = (tasksRes && tasksRes.success ? tasksRes.list : [])
      .slice(0, 5)
      .map((t) => ({ id: t.id, title: t.title, status: t.status }))
    const notices = (noticesRes && noticesRes.success ? noticesRes.list : [])
      .slice(0, 5)
      .map((n) => ({ id: n.id, title: n.title, status: n.status }))

    // 2. 成员：按角色过滤
    const me = permission.currentUserId()
    let memberRows = []
    if (permission.isAdmin()) {
      memberRows = await userRepository.list()
    } else if (permission.isManager()) {
      const students = await userRepository.list({ advisor_id: me, role: 'student' })
      const self = await userRepository.findById(me)
      memberRows = [self, ...(students || [])]
    } else {
      const self = await userRepository.findById(me)
      memberRows = [self]
      if (self && self.advisor_id) {
        const advisor = await userRepository.findById(self.advisor_id)
        if (advisor) memberRows.push(advisor)
      }
    }
    const members = (memberRows || [])
      .filter((u) => u && matches(u, kw))
      .slice(0, 8)
      .map((u) => ({ id: u.id, username: u.username, real_name: u.real_name, role: u.role }))

    return { success: true, members, papers, tasks, notices }
  } catch (err) {
    console.error('[search.global] 数据库异常:', err)
    return { success: false, message: '搜索失败' }
  }
}

module.exports = { globalSearch }
