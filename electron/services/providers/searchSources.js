/**
 * 学术搜索聚合 · 数据源（CrossRef / OpenAlex / arXiv / PubMed / Semantic Scholar）
 *
 * 全部免 Key（PubMed / Semantic Scholar 可配 Key 提额，选填）：
 *   - CrossRef：query.title 全学科元数据；
 *   - OpenAlex：search 全文检索；
 *   - arXiv：Atom 接口，覆盖预印本；
 *   - PubMed：esearch + esummary，生物医学；
 *   - Semantic Scholar：search 端点（限速较严，可选 Key）。
 * 统一返回 items：{ doi, title, authors[], venue, year, abstract, citedBy, url, source }
 */
const { fetchJson, fetchRaw, restoreAbstract } = require('./http')
const { normDoi } = require('./doiSources')

const crossref = {
  name: 'crossref',
  label: 'CrossRef',
  requiresKey: false,
  async fetch(params) {
    const rows = params.limit || 10
    const url = `https://api.crossref.org/works?rows=${rows}&select=DOI,title,author,container-title,published,abstract,is-referenced-by-count,URL,type&query.title=${encodeURIComponent(params.keyword)}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const items = (r.data.message.items || []).map((m) => {
      const year = ((m['published-print'] || m['published-online'] || {})['date-parts'] || [])[0]
      return {
        doi: normDoi(m.DOI),
        title: (m.title && m.title[0]) || '',
        authors: (m.author || []).map((a) => a.name || [a.given, a.family].filter(Boolean).join(' ')),
        venue: (m['container-title'] && m['container-title'][0]) || '',
        year: year ? year[0] : null,
        abstract: m.abstract ? m.abstract.replace(/<[^>]+>/g, '') : '',
        citedBy: m['is-referenced-by-count'] || 0,
        url: m.URL || (m.DOI ? `https://doi.org/${m.DOI}` : ''),
        type: m.type || '',
        source: 'CrossRef'
      }
    })
    return { items }
  }
}

const openalex = {
  name: 'openalex',
  label: 'OpenAlex',
  requiresKey: false,
  async fetch(params) {
    const per = params.limit || 10
    const url = `https://api.openalex.org/works?per-page=${per}&search=${encodeURIComponent(params.keyword)}&select=doi,title,authorships,publication_year,primary_location,abstract_inverted_index,cited_by_count,type,open_access`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    const items = (r.data.results || []).map((w) => ({
      doi: normDoi((w.doi || '').replace('https://doi.org/', '')),
      title: w.title || '',
      authors: (w.authorships || []).map((a) => (a.author && a.author.display_name) || ''),
      venue: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '',
      year: w.publication_year || null,
      abstract: restoreAbstract(w.abstract_inverted_index),
      citedBy: w.cited_by_count || 0,
      url: w.doi || '',
      type: w.type || '',
      oa: (w.open_access && w.open_access.oa_status) || '',
      source: 'OpenAlex'
    }))
    return { items }
  }
}

const arxiv = {
  name: 'arxiv',
  label: 'arXiv',
  requiresKey: false,
  async fetch(params) {
    const max = params.limit || 10
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(params.keyword)}&start=0&max_results=${max}`
    const raw = await fetchRaw(url)
    if (!raw.ok) return { items: [], error: raw.error || `请求失败(HTTP ${raw.status})` }
    const xml = raw.text
    const items = []
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g
    let m
    while ((m = entryRe.exec(xml))) {
      const block = m[1]
      const get = (tag) => { const t = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return t ? t[1].trim() : '' }
      const title = get('title').replace(/\s+/g, ' ').trim()
      const summary = get('summary').replace(/\s+/g, ' ').trim()
      const id = (get('id') || '').replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '')
      const authors = []
      const authorRe = /<name>([\s\S]*?)<\/name>/g
      let am
      while ((am = authorRe.exec(block))) authors.push(am[1].trim())
      const yearMatch = block.match(/<published>(\d{4})/)
      items.push({
        doi: '',
        title,
        authors,
        venue: 'arXiv',
        year: yearMatch ? Number(yearMatch[1]) : null,
        abstract: summary,
        citedBy: 0,
        url: id ? `https://arxiv.org/abs/${id}` : '',
        type: 'preprint',
        source: 'arXiv'
      })
    }
    return { items }
  }
}

const pubmed = {
  name: 'pubmed',
  label: 'PubMed',
  requiresKey: false,
  keyName: 'pubmed',
  async fetch(params, ctx) {
    const apiKey = (ctx && ctx.keys && ctx.keys.pubmed) ? `&api_key=${encodeURIComponent(ctx.keys.pubmed)}` : ''
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${params.limit || 10}&term=${encodeURIComponent(params.keyword)}${apiKey}`
    const sr = await fetchJson(searchUrl)
    if (!sr.ok) return { items: [], error: sr.error }
    const ids = (sr.data.esearchresult && sr.data.esearchresult.idlist) || []
    if (!ids.length) return { items: [] }
    const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`
    const ur = await fetchJson(sumUrl)
    if (!ur.ok) return { items: [], error: ur.error }
    const docs = (ur.data.result || {})
    const items = ids.map((id) => {
      const d = docs[id] || {}
      return {
        doi: '',
        title: d.title || '',
        authors: (d.authors || []).map((a) => a.name),
        venue: d.fulljournalname || d.source || '',
        year: d.pubdate ? Number(String(d.pubdate).slice(0, 4)) : null,
        abstract: '',
        citedBy: 0,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        pmid: id,
        type: 'journal-article',
        source: 'PubMed'
      }
    })
    return { items }
  }
}

const semanticScholar = {
  name: 'semanticScholar',
  label: 'Semantic Scholar',
  requiresKey: false,
  keyName: 'semanticScholar',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.semanticScholar
    const headers = key ? { 'x-api-key': key } : {}
    const fields = 'title,abstract,authors,year,venue,citationCount,externalIds,url'
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(params.keyword)}&limit=${params.limit || 10}&fields=${fields}`
    const r = await fetchJson(url, { headers })
    if (!r.ok) return { items: [], error: r.error }
    const items = (r.data.data || []).map((p) => ({
      doi: normDoi((p.externalIds && p.externalIds.DOI) || ''),
      title: p.title || '',
      authors: (p.authors || []).map((a) => a.name),
      venue: p.venue || '',
      year: p.year || null,
      abstract: p.abstract || '',
      citedBy: p.citationCount || 0,
      url: p.url || '',
      type: 'paper',
      source: 'Semantic Scholar'
    }))
    return { items }
  }
}

module.exports = { searchSources: [crossref, openalex, arxiv, pubmed, semanticScholar] }
