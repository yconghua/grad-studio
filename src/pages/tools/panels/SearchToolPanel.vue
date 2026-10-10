<template>
  <div>
    <div class="panel-title">学术搜索聚合
      <span class="tip">同时检索 CrossRef · OpenAlex · arXiv · PubMed · Semantic Scholar，结果合并去重</span>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input" style="width: 300px" placeholder="关键词 / 作者名 / 标题" @keyup.enter="doSearch" />
      <input v-model="yearFrom" type="number" class="input" style="width: 90px" placeholder="起始年" />
      <span class="muted-text">—</span>
      <input v-model="yearTo" type="number" class="input" style="width: 90px" placeholder="结束年" />
      <label class="chk"><input v-model="oaOnly" type="checkbox" /> 仅开放获取</label>
      <button class="btn btn-primary" :disabled="loading" @click="doSearch">{{ loading ? '搜索中…' : '搜索' }}</button>
      <div class="spacer"></div>
      <template v-if="states.length">
        <span v-for="s in states" :key="s.name" class="tag" :class="stateTag(s.status)">{{ s.label }}：{{ stateText(s) }}</span>
      </template>
    </div>
    <div v-if="warnings.length" class="tool-warn">
      <div v-for="(w, i) in warnings" :key="i" class="tool-warn-line">⚠ {{ w }}</div>
    </div>

    <div v-if="loading" class="panel-empty">正在向各学术数据源并行检索…</div>

    <div v-else-if="list.length" class="sr-list">
      <div v-for="(it, i) in list" :key="i" class="sr-item">
        <div class="sr-title">{{ it.title || '（无标题）' }}</div>
        <div v-if="it.authors && it.authors.length" class="sr-authors">{{ it.authors.slice(0, 10).join('; ') }}<template v-if="it.authors.length > 10"> 等</template></div>
        <div class="sr-meta">
          <span v-if="it.year">{{ it.year }}</span>
          <span v-if="it.sourceName" class="tag tag-gray">{{ it.sourceName }}</span>
          <span v-if="it.citedByCount != null">被引 {{ it.citedByCount }}</span>
          <span v-if="it.oa" class="tag tag-green">OA</span>
        </div>
        <div v-if="it.abstract" class="sr-abstract">{{ it.abstract }}</div>
        <div class="ops" style="margin-top: 6px">
          <button v-if="it.doi" class="btn btn-sm" @click="openUrl('https://doi.org/' + it.doi)">原文</button>
          <button v-if="it.url" class="btn btn-sm" @click="openUrl(it.url)">来源链接</button>
          <button class="btn btn-sm" @click="copyRef(it)">复制引用</button>
        </div>
      </div>
    </div>
    <div v-else-if="searched" class="panel-empty">未找到相关信息（或所有数据源均不可用）</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { showToast } from '../../../composables/useToast'
import { searchAcademic, formatCitation } from '../../../api/tool'

const keyword = ref('')
const yearFrom = ref('')
const yearTo = ref('')
const oaOnly = ref(false)
const loading = ref(false)
const searched = ref(false)
const list = ref([])
const states = ref([])
const warnings = ref([])

function stateTag(status) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[status] || 'tag-gray'
}
function stateText(s) {
  if (s.status === 'ok') return `成功 ${s.resultCount} 条`
  if (s.status === 'skipped') return '未配置 Key'
  if (s.status === 'timeout') return '超时'
  return s.error || '失败'
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) { showToast('请输入搜索关键词', 'info'); return }
  loading.value = true
  searched.value = true
  list.value = []
  try {
    const res = await searchAcademic({
      keyword: kw,
      yearFrom: yearFrom.value || undefined,
      yearTo: yearTo.value || undefined,
      oaOnly: oaOnly.value
    })
    list.value = res.list || []
    states.value = res.states || []
    warnings.value = res.warnings || []
  } catch (e) {
    showToast(e.message || '搜索失败', 'error')
  } finally {
    loading.value = false
  }
}

async function copyRef(it) {
  try {
    const fmt = await formatCitation(it, 'gb7714')
    const text = typeof fmt === 'string' ? fmt : (fmt && fmt.text) || ''
    if (!text) { showToast('暂无内容可复制', 'info'); return }
    navigator.clipboard.writeText(text).then(() => showToast('引用已复制')).catch(() => showToast('复制失败', 'error'))
  } catch (e) {
    showToast(e.message || '生成引用失败', 'error')
  }
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
.muted-text { color: var(--text-3); }
.chk { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-2); }
.sr-list { display: flex; flex-direction: column; gap: 10px; }
.sr-item { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; }
.sr-title { font-size: 14px; font-weight: 600; }
.sr-authors { font-size: 12px; color: var(--muted); margin: 4px 0; }
.sr-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.sr-abstract { font-size: 13px; color: var(--text-2); line-height: 1.6; margin-top: 6px; }
</style>
