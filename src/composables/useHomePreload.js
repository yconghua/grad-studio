// 登录后首屏数据预取 + 缓存复用（模块级单例）
//
// 登录成功 → 预取与「最短展示 2 秒」并行，取较晚者进首页：
//   第一段（无 gid 依赖）：课题组列表（经 useGroupContext.loadGroups，同时确定 currentGroupId）+ 消息 / 聊天未读数；
//   第二段（gid 就绪）：公告未读数 + 按角色预取工作台数据（与 workbench 页面同一批接口）。
// 结果按 key 写入缓存（带用户 id），进入首页后 HomeLayout / 工作台命中缓存直接用，不重复请求；
// 预取失败（请求 throw）不写缓存、不向上抛错，页面挂载时自行加载兜底；单接口失败（success=false）不缓存该项。
import { ref } from 'vue'
import {
  listGroups, listMyGroups,
  getMessageUnreadCount, getNoticeUnreadCount, getChatUnreadTotal,
  listUsers, listOperationLogs,
  listMembersByGroup, listNotices, listMeetings, listSubjects, listKnowledge,
  listStudents, listAllWeeklyReports, listAllAchievements, listMeetingReports,
  listMyTasks, listMyWeeklyReports, listMyAchievements, listMyLiterature,
  listMyResearchLogs, listDegreeNodes, listDegreeRecords
} from '../api'
import { useGroupContext } from './useGroupContext'
import { useSession } from './useSession'

// 预取缓存：同一用户只预取一次；换账号自动重取
const preloadCache = ref(null) // { userId, role, gid, msgUnread, chatUnread, noticeUnread, data: { key: 成功响应 } }
let preloadRunning = false

export function useHomePreload() {
  const { currentGroupId, loadGroups } = useGroupContext()
  const { getSessionUser } = useSession()

  // 取当前用户的预取缓存（未命中 / 换账号返回 null）
  function getPreload(userId) {
    const c = preloadCache.value
    return c && c.userId === userId ? c : null
  }

  // 登录成功后预取首屏数据；永不 reject（失败由页面挂载自行加载兜底）
  async function preloadHomeData(user) {
    if (!user || (preloadCache.value && preloadCache.value.userId === user.id)) return
    if (preloadRunning) return
    preloadRunning = true
    try {
      // ---- 第一段：课题组列表（确定 currentGroupId）+ 消息 / 聊天未读 ----
      await loadGroups()
      const [msgRes, chatRes] = await Promise.all([getMessageUnreadCount(), getChatUnreadTotal()])
      const gid = currentGroupId.value
      const noticeRes = gid ? await getNoticeUnreadCount(gid) : null

      // ---- 第二段：公告未读（依赖 gid）+ 按角色预取工作台数据 ----
      const data = {}
      const store = (key, res) => {
        if (res && res.success) data[key] = res
      }

      if (user.role === 'super_admin') {
        const [u, g, logs] = await Promise.all([
          listUsers(), listGroups(), listOperationLogs({ page: 1, pageSize: 5 })
        ])
        store('users', u)
        store('groups', g)
        store('logs', logs)
      } else if (user.role === 'group_admin') {
        const [m, n, mt, s, k] = await Promise.all([
          listMembersByGroup(gid), listNotices(gid), listMeetings(gid),
          listSubjects(gid), listKnowledge(gid)
        ])
        store('members', m)
        store('notices', n)
        store('meetings', mt)
        store('subjects', s)
        store('knowledge', k)
      } else if (user.role === 'mentor') {
        const [s, w, a, r] = await Promise.all([
          listStudents(),
          listAllWeeklyReports({}),
          gid ? listAllAchievements({ status: 'pending', group_id: gid }) : Promise.resolve({ success: false, data: [] }),
          gid ? listMeetingReports({ group_id: gid }) : Promise.resolve({ success: false, data: [] })
        ])
        store('students', s)
        store('weeklyReports', w)
        store('achievements', a)
        store('meetingReports', r)
        if (gid) {
          const n = await listNotices(gid)
          store('notices', n)
        }
      } else if (user.role === 'student') {
        const empty = { success: false, data: [] }
        const [t, w, s, mt, ach, lit, logs, reps, dn, dr] = await Promise.all([
          listMyTasks(),
          listMyWeeklyReports(),
          gid ? listSubjects(gid) : Promise.resolve(empty),
          gid ? listMeetings(gid) : Promise.resolve(empty),
          listMyAchievements(),
          listMyLiterature({}),
          listMyResearchLogs(),
          gid ? listMeetingReports({ group_id: gid }) : Promise.resolve(empty),
          gid ? listDegreeNodes(gid) : Promise.resolve(empty),
          gid ? listDegreeRecords({ group_id: gid }) : Promise.resolve(empty)
        ])
        store('myTasks', t)
        store('myWeeklyReports', w)
        store('mySubjects', s)
        store('myMeetings', mt)
        store('myAchievements', ach)
        store('myLiterature', lit)
        store('myResearchLogs', logs)
        store('myMeetingReports', reps)
        store('degreeNodes', dn)
        store('degreeRecords', dr)
        // 学生工作台的消息未读与全局消息未读共用第一段结果，不重复请求
        store('msgUnread', msgRes)
        if (gid) {
          const n = await listNotices(gid)
          store('notices', n)
        }
      }

      preloadCache.value = {
        userId: user.id,
        role: user.role,
        gid,
        msgUnread: msgRes,
        chatUnread: chatRes,
        noticeUnread: noticeRes,
        data
      }
    } catch (e) {
      // 预取整体失败：不写缓存，进首页后各页面按原有逻辑自行加载
      preloadCache.value = null
    } finally {
      preloadRunning = false
    }
  }

  return { getPreload, preloadHomeData }
}
