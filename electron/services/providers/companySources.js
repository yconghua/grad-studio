/**
 * 公司搜索 · 数据源（工商源 + 招聘源）
 *
 * 均需用户自备 Key（天眼查/企查查免费额度有限；Coresignal/Apify 为付费订阅），
 * 未配置 Key 的源不参与请求；端点以服务商公开文档为准，认证/订阅受限时降级提示。
 * 统一返回 items：{ name, creditCode, legalPerson, capital, established, industry,
 *   scale, location, financeStage, status, business, intro, website, careersUrl, jobUrls[] }
 */
const { fetchJson } = require('./http')

const tianyancha = {
  name: 'tianyancha',
  label: '天眼查',
  requiresKey: true,
  keyName: 'tianyancha',
  async fetch(params, ctx) {
    const token = ctx && ctx.keys && ctx.keys.tianyancha
    if (!token) return { items: [], error: '未配置 Key' }
    const url = `https://open.tianyancha.com/services/open/ic/baseinfo/2.0?keyword=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url, { headers: { token } })
    if (!r.ok) return { items: [], error: r.error }
    const d = r.data
    if (d.error_code && d.error_code !== 0) return { items: [], error: d.reason || '接口返回错误' }
    const data = d.data || {}
    return {
      items: [{
        name: data.name || params.keyword,
        creditCode: data.creditCode || data.credit_code || '',
        legalPerson: data.legalPersonName || data.legal_person || '',
        capital: data.regCapital || data.reg_capital || '',
        established: data.estiblishTime || data.established || '',
        industry: data.industry || '',
        scale: data.companyType || data.company_type || '',
        location: [data.regLocation, data.province, data.city].filter(Boolean).join(' ') || '',
        financeStage: data.phase || '',
        status: data.regStatus || data.reg_status || '',
        business: data.businessScope || data.business_scope || '',
        intro: data.humanInfo || data.intro || '',
        website: data.websiteList ? (data.websiteList[0] || '') : (data.website || ''),
        careersUrl: '',
        source: '天眼查'
      }]
    }
  }
}

const qichacha = {
  name: 'qichacha',
  label: '企查查',
  requiresKey: true,
  keyName: 'qichacha',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.qichacha
    const secretKey = ctx && ctx.keys && ctx.keys.qichachaSecret
    if (!key || !secretKey) return { items: [], error: '未配置 Key / 密钥' }
    const url = `http://api.qichacha.com/ECIV4/SearchDetails?keyword=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url, { headers: { Key: key, SecretKey: secretKey } })
    if (!r.ok) return { items: [], error: r.error }
    const d = r.data
    if (d.Status !== '200') return { items: [], error: d.Message || '接口返回错误' }
    const data = d.Result || d.Data || {}
    return {
      items: [{
        name: data.Name || params.keyword,
        creditCode: data.CreditCode || '',
        legalPerson: data.OperName || data.LegalPerson || '',
        capital: data.RegCapital || '',
        established: data.StartDate || data.EstablishDate || '',
        industry: data.Industry || '',
        scale: data.CompanyType || data.Employees || '',
        location: data.Address || [data.Province, data.City].filter(Boolean).join(' '),
        financeStage: data.FinanceStage || '',
        status: data.Status || data.RegStatus || '',
        business: data.BusinessScope || data.Business || '',
        intro: data.Intro || '',
        website: data.WebSite || data.Website || '',
        careersUrl: '',
        source: '企查查'
      }]
    }
  }
}

const coresignal = {
  name: 'coresignal',
  label: 'Coresignal（招聘）',
  requiresKey: true,
  keyName: 'coresignal',
  async fetch() {
    // Coresignal 为付费订阅 API（无公开免费端点），配置 Key 后按订阅范围调用
    return { items: [], error: 'Coresignal 为付费订阅服务，需在服务商后台开通对应数据集后使用' }
  }
}

const apify = {
  name: 'apify',
  label: 'Apify（招聘监控）',
  requiresKey: true,
  keyName: 'apify',
  async fetch() {
    // Apify 需指定 Actor 与 Token 组合，通用端点无法静态构造，配置 Key 后仍可能需按 Actor 定制
    return { items: [], error: 'Apify 需指定招聘监控 Actor 与 Token，请在服务商后台确认后使用' }
  }
}

module.exports = { companySources: [tianyancha, qichacha, coresignal, apify] }
