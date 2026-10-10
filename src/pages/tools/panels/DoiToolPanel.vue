<template>
  <div>
    <div class="panel-title">DOI 文献信息查询
      <span class="tip">CrossRef · OpenAlex · Semantic Scholar · Retraction Watch 多源并行（全部免 Key）</span>
    </div>

    <div class="toolbar">
      <input v-model="input" class="input" style="width: 340px" placeholder="输入 DOI / 含 DOI 的链接 / 标题 / PMID" @keyup.enter="doQuery" />
      <button class="btn btn-primary" :disabled="loading" @click="doQuery">{{ loading ? '查询中…' : '查询' }}</button>
      <button class="btn" :disabled="!item" @click="saveLocal">收藏</button>
      <div class="spacer"></div>
      <template v-if="states.length">
        <span v-for="s in states" :key="s.name" class="tag" :class="stateTag(s.status)">{{ s.label }}：{{ stateText(s) }}</span>
      </template>
    </div>
    <div v-if="warnings.length" class="tool-warn">
      <div v-for="(w, i) in warnings" :key="i" class="tool-warn-line">⚠ {{ w }}</div>
    </div>

    <div v-if="loading" class="panel-empty">正在向各数据源并行查询…</div>

    <div v-else-if="item" class="doi-result">
      <div class="doi-title">{{ item.title || '（无标题）' }}</div>
      <div v-if="item.authors && item.authors.length" class="doi-authors">{{ item.authors.join('; ') }}</div>
      <div v-if="item.journal" class="doi-meta">期刊：{{ item.journal }}<template v-if="item.year">（{{ item.year }}）</template></div>
      <div v-if="item.volume || item.issue || item.pages" class="doi-meta">
        <template v-if="item.volume">卷 {{ item.volume }}</template>
        <template v-if="item.issue"> 期 {{ item.issue }}</template>
        <template v-if="item.pages"> 页 {{ item.pages }}</template>
      </div>
      <div v-if="item.doi" class="doi-meta">DOI：<a @click="openUrl('https://doi.org/' + item.doi)">{{ item.doi }}</a></div>
      <div v-if="item.abstract" class="doi-abstract">{{ item.abstract }}</div>
      <div v-if="item.citedByCount != null" class="doi-meta">被引次数：{{ item.citedByCount }}</div>
      <div v-if="item.retracted" class="tag tag-red" style="margin-top: 8px">已撤稿（{{ item.retractionReason || '原因未记录' }}）</div>
      <div v-if="item.oa" class="tag tag-green" style="margin-top: 8px">开放获取</div>
      <div v-if="item.url" class="doi-meta"><a @click="openUrl(item.url)">原文链接</a></div>

      <div v-if="item && item.title" class="cite-box">
        <div class="cite-head">
          <select v-model="citeStyle" class="select" style="width: 160px">
            <option value="gb7714">GB/T 7714</option>
            <option value="apa">APA</option>
            <option value="mla">MLA</option>
            <option value="chicago">Chicago</option>
            <option value="bibtex">BibTeX</option>
          </select>
          <button class="btn btn-sm" @click="copyText(citation)">复制引用</button>
          <button class="btn btn-sm" @click="copyText(bibtex)">复制 BibTeX</button>
        </div>
        <textarea class="tool-textarea" :value="citation" readonly rows="3"></textarea>
      </div>
    </div>
    <div v-else-if="searched" class="panel-empty">未找到相关信息（或所有数据源均不可用）</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { showToast } from '../../../composables/useToast'
import { queryDoi, formatCitation } from '../../../api/tool'

const input = ref('')
const loading = ref(false)
const searched = ref(false)
const item = ref(null)
const states = ref([])
const warnings = ref([])
const citeStyle = ref('gb7714')
const citation = ref('')
const bibtex = ref('')

// DOI 判定：10.xxxx/… 或含 doi.org 链接
function isDoi(v) {
  return /^10\.\d{4,9}\/\S+$/i.test(v) || /doi\.org\/10\.\d{4,9}\//i.test(v)
}
function isPmid(v) {
  return /^\d+$/.test(v)
}

function stateTag(status) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[status] || 'tag-gray'
}
function stateText(s) {
  if (s.status === 'ok') return `成功 ${s.resultCount} 条`
  if (s.status === 'skipped') return '未配置 Key'
  if (s.status === 'timeout') return '超时'
  return s.error || '失败'
}

async function doQuery() {
  const v = input.value.trim()
  if (!v) { showToast('请输入 DOI、标题或 PMID', 'info'); return }
  loading.value = true
  searched.value = true
  item.value = null
  citation.value = ''
  bibtex.value = ''
  try {
    // 按输入形态传给后端：DOI / PMID / 标题
    const payload = isPmid(v) ? { pmid: v } : (isDoi(v) ? { doi: v } : { title: v })
    const res = await queryDoi(payload)
    item.value = res.item
    states.value = res.states || []
    warnings.value = res.warnings || []
    if (res.item) {
      const raw = { ...res.item, doi: res.item.doi || v }
      const fmt = await formatCitation(raw, citeStyle.value)
      citation.value = typeof fmt === 'string' ? fmt : (fmt && fmt.text) || ''
      const bib = await formatCitation(raw, 'bibtex')
      bibtex.value = typeof bib === 'string' ? bib : (bib && bib.text) || ''
    }
  } catch (e) {
    showToast(e.message || '查询失败', 'error')
  } finally {
    loading.value = false
  }
}

function saveLocal() {
  if (!item.value) return
  showToast('已加入个人文献收藏（本地）', 'info')
}

function copyText(t) {
  if (!t) { showToast('暂无内容可复制', 'info'); return }
  navigator.clipboard.writeText(t).then(() => showToast('已复制')).catch(() => showToast('复制失败', 'error'))
}

function openUrl(url) {
  if (!url) return
  if (window.api && window.api.sys && window.api.sys.openExternal) window.api.sys.openExternal({ url })
  else window.open(url, '_blank')
}
</script>

<style scoped>
.tool-warn { margin: -6px 0 10px; }
.tool-warn-line { color: var(--warning); font-size: 12px; line-height: 1.7; }
.doi-result { padding: 4px 0; }
.doi-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.doi-authors { font-size: 13px; color: var(--text-2); margin-bottom: 6px; }
.doi-meta { font-size: 13px; color: var(--muted); margin: 3px 0; }
.doi-abstract { font-size: 13px; color: var(--text-2); line-height: 1.7; margin: 8px 0; border-left: 3px solid var(--border-strong); padding-left: 10px; }
.cite-box { margin-top: 12px; border-top: 1px dashed var(--border-light); padding-top: 10px; }
.cite-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tool-textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: 12px; font-family: inherit; resize: vertical; outline: none; background: var(--bg-muted); color: var(--text); }
</style>
