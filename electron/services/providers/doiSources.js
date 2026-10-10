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

module.exports = {
  doiSources: [crossref, openalex, semanticScholar],
  authorsOf,
  normDoi
}
