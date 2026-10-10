/**
 * DOI 文献信息查询 · 数据源（CrossRef / OpenAlex / Semantic Scholar）
 *
 * 免 Key 免费源，默认全部启用：
 *   - CrossRef：元数据最全（含引用数、参考文献数、撤稿 assertion）；
 *   - OpenAlex：摘要（倒排索引还原）、机构、概念、OA 状态；
 *   - Semantic Scholar：摘要、影响力、引用数（可选 Key 提额）。
 * Retraction Watch 撤稿标记通过 CrossRef 的 assertion 字段整合（不单独成源）。
 * 各源统一接口：{ name, label, requiresKey, keyName, fetch(params, ctx) → { items } }
 * 返回 items 统一结构（字段缺失置空，由 service 合并补全）。
 */
const { fetchJson, restoreAbstract } = require('./http')

function authorsOf(list) {
  return (list || []).map((a) => {
    const n = a.name || [a.given, a.family].filter(Boolean).join(' ')
    const orcid = (a.ORCID || '').replace('http://orcid.org/', '')
    return { name: n, orcid: orcid || '' }
  })
}

function normDoi(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
  return s.toLowerCase()
}

const crossref = {
  name: 'crossref',
  label: 'CrossRef',
  requiresKey: false,
  async fetch(params) {
    const doi = normDoi(params.doi)
    const url = doi
      ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
      : `https://api.crossref.org/works?rows=${params.limit || 3}&select=DOI,title,author,container-title,published,volume,issue,page,abstract,is-referenced-by-count,reference-count,URL,publisher,assertion&${params.title ? `query.title=${encodeURIComponent(params.title)}` : `query.bibliographic=${encodeURIComponent(params.pmid || '')}`}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const msg = r.data.message
    const list = Array.isArray(msg) ? msg : [msg]
    const items = list.filter(Boolean).map((m) => {
      const year = ((m['published-print'] || m['published-online'] || m['issued'] || {})['date-parts'] || [])[0]
      let retracted = false
      let retractionReason = ''
      for (const a of m.assertion || []) {
        if (String(a.name || '').toLowerCase().includes('retract')) {
          retracted = true
          retractionReason = a.value || ''
        }
      }
      return {
        doi: normDoi(m.DOI),
        title: (m.title && m.title[0]) || '',
        authors: authorsOf(m.author),
        venue: (m['container-title'] && m['container-title'][0]) || m.publisher || '',
        publisher: m.publisher || '',
        year: year ? year[0][0] : null,
        volume: m.volume || '',
        issue: m.issue || '',
        pages: m.page || '',
        abstract: m.abstract ? m.abstract.replace(/<[^>]+>/g, '') : '',
        citedBy: m['is-referenced-by-count'] || 0,
        referencesCount: m['reference-count'] || 0,
        url: m.URL || (m.DOI ? `https://doi.org/${m.DOI}` : ''),
        retracted,
        retractionReason
      }
    })
    return { items, meta: { doiMatched: !!doi } }
  }
}

const openalex = {
  name: 'openalex',
  label: 'OpenAlex',
  requiresKey: false,
  async fetch(params) {
    const doi = normDoi(params.doi)
    const url = doi
      ? `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`
      : `https://api.openalex.org/works?per-page=${params.limit || 3}&search=${encodeURIComponent(params.title || params.pmid || '')}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = doi ? [r.data] : (r.data.results || [])
    const items = list.filter(Boolean).map((w) => ({
      doi: normDoi((w.doi || '').replace('https://doi.org/', '')),
      title: w.title || '',
      authors: (w.authorships || []).map((a) => ({ name: (a.author && a.author.display_name) || '', orcid: (a.author && a.author.orcid || '').replace('https://orcid.org/', '') })),
      venue: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '',
      publisher: (w.primary_location && w.primary_location.source && w.primary_location.source.host_organization_name) || '',
      year: w.publication_year || null,
      volume: w.biblio && w.biblio.volume || '',
      issue: w.biblio && w.biblio.issue || '',
      pages: w.biblio ? [w.biblio.first_page, w.biblio.last_page].filter(Boolean).join('-') : '',
      abstract: restoreAbstract(w.abstract_inverted_index),
      citedBy: w.cited_by_count || 0,
      referencesCount: (w.referenced_works || []).length,
      url: w.doi || '',
      concepts: (w.concepts || []).map((c) => c.display_name),
      oaStatus: (w.open_access && w.open_access.oa_status) || ''
    }))
    return { items }
  }
}

const semanticScholar = {
  name: 'semanticScholar',
  label: 'Semantic Scholar',
  requiresKey: false,
  keyName: 'semanticScholar', // 可选：配置后走带 Key 的端点提额
  async fetch(params, ctx) {
    const doi = normDoi(params.doi)
    const key = ctx && ctx.keys && ctx.keys.semanticScholar
    const headers = key ? { 'x-api-key': key } : {}
    const fields = 'title,abstract,authors,year,venue,citationCount,referenceCount,externalIds,url,publicationVenue,openAccessPdf'
    const url = doi
      ? `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=${fields}`
      : `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(params.title || params.pmid || '')}&limit=${params.limit || 3}&fields=${fields}`
    const r = await fetchJson(url, { headers })
    if (!r.ok) return { items: [], error: r.error }
    const list = doi ? [r.data] : (r.data.data || [])
    const items = list.filter(Boolean).map((p) => ({
      doi: normDoi((p.externalIds && p.externalIds.DOI) || ''),
      title: p.title || '',
      authors: (p.authors || []).map((a) => ({ name: a.name, orcid: a.authorId || '' })),
      venue: p.venue || (p.publicationVenue && p.publicationVenue.name) || '',
      year: p.year || null,
      abstract: p.abstract || '',
      citedBy: p.citationCount || 0,
      referencesCount: p.referenceCount || 0,
      url: p.url || (p.externalIds && p.externalIds.DOI ? `https://doi.org/${p.externalIds.DOI}` : ''),
      openAccessPdf: p.openAccessPdf && p.openAccessPdf.url || ''
    }))
    return { items }
  }
}

// Europe PMC：生物医学文献 + 预印本，免 Key；支持 DOI 精确与标题模糊查询
const europePmc = {
  name: 'europePmc',
  label: 'Europe PMC',
  requiresKey: false,
  async fetch(params) {
    const doi = normDoi(params.doi)
    const q = doi ? `DOI:"${doi}"` : `TITLE:"${encodeURIComponent(String(params.title || params.pmid || '').replace(/"/g, ' '))}"`
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=${params.limit || 3}&resultType=core`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const items = ((r.data.resultList && r.data.resultList.result) || []).map((it) => {
      const journal = (it.journalInfo && it.journalInfo.journal) || {}
      const fullText = (it.fullTextUrlList && it.fullTextUrlList.fullTextUrl) || []
      return {
        doi: normDoi(it.doi),
        title: it.title || '',
        authors: (it.authorList && it.authorList.author || []).map((a) => ({ name: a.fullName || '', orcid: a.orcid || '' })),
        venue: journal.title || '',
        publisher: journal.publisher || '',
        year: it.pubYear || journal.year || null,
        volume: journal.volume || '',
        issue: journal.issue || '',
        pages: it.pageInfo || '',
        abstract: it.abstractText || '',
        citedBy: it.citedByCount || 0,
        referencesCount: 0,
        url: it.url || (it.id ? `https://europepmc.org/article/${it.source}/${it.id}` : ''),
        openAccessPdf: (fullText.find((f) => f.documentStyle === 'pdf') || {}).url || '',
        oaStatus: it.isOpenAccess ? 'oa' : 'closed',
        pmid: it.pmid || '',
        pmcid: it.pmcid || ''
      }
    })
    return { items }
  }
}

// DataCite：研究数据/软件 DOI，免 Key；JSON:API 格式
const datacite = {
  name: 'datacite',
  label: 'DataCite',
  requiresKey: false,
  async fetch(params) {
    const doi = normDoi(params.doi)
    const url = doi
      ? `https://api.datacite.org/dois/${encodeURIComponent(doi)}`
      : `https://api.datacite.org/dois?query=title:${encodeURIComponent(params.title || params.pmid || '')}&page[size]=${params.limit || 3}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = doi ? [r.data] : ((r.data && r.data.data) || [])
    const items = list.filter(Boolean).map((d) => {
      const a = d.attributes || {}
      return {
        doi: normDoi(a.doi || d.id),
        title: (a.titles && a.titles[0] && a.titles[0].title) || '',
        authors: (a.creators || []).map((c) => ({ name: c.name || '', orcid: (c.nameIdentifiers && c.nameIdentifiers[0] && c.nameIdentifiers[0].nameIdentifier) || '' })),
        venue: (a.container && a.container.title) || '',
        publisher: a.publisher || '',
        year: a.publicationYear ? Number(a.publicationYear) : null,
        volume: (a.container && a.container.volume) || '',
        issue: (a.container && a.container.issue) || '',
        pages: (a.container && a.container.firstPage) ? [a.container.firstPage, a.container.lastPage].filter(Boolean).join('-') : '',
        abstract: '',
        citedBy: 0,
        referencesCount: 0,
        url: a.url || (a.doi ? `https://doi.org/${a.doi}` : ''),
        resourceType: (a.types && a.types.resourceTypeGeneral) || ''
      }
    })
    return { items }
  }
}

// OpenCitations（COCI）：引文索引，免 Key；仅支持 DOI 精确查询
const opencitations = {
  name: 'opencitations',
  label: 'OpenCitations',
  requiresKey: false,
  async fetch(params) {
    const doi = normDoi(params.doi)
    if (!doi) return { items: [], error: 'OpenCitations 仅支持 DOI 精确查询' }
    const url = `https://opencitations.net/index/coci/api/v1/metadata/${encodeURIComponent(doi)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const list = Array.isArray(r.data) ? r.data : []
    const items = list.map((m) => ({
      doi: normDoi(m.doi),
      title: m.title || '',
      authors: String(m.author || '').split(';').map((n) => ({ name: n.trim() })).filter((a) => a.name),
      venue: m.venue || '',
      publisher: m.publisher || '',
      year: m.year ? Number(m.year) : null,
      volume: m.volume || '',
      issue: m.issue || '',
      pages: m.page || '',
      abstract: '',
      citedBy: 0,
      referencesCount: 0,
      url: m.doi ? `https://doi.org/${m.doi}` : ''
    }))
    return { items }
  }
}

// Unpaywall：OA 全文定位，免费（需邮箱注册 Key）；仅支持 DOI 精确查询
const unpaywall = {
  name: 'unpaywall',
  label: 'Unpaywall（OA 全文）',
  requiresKey: true,
  keyName: 'unpaywall',
  async fetch(params, ctx) {
    const email = ctx && ctx.keys && ctx.keys.unpaywall
    if (!email) return { items: [], error: '未配置 Key（邮箱）' }
    const doi = normDoi(params.doi)
    if (!doi) return { items: [], error: 'Unpaywall 仅支持 DOI 精确查询' }
    const r = await fetchJson(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`)
    if (!r.ok) return { items: [], error: r.error }
    const d = r.data
    const best = d.best_oa_location || {}
    const item = {
      doi: normDoi(d.doi),
      title: d.title || '',
      authors: (d.authors || []).map((a) => ({ name: [a.given, a.family].filter(Boolean).join(' '), orcid: a.orcid || '' })),
      venue: d.journal_name || '',
      year: d.year ? Number(d.year) : null,
      abstract: '',
      citedBy: 0,
      referencesCount: 0,
      url: d.url || (d.doi ? `https://doi.org/${d.doi}` : ''),
      openAccessPdf: best.url_for_pdf || '',
      oaStatus: d.is_oa ? 'oa' : 'closed'
    }
    return { items: [item] }
  }
}

// Lens.org：学术 + 专利一体，免费（需个人 access token）；按 DOI 外部 ID 匹配
const lens = {
  name: 'lens',
  label: 'Lens.org',
  requiresKey: true,
  keyName: 'lens',
  async fetch(params, ctx) {
    const token = ctx && ctx.keys && ctx.keys.lens
    if (!token) return { items: [], error: '未配置 Key（token）' }
    const doi = normDoi(params.doi)
    if (!doi) return { items: [], error: 'Lens 仅支持 DOI 精确查询' }
    const body = JSON.stringify({
      query: { match: { 'external_ids.value': doi } },
      size: 1
    })
    const r = await fetchJson('https://api.lens.org/scholarly/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body
    })
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && r.data.data) || []).map((w) => ({
      doi: normDoi((w.external_ids || []).find((x) => x.type === 'doi') && (w.external_ids.find((x) => x.type === 'doi').value)),
      title: w.title || '',
      authors: (w.creator || []).map((c) => ({ name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '), orcid: c.orcid || '' })),
      venue: (w.source && w.source.name) || '',
      publisher: (w.source && w.source.publisher) || '',
      year: w.date_published ? Number(String(w.date_published).slice(0, 4)) : null,
      abstract: w.abstract_text || '',
      citedBy: w.citation_count || 0,
      referencesCount: 0,
      url: w.url || '',
      oaStatus: w.is_open_access ? 'oa' : 'closed'
    }))
    return { items: list }
  }
}

// Scopus：Elsevier 文献元数据，付费（需 API Key，机构订阅范围受限）
const scopus = {
  name: 'scopus',
  label: 'Scopus',
  requiresKey: true,
  keyName: 'scopus',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.scopus
    if (!key) return { items: [], error: '未配置 Key' }
    const doi = normDoi(params.doi)
    const q = doi ? `DOI(${doi})` : `TITLE(${encodeURIComponent(params.title || params.pmid || '')})`
    const url = `https://api.elsevier.com/content/search/scopus?query=${q}&apiKey=${encodeURIComponent(key)}`
    const r = await fetchJson(url, { headers: { 'X-ELS-APIKey': key } })
    if (!r.ok) return { items: [], error: r.error }
    const list = ((r.data && r.data['search-results'] && r.data['search-results'].entry) || []).filter(Boolean)
    const items = list.map((e) => {
      const link = (e.link || []).find((l) => l['@ref'] === 'scopus')
      return {
        doi: normDoi(e['prism:doi']),
        title: e['dc:title'] || '',
        authors: e['dc:creator'] ? [{ name: e['dc:creator'] }] : [],
        venue: e['prism:publicationName'] || '',
        year: e['prism:coverDate'] ? Number(String(e['prism:coverDate']).slice(0, 4)) : null,
        volume: e['prism:volume'] || '',
        issue: e['prism:issueIdentifier'] || '',
        pages: e['prism:pageRange'] || '',
        abstract: '',
        citedBy: Number(e['citedby-count']) || 0,
        referencesCount: 0,
        url: (link && link['@href']) || (e['prism:doi'] ? `https://doi.org/${e['prism:doi']}` : '')
      }
    })
    return { items }
  }
}

module.exports = {
  doiSources: [crossref, openalex, semanticScholar, europePmc, datacite, opencitations, unpaywall, lens, scopus],
  authorsOf,
  normDoi
}
