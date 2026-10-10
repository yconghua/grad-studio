/**
 * 多源并行调度器 —— 工具箱五个工具的公共查询引擎
 *
 * 策略（与方案一致）：
 *   1. 可用源 = 免 Key 内置源 ∪ 设置中已配置 Key 且启用的需 Key 源；
 *   2. 并行请求（Promise.allSettled），每源独立 AbortController 超时；
 *   3. 某源失败/超时不影响其他源；
 *   4. 返回每源状态（ok/fail/timeout/skipped）+ 全部 items（含来源标注），
 *      合并去重与字段互补由各工具的 service 层按业务定制。
 *
 * 日志：本模块不写库，只返回 states，由 toolService 统一落 tool_source_logs。
 */
const SOURCE_REGISTRY = {
  doi: require('./doiSources').doiSources,
  journal: require('./journalSources').journalSources,
  search: require('./searchSources').searchSources,
  translate: require('./translateSources').translateSources,
  company: require('./companySources').companySources
}

/**
 * @param {string} tool doi|journal|search|translate|company
 * @param {Object} params 查询参数（各源 fetch 共用）
 * @param {Object} keys 已解密 Key 映射 {source: value}
 * @param {number} timeout 每源超时毫秒，默认 8000
 * @returns {Promise<{ items:Array, states:Array, warnings:string[] }>}
 */
async function runMultiSources(tool, params, keys = {}, timeout = 8000) {
  const sources = SOURCE_REGISTRY[tool] || []
  const results = await Promise.allSettled(sources.map(async (s) => {
    const available = s.requiresKey ? Boolean(keys && keys[s.keyName]) : true
    const state = {
      name: s.name,
      label: s.label,
      requiresKey: s.requiresKey,
      keyName: s.keyName || '',
      status: 'ok',
      costMs: 0,
      resultCount: 0,
      error: ''
    }
    if (!available) {
      state.status = 'skipped'
      state.error = '未配置 Key'
      return { state, items: [] }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const t0 = Date.now()
    try {
      const ctx = { keys, signal: controller.signal }
      const out = await s.fetch(params, ctx)
      state.costMs = Date.now() - t0
      const items = (out && out.items) || []
      state.resultCount = items.length
      if (out && out.error) {
        state.status = 'fail'
        state.error = out.error
      }
      return { state, items }
    } catch (e) {
      state.costMs = Date.now() - t0
      state.status = 'fail'
      state.error = (e && e.message) || '未知错误'
      return { state, items: [] }
    } finally {
      clearTimeout(timer)
    }
  }))

  const items = []
  const states = []
  const warnings = []
  for (const r of results) {
    const { state, items: part } = r.value || { state: { name: 'unknown', label: '未知', status: 'fail', costMs: 0, resultCount: 0, error: '调度异常' }, items: [] }
    // 超时归一：AbortError 统一显示为 timeout
    if (state.status === 'fail' && state.error === '请求超时') state.status = 'timeout'
    states.push(state)
    if (state.status === 'skipped') warnings.push(`${state.label}未配置 Key`)
    else if (state.status === 'fail') warnings.push(`${state.label}不可用`)
    for (const it of part) {
      it._source = it._source || state.label
      items.push(it)
    }
  }
  return { items, states, warnings }
}

module.exports = { runMultiSources, SOURCE_REGISTRY }
