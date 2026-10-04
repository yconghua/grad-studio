/**
 * 验证码服务（Service Layer）—— 图形验证码生成与校验
 *
 * 桌面单窗口场景：验证码只存主进程内存，不落库。
 * 规则：
 *   - 4 位字符，排除易混淆字形（0/O、1/I/L），大小写不敏感；
 *   - 5 分钟过期，一次一码（校验通过即作废）；
 *   - 连续登录失败 ≥3 次后强制要求验证码（自适应防爆破）。
 */
const crypto = require('node:crypto')

// 可读字符集：排除易混淆的 0/O、1/I/L
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 4
const TTL_MS = 5 * 60 * 1000
const FAIL_THRESHOLD = 3

// captchaId -> { code, expiresAt }
const store = new Map()
// 连续登录失败次数（登录成功后清零）
let failCount = 0

function randomInt(max) {
  return crypto.randomInt(0, max)
}

function randomChar() {
  return CHARS[randomInt(CHARS.length)]
}

// 生成干扰线与噪点，降低 OCR / 截图识别成功率（简单防线，非安全级）
function buildSvg(code) {
  const width = 120
  const height = 40
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`)
  parts.push(`<rect width="${width}" height="${height}" fill="#eef2f7"/>`)
  // 干扰线
  for (let i = 0; i < 3; i++) {
    const x1 = randomInt(width)
    const y1 = randomInt(height)
    const x2 = randomInt(width)
    const y2 = randomInt(height)
    const color = `rgb(${randomInt(160)},${randomInt(160)},${randomInt(160)})`
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.2"/>`)
  }
  // 噪点
  for (let i = 0; i < 18; i++) {
    const x = randomInt(width)
    const y = randomInt(height)
    const r = Math.random() * 1.6 + 0.4
    parts.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="rgba(90,110,140,0.6)"/>`)
  }
  // 字符：逐个错位 + 旋转 + 随机色
  const slot = width / (CODE_LENGTH + 1)
  for (let i = 0; i < code.length; i++) {
    const x = slot * (i + 1) + (Math.random() * 8 - 4)
    const y = 26 + Math.random() * 6
    const size = 22 + Math.random() * 4
    const angle = Math.random() * 30 - 15
    const color = `rgb(${randomInt(120)},${randomInt(120)},${randomInt(160)})`
    parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size.toFixed(1)}" font-family="Arial, sans-serif" font-weight="bold" fill="${color}" text-anchor="middle" transform="rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`
    )
  }
  parts.push('</svg>')
  return parts.join('')
}

// 生成一份验证码：返回 captchaId + SVG 字符串（答案仅存服务端内存）
function create() {
  // 惰性清理过期项，避免 Map 无限增长
  const now = Date.now()
  for (const [id, item] of store) {
    if (item.expiresAt <= now) store.delete(id)
  }
  const captchaId = crypto.randomUUID()
  const code = Array.from({ length: CODE_LENGTH }, randomChar).join('')
  store.set(captchaId, { code, expiresAt: now + TTL_MS })
  return { captchaId, svg: buildSvg(code) }
}

/**
 * 校验验证码：大小写不敏感；命中即作废（一次一码）；过期视为失败。
 * 校验结果不区分「不存在 / 过期 / 不匹配」，统一返回 false，避免探测有效 id。
 */
function verify(captchaId, code) {
  if (!captchaId || !code) return false
  const item = store.get(captchaId)
  if (!item) return false
  store.delete(captchaId)
  if (item.expiresAt <= Date.now()) return false
  return code.trim().toUpperCase() === item.code.toUpperCase()
}

// 连续失败次数 >= 阈值时要求验证码（自适应策略：正常用户前几次不被打扰）
function shouldRequireCaptcha() {
  return failCount >= FAIL_THRESHOLD
}

function recordFailure() {
  failCount++
}

function resetFailures() {
  failCount = 0
}

module.exports = { create, verify, shouldRequireCaptcha, recordFailure, resetFailures }
