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

// OpenCorporates：全球公司工商数据，免费（需注册获取 API token）
const openCorporates = {
  name: 'openCorporates',
  label: 'OpenCorporates',
  requiresKey: true,
  keyName: 'openCorporates',
  async fetch(params, ctx) {
    const token = ctx && ctx.keys && ctx.keys.openCorporates
    if (!token) return { items: [], error: '未配置 Key（token）' }
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(params.keyword)}&api_token=${encodeURIComponent(token)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && r.data.results && r.data.results.companies) || []).map((c) => c.company || {})
    const items = list.map((c) => ({
      name: c.name || params.keyword,
      creditCode: c.company_number || '',
      legalPerson: '',
      capital: '',
      established: c.incorporation_date || '',
      industry: c.company_type || '',
      scale: '',
      location: c.registered_address_in_full || c.jurisdiction_code || '',
      financeStage: '',
      status: c.current_status || '',
      business: '',
      intro: '',
      website: c.homepage_url || '',
      careersUrl: '',
      source: 'OpenCorporates'
    }))
    return { items }
  }
}

// Clearbit：公司简介/Logo，免费（需 Key；服务已迁移 HubSpot，可能受限）
const clearbit = {
  name: 'clearbit',
  label: 'Clearbit',
  requiresKey: true,
  keyName: 'clearbit',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.clearbit
    if (!key) return { items: [], error: '未配置 Key' }
    const url = `https://company.clearbit.com/v1/companies/search?query=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) return { items: [], error: r.error }
    const list = Array.isArray(r.data) ? r.data : []
    const items = list.map((c) => ({
      name: c.name || c.legalName || params.keyword,
      creditCode: '',
      legalPerson: '',
      capital: '',
      established: c.foundedYear ? String(c.foundedYear) : '',
      industry: c.category && c.category.industry || '',
      scale: (c.metrics && c.metrics.employees) ? `${c.metrics.employees} 人` : '',
      location: [c.location && c.location.city, c.location && c.location.country].filter(Boolean).join(' '),
      financeStage: '',
      status: '',
      business: c.description || '',
      intro: c.description || '',
      website: c.domain ? `https://${c.domain}` : (c.site && c.site.url) || '',
      careersUrl: '',
      source: 'Clearbit'
    }))
    return { items }
  }
}

// Adzuna：招聘聚合，免费（需 app_id + app_key）
const adzuna = {
  name: 'adzuna',
  label: 'Adzuna（招聘）',
  requiresKey: true,
  keyName: 'adzuna',
  async fetch(params, ctx) {
    const appId = ctx && ctx.keys && ctx.keys.adzunaAppId
    const appKey = ctx && ctx.keys && ctx.keys.adzunaKey
    if (!appId || !appKey) return { items: [], error: '未配置 app_id / app_key' }
    const country = 'gb'
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&what=${encodeURIComponent(params.keyword)}&content_type=application/json`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = (r.data && r.data.results) || []
    const items = list.map((j) => ({
      name: (j.company && j.company.display_name) || params.keyword,
      creditCode: '',
      legalPerson: '',
      capital: '',
      established: '',
      industry: j.category && j.category.label || '',
      scale: '',
      location: (j.location && j.location.area) || '',
      financeStage: '',
      status: '',
      business: String(j.description || '').slice(0, 200),
      intro: String(j.description || '').slice(0, 200),
      website: '',
      careersUrl: j.redirect_url || '',
      source: 'Adzuna'
    }))
    return { items }
  }
}

// Crunchbase：融资/团队，免费（需 user_key，限次）
const crunchbase = {
  name: 'crunchbase',
  label: 'Crunchbase',
  requiresKey: true,
  keyName: 'crunchbase',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.crunchbase
    if (!key) return { items: [], error: '未配置 Key（user_key）' }
    const url = `https://api.crunchbase.com/api/v4/entities/organizations/search?user_key=${encodeURIComponent(key)}`
    const r = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: [{ type: 'predicate', field: 'name', operator: 'eq', value: params.keyword }],
        limit: 5
      })
    })
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && r.data.entities) || []).map((e) => e.properties || {})
    const items = list.map((p) => ({
      name: p.name || p.legal_name || params.keyword,
      creditCode: '',
      legalPerson: '',
      capital: '',
      established: p.founded_on ? String(p.founded_on).slice(0, 4) : '',
      industry: (p.categories && p.categories.join('、')) || '',
      scale: p.num_employees_max ? `${p.num_employees_min || 0}-${p.num_employees_max} 人` : '',
      location: [p.city_name, p.country_code].filter(Boolean).join(' '),
      financeStage: p.funding_stage || '',
      status: '',
      business: p.short_description || '',
      intro: p.short_description || '',
      website: p.homepage_url || '',
      careersUrl: '',
      source: 'Crunchbase'
    }))
    return { items }
  }
}

// 启信宝：国内工商，付费（需开放平台 Key；端点以服务商文档为准，认证受限时降级）
const qixin = {
  name: 'qixin',
  label: '启信宝',
  requiresKey: true,
  keyName: 'qixin',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.qixin
    if (!key) return { items: [], error: '未配置 Key' }
    const url = `https://api.qixin.com/api/company/search?key=${encodeURIComponent(key)}&keyword=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && (r.data.data || r.data.result)) || [])
    const arr = Array.isArray(list) ? list : []
    const items = arr.map((d) => ({
      name: d.companyName || d.name || params.keyword,
      creditCode: d.creditCode || d.credit_code || '',
      legalPerson: d.legalPerson || d.legal_person || '',
      capital: d.regCapital || d.reg_capital || '',
      established: d.startDate || d.establishDate || d.established || '',
      industry: d.industry || '',
      scale: d.companyType || '',
      location: d.address || '',
      financeStage: '',
      status: d.status || d.regStatus || '',
      business: d.businessScope || d.business_scope || '',
      intro: d.intro || '',
      website: d.website || '',
      careersUrl: '',
      source: '启信宝'
    }))
    return { items }
  }
}

// 爱企查：需商务合作开通开放平台，无公开免 Key 端点，注册为源但提示不可用
const aiqicha = {
  name: 'aiqicha',
  label: '爱企查',
  requiresKey: true,
  keyName: 'aiqicha',
  async fetch() {
    return { items: [], error: '爱企查开放平台需商务合作开通并授权，当前环境不可用（请以其他数据源结果为准）' }
  }
}

module.exports = { companySources: [tianyancha, qichacha, coresignal, apify, openCorporates, clearbit, adzuna, crunchbase, qixin, aiqicha] }
