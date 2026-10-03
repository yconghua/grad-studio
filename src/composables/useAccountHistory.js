// 历史账号记录（组合式函数）：仅用于「切换账号」弹窗的展示
//
// 规则：
//   - 存储于 localStorage（key: gra_account_history_001），跨窗口保留；
//   - 每条含账号名 / 姓名 / 角色 / 头像 / 最近登录时间；
//   - 有效期 7 天（滚动）：再次登录刷新，读取时自动清除过期项；
//   - 按 username 去重置顶，上限 10 条，超出淘汰最旧；
//   - 不存密码；免密能力由主进程票据（ticketService）决定，与本记录无关。
const HISTORY_KEY = 'gra_account_history_001'
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ITEMS = 10

function safeParse(str) {
  if (typeof str !== 'string' || str.trim() === '') return []
  try {
    const data = JSON.parse(str)
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

export function useAccountHistory() {
  // 读取并清除过期项
  function load() {
    const now = Date.now()
    const list = safeParse(localStorage.getItem(HISTORY_KEY))
      .filter((x) => x && x.username && x.expireAt && x.expireAt > now)
    if (list.length === 0) {
      localStorage.removeItem(HISTORY_KEY)
      return []
    }
    return list
  }

  function save(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  }

  // 登录成功时记录：去重置顶 + 刷新 7 天 + 截断上限
  function recordLogin(user) {
    if (!user || !user.username) return
    const now = Date.now()
    const list = load().filter((x) => x.username !== user.username)
    list.unshift({
      username: user.username,
      realName: user.realName || '',
      role: user.role || '',
      avatar: user.avatar || '',
      lastLoginAt: now,
      expireAt: now + HISTORY_MS
    })
    save(list.length > MAX_ITEMS ? list.slice(0, MAX_ITEMS) : list)
  }

  function listAccounts() {
    return load()
  }

  function removeAccount(username) {
    save(load().filter((x) => x.username !== username))
  }

  function clearAccounts() {
    localStorage.removeItem(HISTORY_KEY)
  }

  return { recordLogin, listAccounts, removeAccount, clearAccounts, HISTORY_MS }
}
