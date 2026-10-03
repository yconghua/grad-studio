/**
 * 周报周计算工具（ISO-8601，周一为一周开始）
 *
 * 时区约定：全部基于服务器本地时区（与现有 DATETIME 存储一致，dateStrings=true
 * 返回本地时间字符串），week_key 由服务端计算，客户端不传。
 *
 * 常用能力：
 *   - currentWeekKey()          当前周 key，如 '2026-40'
 *   - weekLabelOf(key)          显示文案，如 '2026年第40周（09-28~10-04）'
 *   - mondayOf(key)             该周周一 00:00（本地时间）
 *   - weeksBetween(from, to)    两个周 key 的周差（绝对值）
 *   - isLate(submittedAt, key)  提交时间是否晚于该周周一 00:00（补交判定）
 */

// 求某个日期的 ISO 周年份 + 周号（本地时间）
function isoWeekOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNum = d.getDay() || 7 // 周日=7，周一=1
  // 移到本周四（ISO 定义：包含周四的周即为该年第一周所属周）
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { year: d.getFullYear(), week: weekNo }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// 当前周 key：'2026-40'
function currentWeekKey(now) {
  const d = now || new Date()
  const { year, week } = isoWeekOf(d)
  return `${year}-${pad2(week)}`
}

// 由 year+week 求该周周一 00:00（本地时间）
function mondayOfYearWeek(year, week) {
  // 该年第一周的周一：1月4日所在周的周一
  const jan4 = new Date(year, 0, 4)
  const day = jan4.getDay() || 7
  const firstMonday = new Date(year, 0, 4 - (day - 1))
  firstMonday.setHours(0, 0, 0, 0)
  return new Date(firstMonday.getTime() + (week - 1) * 7 * 86400000)
}

// 解析 '2026-40' → { year, week }
function parseKey(key) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(key || ''))
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (week < 1 || week > 53) return null
  return { year, week }
}

// 周 key → 该周周一 00:00（本地时间）；非法 key 返回 null
function mondayOf(key) {
  const p = parseKey(key)
  if (!p) return null
  return mondayOfYearWeek(p.year, p.week)
}

// 周 key → 显示文案：'2026年第40周（09-28~10-04）'
function weekLabelOf(key) {
  const p = parseKey(key)
  if (!p) return String(key || '')
  const monday = mondayOfYearWeek(p.year, p.week)
  const sunday = new Date(monday.getTime() + 6 * 86400000)
  const fmt = (d) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  return `${p.year}年第${p.week}周（${fmt(monday)}~${fmt(sunday)}）`
}

// 默认标题：'2026年第40周周报'
function defaultTitle(key) {
  const p = parseKey(key)
  if (!p) return '周报'
  return `${p.year}年第${p.week}周周报`
}

// 两个周 key 的周差（绝对值，非法 key 返回 -1）
function weeksBetween(a, b) {
  const pa = parseKey(a)
  const pb = parseKey(b)
  if (!pa || !pb) return -1
  const deltaYears = pb.year - pa.year
  const wa = pa.week + deltaYears * 52
  const wb = pb.week
  return Math.abs(wb - wa)
}

// 指定周相对当前周的带符号周差：正数=未来，0=本周，负数=过去（补交窗口判定用）
function weekDiffFromCurrent(key) {
  const cur = mondayOf(currentWeekKey())
  const target = mondayOf(key)
  if (!cur || !target) return null
  return Math.round((target.getTime() - cur.getTime()) / (7 * 86400000))
}

// 补交判定：submittedAt（'YYYY-MM-DD HH:mm:ss' 或 Date）是否晚于该周周一 00:00
function isLate(submittedAt, weekKey) {
  const monday = mondayOf(weekKey)
  if (!monday) return false
  const t = submittedAt instanceof Date ? submittedAt : new Date(String(submittedAt).replace(/-/g, '/'))
  if (Number.isNaN(t.getTime())) return false
  return t.getTime() >= monday.getTime()
}

// 'YYYY-MM-DD' → 本地 00:00 Date（供提醒日期判断）
function parseDateOnly(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

module.exports = {
  isoWeekOf,
  currentWeekKey,
  weekLabelOf,
  defaultTitle,
  mondayOf,
  mondayOfYearWeek,
  parseKey,
  weeksBetween,
  weekDiffFromCurrent,
  isLate,
  parseDateOnly
}
