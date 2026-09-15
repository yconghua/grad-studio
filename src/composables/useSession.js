// 登录会话（组合式函数）：基于 localStorage，固定 24 小时有效（纯前端，非服务端会话）
//
// - gra_user      ：登录用户信息（JSON）
// - gra_login_exp ：会话过期时间戳（ms）；独立于用户信息存储，
//   避免被 ProfileView 的写回逻辑覆盖。
//
// 注意：内部只使用纯函数与 ref（无生命周期钩子），因此既可在组件 setup 中调用，
// 也可在 router/index.js 的登录守卫等非组件环境直接调用。
//
// 想改有效期，只调 SESSION_MS 即可。

// 会话存储 key（localStorage）。注意：若修改这两个 key 名，旧 key 下已保存的
// 登录态将读取不到，已登录用户会被判定为会话过期，需要重新登录一次。
export const USER_KEY = 'gra_studio_user_key_001'
export const EXP_KEY = 'gra_studio_login_exp_key_001'

// 会话有效期：24 小时
export const SESSION_MS = 24 * 60 * 60 * 1000

// 安全解析 JSON：解析失败或非字符串/空值返回 fallback（默认 null），绝不抛异常
export function safeParseJSON(str, fallback = null) {
  if (typeof str !== 'string' || str.trim() === '') return fallback
  try {
    return JSON.parse(str)
  } catch (e) {
    return fallback
  }
}

// 登录会话操作集：登录成功写入 / 读取当前用户 / 是否有效 / 清除
export function useSession() {
  // 登录成功时写入用户 + 过期时间
  function setSession(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(EXP_KEY, String(Date.now() + SESSION_MS))
  }

  // 读取当前登录用户（无则返回 null；脏数据自动清除，避免反复解析/后续踩坑）
  function getSessionUser() {
    const raw = localStorage.getItem(USER_KEY)
    if (raw === null) return null
    const user = safeParseJSON(raw, null)
    // 脏数据：解析失败，或合法 JSON 但非对象（null/数字/字符串/数组）→ 清掉 key 并按未登录处理
    if (user === null || typeof user !== 'object' || Array.isArray(user)) {
      localStorage.removeItem(USER_KEY)
      return null
    }
    return user
  }

  // 会话是否有效：存在过期时间且未超时
  function isSessionValid() {
    const exp = localStorage.getItem(EXP_KEY)
    if (!exp) return false
    return Date.now() < Number(exp)
  }

  // 清除登录态（用户 + 过期时间）
  function clearSession() {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(EXP_KEY)
  }

  return { SESSION_MS, USER_KEY, EXP_KEY, setSession, getSessionUser, isSessionValid, clearSession }
}
