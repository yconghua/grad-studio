/**
 * 用户服务（Service Layer）—— 超级管理员用户管理 + 候选人查询
 *
 * 业务规则（需求约定）：
 *   - 超级管理员唯一（系统初始化写入），不可新增第二个、不可删除、不可修改角色；
 *   - 用户名区分大小写且唯一；
 *   - 新用户未填写密码时使用对应角色默认密码，首次登录强制修改密码；
 *   - 重新设置密码须满足强度规则（至少 6 位且包含大小写字母）；
 *   - 删除为物理删除；导师名下有关联学生、课题组管理员仍绑定课题组时禁止删除。
 * 角色权限闸门在 IPC 层（ipc/user.js）统一校验，本服务不重复做登录态判断。
 */
const userRepository = require('../db/repositories/userRepository')
const groupRepository = require('../db/repositories/groupRepository')
const authService = require('./authService')
const ApiError = require('./apiError')
const passwordService = require('./passwordService')
// 聊天数据清理：删除用户时标记会话/消息，双方都删的会话整体硬删
const chatService = require('./chatService')
const { runTransaction } = require('../db/connection')
const {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT,
  ACCOUNT_STATUS_ENABLED,
  ACCOUNT_STATUS_DISABLED
} = require('../../shared/constants')

// 全部角色
const ALL_ROLES = [ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT]
// 可被选入课题组的角色（课题组成员 = 导师 + 学生）
const CANDIDATE_ROLES = [ROLE_MENTOR, ROLE_STUDENT]

// 行转 DTO（字段名转驼峰，去掉哈希）
function toUserDto(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    realName: row.real_name || '',
    role: row.role,
    status: row.status,
    groupId: row.group_id == null ? null : Number(row.group_id),
    mentorId: row.mentor_id == null ? null : Number(row.mentor_id),
    mustChangePassword: row.must_change_password === 1,
    passwordResetAt: row.password_reset_at || null,
    gender: row.gender || 0,
    phone: row.phone || '',
    email: row.email || '',
    avatar: row.avatar || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// 分页结果包装
function pageResult(result, mapper) {
  return {
    list: result.list.map(mapper),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  }
}

/**
 * 用户分页列表（超级管理员）：关键字 / 角色 / 状态 / 课题组过滤
 * （课题组过滤供「编辑用户-资料 Tab」加载某课题组的导师候选使用）
 */
async function listUsers({ page, keyword, role, status, groupId } = {}) {
  if (role && !ALL_ROLES.includes(role)) throw new ApiError('角色参数不合法', 400)
  const result = await userRepository.pagedList({ page, keyword, role, status, groupId })
  return pageResult(result, toUserDto)
}

/**
 * 新增用户（超级管理员）：
 *   - 不允许新增超级管理员；
 *   - 密码未填写时使用角色默认密码；填写则必须通过强度校验且两次一致；
 *   - 新用户 must_change_password=1（首次登录强制改密）。
 */
async function createUser(payload = {}) {
  const { username, password, confirmPassword, role, status } = payload
  if (!username || !String(username).trim()) throw new ApiError('请输入用户名', 400)
  if (role === ROLE_SUPER_ADMIN) throw new ApiError('不允许新增超级管理员', 400)
  if (!ALL_ROLES.includes(role)) throw new ApiError('角色参数不合法', 400)

  const name = String(username).trim()
  if (name.length > 50) throw new ApiError('用户名不能超过 50 个字符', 400)
  // 资料字段长度（与 users 表列宽一致）
  if (payload.realName !== undefined && String(payload.realName).trim().length > 50) {
    throw new ApiError('真实姓名不能超过 50 个字符', 400)
  }
  if (payload.phone !== undefined && String(payload.phone).trim().length > 20) {
    throw new ApiError('手机号不能超过 20 个字符', 400)
  }
  if (payload.email !== undefined && String(payload.email).trim().length > 100) {
    throw new ApiError('邮箱不能超过 100 个字符', 400)
  }
  const exists = await userRepository.findByUsername(name)
  if (exists) throw new ApiError('用户名已存在（用户名区分大小写）', 400)

  let hash
  if (password !== undefined && String(password).trim() !== '') {
    if (!confirmPassword) throw new ApiError('请再次输入确认密码', 400)
    if (password !== confirmPassword) throw new ApiError('两次输入的密码不一致', 400)
    passwordService.validatePassword(password)
    hash = passwordService.hashPassword(password)
  } else {
    // 未设置密码：使用对应角色默认密码
    hash = passwordService.hashPassword(passwordService.defaultPasswordForRole(role))
  }

  const id = await userRepository.createUser({
    username: name,
    passwordHash: hash,
    role,
    status: status === undefined || status === '' ? ACCOUNT_STATUS_ENABLED : Number(status),
    // 资料字段显式映射为数据库列名：repository 白名单只认 snake_case，
    // 直接展开 camelCase 的 payload 会导致真实姓名/课题组/导师等写不进去
    real_name: payload.realName,
    phone: payload.phone,
    email: payload.email,
    gender: payload.gender,
    avatar: payload.avatar,
    group_id: payload.groupId,
    mentor_id: payload.mentorId
  })
  return getUser(id)
}

/**
 * 用户详情（超级管理员）
 */
async function getUser(id) {
  const row = await userRepository.findById(Number(id))
  if (!row) throw new ApiError('用户不存在', 404)
  return toUserDto(row)
}

/**
 * 账号密码 Tab 保存：
 *   - 用户名区分大小写且不可重复；
 *   - 密码为空表示不修改；修改则校验强度与确认密码一致，并置 must_change_password=1；
 *   - 角色一经创建不可修改（编辑用户时下拉框锁定），此处不处理 role 字段；
 *   - 超级管理员不可禁用。
 */
async function updateAccount(id, payload = {}) {
  const idNum = Number(id)
  const row = await userRepository.findById(idNum)
  if (!row) throw new ApiError('用户不存在', 404)

  const { username, password, confirmPassword, status } = payload
  const isSuper = row.role === ROLE_SUPER_ADMIN

  if (isSuper && Number(status) === ACCOUNT_STATUS_DISABLED) {
    throw new ApiError('超级管理员不能被禁用', 400)
  }

  const data = {}
  if (username !== undefined && username !== '') {
    const name = String(username).trim()
    if (!name) throw new ApiError('请输入用户名', 400)
    if (name.length > 50) throw new ApiError('用户名不能超过 50 个字符', 400)
    const exists = await userRepository.findByUsername(name)
    if (exists && exists.id !== idNum) throw new ApiError('用户名已存在（用户名区分大小写）', 400)
    data.username = name
  }
  if (password !== undefined && String(password).trim() !== '') {
    if (!confirmPassword) throw new ApiError('请再次输入确认密码', 400)
    if (password !== confirmPassword) throw new ApiError('两次输入的密码不一致', 400)
    passwordService.validatePassword(password)
    data.password_hash = passwordService.hashPassword(password)
    data.must_change_password = 1 // 管理员重置密码后，该用户下次登录需修改密码
  }
  if (status !== undefined) {
    const st = Number(status)
    if (st !== ACCOUNT_STATUS_ENABLED && st !== ACCOUNT_STATUS_DISABLED) throw new ApiError('状态参数不合法', 400)
    data.status = st
  }

  await userRepository.updateById(idNum, data)
  return getUser(idNum)
}

/**
 * 资料 Tab 保存：真实姓名 / 手机号 / 邮箱 / 性别 / 头像 / 所属课题组 / 导师
 * 规则：课题组必须存在；学生指定导师时，导师必须是同一课题组内的导师；
 * 学生离开课题组时同步解除导师关系。
 */
async function updateProfile(id, payload = {}) {
  const idNum = Number(id)
  const row = await userRepository.findById(idNum)
  if (!row) throw new ApiError('用户不存在', 404)

  const { realName, phone, email, gender, avatar, groupId, mentorId } = payload
  const data = {}

  if (realName !== undefined) {
    const rn = String(realName).trim()
    if (rn.length > 50) throw new ApiError('真实姓名不能超过 50 个字符', 400)
    data.real_name = rn
  }
  if (phone !== undefined) {
    const ph = String(phone).trim()
    if (ph.length > 20) throw new ApiError('手机号不能超过 20 个字符', 400)
    data.phone = ph || null
  }
  if (email !== undefined) {
    const em = String(email).trim()
    if (em.length > 100) throw new ApiError('邮箱不能超过 100 个字符', 400)
    data.email = em || null
  }
  if (gender !== undefined) {
    const g = Number(gender)
    if (![0, 1, 2].includes(g)) throw new ApiError('性别参数不合法', 400)
    data.gender = g
  }
  if (avatar !== undefined) data.avatar = String(avatar).trim() || null

  // 所属课题组：必须存在；学生离开课题组时解除导师关系
  if (groupId !== undefined) {
    const gid = groupId === null || groupId === '' ? null : Number(groupId)
    if (gid !== null) {
      const group = await groupRepository.findById(gid)
      if (!group) throw new ApiError('所选课题组不存在', 400)
    }
    data.group_id = gid
    if (row.role === ROLE_STUDENT && gid === null && row.mentor_id) {
      data.mentor_id = null
    }
  }

  // 指定导师：仅学生角色；导师必须与学生同属一个课题组
  if (mentorId !== undefined) {
    const mid = mentorId === null || mentorId === '' ? null : Number(mentorId)
    if (mid !== null) {
      if (row.role !== ROLE_STUDENT) throw new ApiError('只有学生可以指定导师', 400)
      const mentor = await userRepository.findById(mid)
      if (!mentor || mentor.role !== ROLE_MENTOR) throw new ApiError('所选导师不存在', 400)
      const studentGroup = data.group_id !== undefined ? data.group_id : row.group_id
      if (!studentGroup) throw new ApiError('请先为该学生选择所属课题组', 400)
      if (mentor.group_id !== studentGroup) throw new ApiError('导师与学生必须属于同一课题组', 400)
    }
    data.mentor_id = mid
  }

  await userRepository.updateById(idNum, data)
  return getUser(idNum)
}

/**
 * 更新当前登录用户自己的资料（个人资料页）
 * 仅允许修改基本信息（真实姓名 / 手机号 / 邮箱 / 性别 / 头像）；
 * 课题组 / 导师 / 角色等归属字段由管理员维护，此处不开放修改。
 * 修改主体取自登录会话（me.id），不信任前端传入的用户 id。
 */
async function updateOwnProfile(payload = {}) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  const { realName, phone, email, gender, avatar } = payload
  const data = {}

  if (realName !== undefined) {
    const rn = String(realName).trim()
    if (rn.length > 50) throw new ApiError('真实姓名不能超过 50 个字符', 400)
    data.real_name = rn
  }
  if (phone !== undefined) {
    const ph = String(phone).trim()
    if (ph.length > 20) throw new ApiError('手机号不能超过 20 个字符', 400)
    data.phone = ph || null
  }
  if (email !== undefined) {
    const em = String(email).trim()
    if (em.length > 100) throw new ApiError('邮箱不能超过 100 个字符', 400)
    data.email = em || null
  }
  if (gender !== undefined) {
    const g = Number(gender)
    if (![0, 1, 2].includes(g)) throw new ApiError('性别参数不合法', 400)
    data.gender = g
  }
  if (avatar !== undefined) data.avatar = String(avatar).trim() || null

  await userRepository.updateById(me.id, data)
  return getUser(me.id)
}

/**
 * 批量启用/禁用（超级管理员）：逐条校验并独立执行，
 * 一条失败不影响其余；不能操作当前登录账号、超级管理员不可禁用。
 * 返回 { successCount, failCount, failList: [{ id, reason }] }
 */
async function batchUpdateStatus(ids, status) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError('请选择要操作的用户', 400)
  const st = Number(status)
  if (st !== ACCOUNT_STATUS_ENABLED && st !== ACCOUNT_STATUS_DISABLED) throw new ApiError('状态参数不合法', 400)

  let successCount = 0
  const failList = []
  for (const rawId of ids) {
    const idNum = Number(rawId)
    try {
      if (me.id === idNum) throw new ApiError('不能操作当前登录账号', 400)
      const row = await userRepository.findById(idNum)
      if (!row) throw new ApiError('用户不存在', 404)
      if (row.role === ROLE_SUPER_ADMIN && st === ACCOUNT_STATUS_DISABLED) {
        throw new ApiError('超级管理员不能被禁用', 400)
      }
      if (row.status === st) throw new ApiError('已是目标状态', 400)
      await userRepository.updateById(idNum, { status: st })
      successCount++
    } catch (e) {
      failList.push({ id: idNum, reason: (e && e.message) ? e.message : '操作失败' })
    }
  }
  return { successCount, failCount: failList.length, failList }
}

/**
 * 批量删除用户（超级管理员）：逐条复用单条删除的级联逻辑（独立执行），
 * 一条失败不影响其余；不能删除当前登录账号。
 */
async function batchDelete(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError('请选择要删除的用户', 400)
  let successCount = 0
  const failList = []
  for (const rawId of ids) {
    const idNum = Number(rawId)
    try {
      await deleteUser(idNum)
      successCount++
    } catch (e) {
      failList.push({ id: idNum, reason: (e && e.message) ? e.message : '删除失败' })
    }
  }
  return { successCount, failCount: failList.length, failList }
}

/**
 * 重置密码（超级管理员）：取目标角色默认密码重新哈希写入，
 * 并置 must_change_password=1（该用户下次登录强制改密）+ 记录最近重置时间。
 * 不能重置自己的密码（自己改密走个人资料页）。
 */
async function resetPassword(id) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  const idNum = Number(id)
  if (me.id === idNum) throw new ApiError('不能重置自己的密码，请到个人资料页修改', 400)

  const row = await userRepository.findById(idNum)
  if (!row) throw new ApiError('用户不存在', 404)
  if (row.status !== ACCOUNT_STATUS_ENABLED) throw new ApiError('用户已被禁用，无法重置密码', 400)

  const hash = passwordService.hashPassword(passwordService.defaultPasswordForRole(row.role))
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const now = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  await userRepository.updateById(idNum, {
    password_hash: hash,
    must_change_password: 1,
    password_reset_at: now
  })
  return getUser(idNum)
}

/**
 * 删除用户（物理删除）：
 *   - 不能删除当前登录账号（含超级管理员自身）；
 *   - 超级管理员不可删除；
 *   - 导师：无条件清空名下所有学生的导师绑定（全平台，含跨组脏数据）后再删；
 *   - 课题组管理员仍绑定课题组时禁止删除（需先更换管理员）。
 * 删除与聊天清理在同一事务：先标记该用户的聊天成员与消息、硬删双方都删的会话，
 * 再执行原删除逻辑（清导师绑定 / 物理删用户），任一步失败整体回滚。
 * 返回 { removedStudentCount }（导师场景为解绑的学生数）。
 */
async function deleteUser(id) {
  const me = await authService.getCurrentUser()
  if (!me) throw new ApiError('未登录，请重新登录', 401)
  const idNum = Number(id)
  if (me.id === idNum) throw new ApiError('不能删除当前登录账号', 400)

  const row = await userRepository.findById(idNum)
  if (!row) throw new ApiError('用户不存在', 404)
  if (row.role === ROLE_SUPER_ADMIN) throw new ApiError('超级管理员不能被删除', 400)

  if (row.role === ROLE_GROUP_ADMIN) {
    const group = await groupRepository.findByAdminUserId(idNum)
    if (group) throw new ApiError('该课题组管理员仍绑定课题组，请先更换管理员后再删除', 400)
  }

  let removedStudentCount = 0
  await runTransaction(async () => {
    // 聊天数据清理：标记成员与消息；双方都删的会话（会话表+成员+消息）整体硬删
    await chatService.markUserDeleted(idNum)
    if (row.role === ROLE_MENTOR) {
      // 删除导师：先清空名下学生绑定，再物理删除，学生变为已入组未指定导师
      removedStudentCount = await userRepository.clearMentorBindings(idNum)
    }
    await userRepository.deleteById(idNum)
  })
  return row.role === ROLE_MENTOR ? { removedStudentCount } : true
}

// 批量导入：角色文本 → 角色枚举（超级管理员不在可选范围）
const BATCH_ROLE_MAP = { 导师: ROLE_MENTOR, 学生: ROLE_STUDENT, 课题组管理员: ROLE_GROUP_ADMIN }

// 性别文本 → 枚举（0 未知 / 1 男 / 2 女；其他与留空按未设置）
function parseGenderText(v) {
  if (v === '男') return 1
  if (v === '女') return 2
  return 0
}

// 启用状态文本 → 枚举（留空默认启用）
function parseStatusText(v) {
  if (v === '禁用') return ACCOUNT_STATUS_DISABLED
  return ACCOUNT_STATUS_ENABLED
}

/**
 * 批量新增用户（超级管理员）：
 *   - 入参 rows：解析后的行数组，每行含 row(Excel 行号)/username/realName/roleText/phone/email/
 *     genderText/groupName/mentorUsername/statusText；
 *   - 每行独立事务，一行失败不影响其余；返回 { successCount, failCount, failList:[{ row, username, reason }] }；
 *   - 密码统一走该角色默认密码（与单条新增留空一致），不接受前端传密码；
 *   - 批次内用户名重复的行全部判失败；库内重复由单条新增逻辑校验；
 *   - 课题组按名称精确匹配启用中的课题组，重名该行失败；
 *   - 导师按用户名匹配且角色必须是导师、与学生同组；非学生行填导师直接忽略；
 *   - 学生指定导师但未填所属课题组，该行失败。
 */
async function batchCreateUsers(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) throw new ApiError('导入数据为空', 400)
  if (rows.length > 500) throw new ApiError('单次最多 500 行，请分批导入', 400)

  // 批次内用户名查重（区分大小写，与库内唯一口径一致）；重复的用户名所在行全部判失败
  const countByUsername = new Map()
  for (const r of rows) {
    const name = r.username ? String(r.username).trim() : ''
    if (!name) continue
    countByUsername.set(name, (countByUsername.get(name) || 0) + 1)
  }

  const failList = []
  let successCount = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNo = Number(row.row) || i + 2
    const username = row.username ? String(row.username).trim() : ''
    if (username && (countByUsername.get(username) || 0) > 1) {
      failList.push({ row: rowNo, username, reason: '用户名在本批次内重复' })
      continue
    }
    try {
      // 每行独立事务：该行失败只回滚自己
      await runTransaction(async () => {
        await createImportedUser(row)
      })
      successCount++
    } catch (err) {
      failList.push({ row: rowNo, username: username || '-', reason: (err && err.message) ? err.message : '导入失败' })
    }
  }
  return { successCount, failCount: failList.length, failList }
}

// 导入单行（须在事务内调用）：解析文本字段后复用单条新增的全部校验与默认密码逻辑
async function createImportedUser(row) {
  const roleText = row.roleText ? String(row.roleText).trim() : ''
  const role = BATCH_ROLE_MAP[roleText]
  if (!role) throw new ApiError('角色不合法（只能填 导师 / 学生 / 课题组管理员）', 400)

  // 所属课题组：按名称精确匹配启用中的课题组；重名该行失败
  let groupId = null
  const groupName = row.groupName ? String(row.groupName).trim() : ''
  if (groupName) {
    const groups = await groupRepository.findByName(groupName)
    if (groups.length === 0) throw new ApiError('所属课题组不存在或已停用', 400)
    if (groups.length > 1) throw new ApiError('课题组名称不唯一，请先核实', 400)
    groupId = groups[0].id
  }

  // 导师：仅学生行生效；非学生行填了导师直接忽略
  let mentorId = null
  const mentorUsername = row.mentorUsername ? String(row.mentorUsername).trim() : ''
  if (mentorUsername && role === ROLE_STUDENT) {
    if (!groupId) throw new ApiError('学生指定导师时必须填写所属课题组', 400)
    const mentor = await userRepository.findByUsername(mentorUsername)
    if (!mentor || mentor.role !== ROLE_MENTOR) throw new ApiError('导师用户名不存在或不是导师', 400)
    if (mentor.group_id !== groupId) throw new ApiError('导师与学生必须属于同一课题组', 400)
    mentorId = mentor.id
  }

  await createUser({
    username: row.username,
    password: '',
    confirmPassword: '',
    role,
    status: parseStatusText(row.statusText),
    realName: row.realName,
    phone: row.phone,
    email: row.email,
    gender: parseGenderText(row.genderText),
    avatar: '',
    groupId,
    mentorId
  })
}

/**
 * 全部用户名（批量导入预览预检用）：仅超级管理员调用
 */
async function listAllUsernames() {
  return userRepository.findAllUsernames()
}

/**
 * 候选人列表（供「选择导师/学生加入课题组」下拉使用）：
 * 仅返回未入组（group_id 为空）且启用的导师 / 学生。
 * 后端强制角色白名单：前端传空/传错 role 一律按导师/学生收敛，超管/组管永不出现。
 */
async function listCandidates({ page, keyword, role } = {}) {
  const safeRole = role && CANDIDATE_ROLES.includes(role) ? role : null
  const result = await userRepository.pagedList({
    page,
    keyword,
    roles: CANDIDATE_ROLES, // 恒定白名单：超管/组管永不出现
    role: safeRole,
    unassigned: true,
    status: ACCOUNT_STATUS_ENABLED
  })
  return pageResult(result, toUserDto)
}

module.exports = {
  listUsers,
  createUser,
  getUser,
  updateAccount,
  updateProfile,
  updateOwnProfile,
  resetPassword,
  batchUpdateStatus,
  batchDelete,
  batchCreateUsers,
  listAllUsernames,
  deleteUser,
  listCandidates,
  toUserDto
}
