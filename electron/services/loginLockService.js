/**
 * 登录失败锁定服务（内存态，应用重启清零）
 *
 * 规则：同一账号连续失败满 MAX_FAILURES 次 → 锁定 LOCK_MS 毫秒；
 * 锁定期间该账号拒绝登录（即使密码正确）；锁定期满自动解锁并重新计数。
 * 只按账号锁定，不锁本机（避免一人输错影响整台电脑）。
 */
const MAX_FAILURES = 5
const LOCK_MS = 5 * 60 * 1000

// username -> { failures, lockedUntil }
const state = new Map()

// 返回 null（未锁定）或 { remainMs }（剩余锁定毫秒）
function checkLocked(username) {
  if (!username) return null
  const rec = state.get(username)
  if (!rec) return null
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return { remainMs: rec.lockedUntil - Date.now() }
  }
  if (rec.lockedUntil) state.delete(username) // 锁定期满自动清除
  return null
}

// 记录一次登录失败：返回 { failures, locked, remainMs }
// failures 为当前连续失败次数（锁定后重新从 0 计）
function recordFailure(username) {
  if (!username) return { failures: 0, locked: false, remainMs: 0 }
  const rec = state.get(username) || { failures: 0, lockedUntil: 0 }
  rec.failures += 1
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCK_MS
    rec.failures = 0
  }
  state.set(username, rec)
  return {
    failures: rec.failures,
    locked: rec.lockedUntil > Date.now(),
    remainMs: rec.lockedUntil > Date.now() ? rec.lockedUntil - Date.now() : 0
  }
}

// 登录成功清零（含扫码登录成功）
function reset(username) {
  if (username) state.delete(username)
}

module.exports = { checkLocked, recordFailure, reset, MAX_FAILURES, LOCK_MS }
