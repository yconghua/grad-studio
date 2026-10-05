/**
 * 全局搜索服务（Service Layer）—— 跨模块关键词搜索
 *
 * 权限模型（唯一可信来源：主进程会话 authService.getCurrentUser）：
 *   - 所有范围条件（group_id / user_id / mentor_id）一律服务端按当前用户计算并注入，
 *     客户端只传 keyword，不参与任何权限判断；
 *   - 角色决定可搜模块与范围：super_admin 全平台，group_admin/mentor 本组，
 *     student 仅本人相关内容；
 *   - 未登录由 IPC 层拦截；未入组（groupId 为空）时组内模块自然查不到数据，不抛错。
 *
 * 匹配方式：LIKE %keyword%（参数化 + 通配符转义），每组最多 SEARCH_LIMIT 条，
 * 多组查询并行执行（Promise.allSettled，单组失败不影响其他组）。
 */
const { acquireConn } = require('../db/connection')
const authService = require('./authService')
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} = require('../../shared/constants')

// 每组最多返回条数
const SEARCH_LIMIT = 5
// 关键词长度上限（防滥用，超长直接返回空）
const KEYWORD_MAX = 50

// 角色显示名（用户搜索结果的附加信息）
const ROLE_LABEL = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}

// LIKE 通配符转义：% _ \ 前加反斜杠，防止用户输入被当作通配符
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => '\\' + c)
}

// 命中片段：优先取首个命中位置附近的一段，否则截取开头，最长 max 字
function snippetOf(text, keyword, max = 70) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const idx = t.toLowerCase().indexOf(String(keyword).toLowerCase())
  if (idx < 0) return t.length > max ? `${t.slice(0, max)}…` : t
  const start = Math.max(0, idx - Math.floor(max / 3))
  const end = Math.min(t.length, start + max)
  return `${start > 0 ? '…' : ''}${t.slice(start, end)}${end < t.length ? '…' : ''}`
}

// 单次查询：拿连接、执行、释放（与 BaseRepository._execute 同一套连接机制）
async function run(sql, params) {
  const { conn, release } = await acquireConn()
  try {
    const [rows] = await conn.execute(sql, params)
    return rows
  } finally {
    release()
  }
}

/**
 * 按角色组装查询规格列表。
 * 每个规格含：type（结果分组标识）/ label（组标题）/ query（SQL）/ params / map（行转结果项）。
 * 权限过滤全部写死在 SQL 条件里（group_id / user_id / mentor_id 来自当前用户）。
 */
function buildQueries(me, kw) {
  const like = `%${escapeLike(kw)}%`
  const specs = []
  const role = me.role
  const groupId = me.groupId == null ? null : Number(me.groupId)

  // ===== 用户（学生不搜用户） =====
  if (role === ROLE_SUPER_ADMIN || role === ROLE_GROUP_ADMIN || role === ROLE_MENTOR) {
    let sql = `SELECT u.id, u.username, u.real_name, u.role, u.status, u.group_id, g.name AS group_name
      FROM \`users\` u LEFT JOIN \`groups\` g ON g.id = u.group_id
      WHERE u.status = 1 AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`
    const params = [like, like, like, like]
    if (role !== ROLE_SUPER_ADMIN && groupId) {
      sql += ' AND u.group_id = ?'
      params.push(groupId)
    }
    sql += ` ORDER BY u.id LIMIT ${SEARCH_LIMIT}`
    specs.push({
      type: 'user',
      label: '用户',
      query: sql,
      params,
      map: (r) => ({
        id: r.id,
        title: r.real_name || r.username,
        snippet: `${r.username} · ${ROLE_LABEL[r.role] || r.role}${r.group_name ? ` · ${r.group_name}` : ''}`,
        groupId: r.group_id,
        extra: { role: r.role }
      })
    })
  }

  // ===== 课题组（仅超管） =====
  if (role === ROLE_SUPER_ADMIN) {
    specs.push({
      type: 'group',
      label: '课题组',
      query: `SELECT id, name, description, status FROM \`groups\`
        WHERE name LIKE ? OR description LIKE ? ORDER BY id LIMIT ${SEARCH_LIMIT}`,
      params: [like, like],
      map: (r) => ({ id: r.id, title: r.name, snippet: snippetOf(r.description, kw) || '暂无描述' })
    })
  }

  // ===== 公告 =====
  {
    let sql = `SELECT n.id, n.group_id, n.title, n.content, n.status, n.is_top, n.publish_time,
      u.real_name AS publisher_name
      FROM \`group_notice\` n LEFT JOIN \`users\` u ON u.id = n.publisher_id
      WHERE (n.title LIKE ? OR n.content LIKE ?)`
    const params = [like, like]
    if (role !== ROLE_SUPER_ADMIN && groupId) {
      sql += ' AND n.group_id = ?'
      params.push(groupId)
    }
    if (role === ROLE_MENTOR || role === ROLE_STUDENT) {
      // 导师/学生仅可见已发布公告
      sql += ' AND n.status = 1'
    }
    sql += ` ORDER BY n.publish_time DESC LIMIT ${SEARCH_LIMIT}`
    specs.push({
      type: 'notice',
      label: '公告',
      query: sql,
      params,
      map: (r) => ({
        id: r.id,
        title: r.title,
        snippet: snippetOf(r.content, kw),
        groupId: r.group_id,
        extra: { publisher: r.publisher_name || '', publishTime: r.publish_time }
      })
    })
  }

  // ===== 组会 =====
  {
    let sql = `SELECT m.id, m.group_id, m.title, m.meeting_time, m.location, m.agenda, m.content, m.status
      FROM \`group_meeting\` m WHERE (m.title LIKE ? OR m.agenda LIKE ? OR m.content LIKE ? OR m.location LIKE ?)`
    const params = [like, like, like, like]
    if (role !== ROLE_SUPER_ADMIN && groupId) {
      sql += ' AND m.group_id = ?'
      params.push(groupId)
    }
    if (role === ROLE_MENTOR || role === ROLE_STUDENT) {
      // 导师/学生仅可见已发布 / 已归档会议（草稿只对发起人与管理端可见）
      sql += ' AND m.status IN (2, 3)'
    }
    sql += ` ORDER BY m.meeting_time DESC LIMIT ${SEARCH_LIMIT}`
    specs.push({
      type: 'meeting',
      label: '组会',
      query: sql,
      params,
      map: (r) => ({
        id: r.id,
        title: r.title,
        snippet: snippetOf(r.content || r.agenda, kw) || r.location || '',
        groupId: r.group_id,
        extra: { meetingTime: r.meeting_time, status: r.status }
      })
    })
  }

  // ===== 任务（未软删除；超管走任务总览，不在全局搜索范围） =====
  if (role === ROLE_GROUP_ADMIN || role === ROLE_MENTOR || role === ROLE_STUDENT) {
    let sql = `SELECT t.id, t.group_id, t.title, t.description, t.status, t.priority, t.due_time
      FROM \`task\` t`
    const params = []
    if (role === ROLE_STUDENT && me.id != null) {
      // 学生仅搜自己参与的任务
      sql += ` JOIN \`task_participant\` tp ON tp.task_id = t.id AND tp.user_id = ?`
      params.push(me.id)
    }
    sql += ' WHERE t.is_deleted = 0 AND (t.title LIKE ? OR t.description LIKE ?)'
    params.push(like, like)
    if (role === ROLE_GROUP_ADMIN || role === ROLE_MENTOR) {
      if (groupId) {
        sql += ' AND t.group_id = ?'
        params.push(groupId)
      } else {
        // 未入组时组内任务不可搜：恒假条件
        sql += ' AND 1 = 0'
      }
    }
    sql += ` ORDER BY t.due_time IS NULL, t.due_time DESC LIMIT ${SEARCH_LIMIT}`
    specs.push({
      type: 'task',
      label: '任务',
      query: sql,
      params,
      map: (r) => ({
        id: r.id,
        title: r.title,
        snippet: snippetOf(r.description, kw) || r.title,
        groupId: r.group_id,
        extra: { status: r.status, dueTime: r.due_time }
      })
    })
  }

  // ===== 笔记（仅学生自己的私有笔记，软删除外） =====
  if (role === ROLE_STUDENT && me.id != null) {
    specs.push({
      type: 'note',
      label: '笔记',
      query: `SELECT id, title, content, category, change_ts FROM \`note\`
        WHERE user_id = ? AND is_deleted = 0 AND (title LIKE ? OR content LIKE ?)
        ORDER BY change_ts DESC LIMIT ${SEARCH_LIMIT}`,
      params: [me.id, like, like],
      map: (r) => ({
        id: r.id,
        title: r.title || '无标题笔记',
        snippet: snippetOf(r.content, kw) || `类别：${r.category}`,
        extra: { category: r.category, changeTs: r.change_ts }
      })
    })
  }

  // ===== 周报 =====
  {
    let sql = `SELECT r.id, r.group_id, r.user_id, r.week_key, r.title, r.content, r.status,
      u.real_name AS user_name
      FROM \`report\` r LEFT JOIN \`users\` u ON u.id = r.user_id
      WHERE (r.title LIKE ? OR r.content LIKE ?)`
    const params = [like, like]
    if (role === ROLE_STUDENT && me.id != null) {
      sql += ' AND r.user_id = ?'
      params.push(me.id)
    } else if (role === ROLE_MENTOR && me.id != null) {
      // 导师搜名下学生的周报
      sql += ' AND r.user_id IN (SELECT id FROM `users` WHERE mentor_id = ?)'
      params.push(me.id)
    } else if (role === ROLE_GROUP_ADMIN) {
      if (groupId) {
        sql += ' AND r.group_id = ?'
        params.push(groupId)
      } else {
        sql += ' AND 1 = 0'
      }
    }
    sql += ` ORDER BY r.week_key DESC LIMIT ${SEARCH_LIMIT}`
    specs.push({
      type: 'report',
      label: '周报',
      query: sql,
      params,
      map: (r) => ({
        id: r.id,
        title: r.title || `${r.week_key} 周报`,
        snippet: snippetOf(r.content, kw) || `状态：${r.status}`,
        groupId: r.group_id,
        extra: { weekKey: r.week_key, status: r.status, userName: r.user_name || '' }
      })
    })
  }

  return specs
}

/**
 * 全局搜索主入口。
 * @param {Object} payload 客户端载荷，仅取 keyword
 * @param {Object} me 当前登录用户（authService.getCurrentUser 返回）
 * @returns {Promise<{keyword:string, groups:Array}>}
 *   groups: [{ type, label, items:[{ id, title, snippet, groupId, extra }] }]
 */
async function search(payload = {}, me) {
  const keyword = String(payload.keyword == null ? '' : payload.keyword).trim()
  if (!keyword || keyword.length > KEYWORD_MAX) return { keyword, groups: [] }

  const specs = buildQueries(me, keyword)
  const settled = await Promise.allSettled(
    specs.map(async (spec) => {
      const rows = await run(spec.query, spec.params)
      return {
        type: spec.type,
        label: spec.label,
        items: rows.slice(0, SEARCH_LIMIT).map(spec.map)
      }
    })
  )
  const groups = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value && r.value.items.length > 0) {
      groups.push(r.value)
    }
  }
  return { keyword, groups }
}

module.exports = { search }
