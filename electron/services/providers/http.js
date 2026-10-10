/**
 * 工具箱统一外网请求（主进程代理出口）
 *
 * 渲染层不直连外网；所有联网工具统一走此模块：
 *   - Electron 主进程全局 fetch + AbortController 独立超时；
 *   - 统一 User-Agent（CrossRef 等学术源要求标识调用方）；
 *   - 返回 { ok, status, data, text, costMs }，异常不抛出（由调用方按降级处理）。
 */
const UA = 'GradStudio-Toolbox/3.2.0 (mailto:toolbox@gradstudio.local)'

async function fetchRaw(url, { method = 'GET', headers = {}, body, timeout = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      body,
      signal: controller.signal
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text, costMs: Date.now() - t0 }
  } catch (e) {
    const timedOut = e && e.name === 'AbortError'
    return { ok: false, status: 0, text: '', costMs: Date.now() - t0, error: timedOut ? '请求超时' : (e && e.message) || '网络错误' }
  } finally {
    clearTimeout(timer)
  }
}

/** 请求 JSON：成功且能解析返回 { ok:true, data, costMs }，否则 { ok:false, error, costMs } */
async function fetchJson(url, opts) {
  const raw = await fetchRaw(url, opts)
  if (!raw.ok || !raw.text) {
    return { ok: false, costMs: raw.costMs, error: raw.error || `请求失败(HTTP ${raw.status || '-'})` }
  }
  try {
    const data = JSON.parse(raw.text)
    return { ok: true, data, costMs: raw.costMs }
  } catch (e) {
    return { ok: false, costMs: raw.costMs, error: '返回内容不是有效JSON' }
  }
}

/** OpenAlex 摘要倒排索引还原为纯文本 */
function restoreAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return ''
  const posMap = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const p of positions) posMap[p] = word
  }
  return posMap.filter(Boolean).join(' ')
}

module.exports = { fetchJson, fetchRaw, restoreAbstract }
