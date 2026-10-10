/**
 * 期刊信息查询 · 数据源（ShowJCR 本地数据集 / 聚合数据 / Web of Science）
 *
 *   - ShowJCR：开源数据集（GitHub 发布），随项目本地维护于 electron/data/jcr-data.json，
 *     数据文件缺失时该源标记不可用并提示导入路径（不编造数据）；
 *   - 聚合数据 JCR：需 Key（apis.juhe.cn/paper_info/search_jcr）；
 *   - Web of Science：需机构订阅/开发者 Key，无公开免 Key 端点，配置 Key 后仍可能不可用（降级提示）。
 * 统一返回 items：{ name, issn, eissn, publisher, impactFactor, jcrZone, casZone, casWarning, top, oa, ... }
 */
const fs = require('fs')
const path = require('path')
const { fetchJson } = require('./http')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const JCR_FILE = path.join(DATA_DIR, 'jcr-data.json')

// 本地 ShowJCR 数据集加载（启动时读一次；文件缺失返回 null，不抛错）
let jcrData = null
try {
  if (fs.existsSync(JCR_FILE)) {
    const raw = fs.readFileSync(JCR_FILE, 'utf8')
    jcrData = JSON.parse(raw)
  }
} catch (e) {
  console.error('[tool] ShowJCR 数据文件解析失败:', e.message)
  jcrData = null
}

function normIssn(raw) {
  if (!raw) return ''
  return String(raw).replace(/[^0-9Xx]/g, '').toUpperCase()
}

const showJcr = {
  name: 'showJcr',
  label: 'ShowJCR（本地数据集）',
  requiresKey: false,
  async fetch(params) {
    if (!jcrData || !Array.isArray(jcrData) || !jcrData.length) {
      return { items: [], error: `本地数据集未导入（请将 ShowJCR 数据放入 ${JCR_FILE} 后重启）` }
    }
    const q = String(params.keyword || '').trim().toLowerCase()
    const issn = normIssn(params.issn || q)
    let list = jcrData
    if (issn) {
      list = jcrData.filter((j) => normIssn(j.issn) === issn || normIssn(j.eissn) === issn)
    } else if (q) {
      list = jcrData.filter((j) => String(j.name || '').toLowerCase().includes(q))
    }
    const items = list.slice(0, 8).map((j) => ({
      name: j.name || '',
      issn: j.issn || '',
      eissn: j.eissn || '',
      publisher: j.publisher || '',
      impactFactor: j.if2024 || j.if2023 || j.if2022 || null,
      if2022: j.if2022 || null,
      if2023: j.if2023 || null,
      if2024: j.if2024 || null,
      casZone: j.cas_zone_upgrade || j.cas_zone_base || '',
      casZoneBase: j.cas_zone_base || '',
      casWarning: !!j.cas_warning,
      top: !!j.top,
      oa: j.is_oa || '',
      source: 'ShowJCR'
    }))
    return { items }
  }
}

const juheJcr = {
  name: 'juheJcr',
  label: '聚合数据 JCR',
  requiresKey: true,
  keyName: 'juheJcr',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.juheJcr
    if (!key) return { items: [], error: '未配置 Key' }
    const url = `https://apis.juhe.cn/paper_info/search_jcr?key=${encodeURIComponent(key)}&name=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const body = r.data
    if (body.error_code !== 0) return { items: [], error: body.reason || '接口返回错误' }
    const list = (body.result && body.result.list) || (Array.isArray(body.result) ? body.result : [])
    const items = list.map((j) => ({
      name: j.name || j.journal_name || '',
      issn: j.issn || '',
      eissn: j.eissn || '',
      publisher: j.publisher || '',
      impactFactor: j.impact_factor || j.if || null,
      jcrZone: j.jcr_zone || j.zone || '',
      casZone: j.cas_zone || '',
      casWarning: !!j.warning,
      top: !!j.top,
      source: '聚合数据'
    }))
    return { items }
  }
}

const webOfScience = {
  name: 'webOfScience',
  label: 'Web of Science',
  requiresKey: true,
  keyName: 'webOfScience',
  async fetch() {
    // WoS 无公开免 Key 端点，需机构订阅/开发者 Key；已配置 Key 时仍可能受订阅范围限制
    return { items: [], error: 'Web of Science 需机构订阅或开发者访问权限，当前环境不可用（请以其他数据源结果为准）' }
  }
}

module.exports = { journalSources: [showJcr, juheJcr, webOfScience] }
