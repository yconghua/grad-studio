<template>
  <div>
    <div class="panel-title">公司搜索
      <span class="tip">工商信息（天眼查 / 企查查）+ 招聘信息（Coresignal / Apify），Key 在工具箱设置中配置</span>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input" style="width: 280px" placeholder="公司名称 / 简称 / 行业关键词" @keyup.enter="doSearch" />
      <input v-model="city" class="input" style="width: 140px" placeholder="城市（可选）" />
      <button class="btn btn-primary" :disabled="loading" @click="doSearch">{{ loading ? '搜索中…' : '搜索' }}</button>
      <template v-if="recent.length">
        <span class="muted-text">最近</span>
        <button v-for="(k, i) in recent" :key="i" type="button" class="tag tag-blue tools-chip" @click="quickSearch(k)">{{ k }}</button>
      </template>
      <div class="spacer"></div>
    </div>

    <div v-if="states.length" class="src-states">
      <span v-for="s in states" :key="s.name" class="tag" :class="stateTag(s.status)">{{ s.label }}：{{ stateText(s) }}</span>
    </div>
    <div v-if="warnings.length" class="tool-warn">
      <div v-for="(w, i) in warnings" :key="i" class="tool-warn-line">⚠ {{ w }}</div>
    </div>

    <div v-if="list.length" class="co-list">
      <div v-for="(it, i) in list" :key="i" class="co-item">
        <div class="co-head">
          <b class="co-name">{{ it.name }}</b>
          <span v-if="it.source" class="tag tag-blue">{{ it.source }}</span>
          <div class="spacer"></div>
          <button v-if="faved(it.name)" class="btn btn-sm" @click="unfav(it.name)">★ 已收藏</button>
          <button v-else class="btn btn-sm" @click="fav(it)">☆ 收藏</button>
        </div>
        <div class="co-meta">
          <template v-if="it.creditCode"><span>统一社会信用代码：{{ it.creditCode }}</span></template>
          <template v-if="it.legalPerson"><span>法人：{{ it.legalPerson }}</span></template>
          <template v-if="it.capital"><span>注册资本：{{ it.capital }}</span></template>
          <template v-if="it.established"><span>成立：{{ it.established }}</span></template>
          <template v-if="it.industry"><span>行业：{{ it.industry }}</span></template>
          <template v-if="it.location"><span>地点：{{ it.location }}</span></template>
          <template v-if="it.status"><span>状态：{{ it.status }}</span></template>
          <template v-if="it.financeStage"><span>融资：{{ it.financeStage }}</span></template>
        </div>
        <div v-if="it.business" class="co-desc">经营范围：{{ it.business }}</div>
        <div v-if="it.intro" class="co-desc">{{ it.intro }}</div>
        <div class="ops" style="margin-top: 8px">
          <button v-if="it.website" class="btn btn-sm" @click="openUrl(it.website)">官网</button>
          <button v-if="it.careersUrl" class="btn btn-sm" @click="openUrl(it.careersUrl)">招聘官网</button>
          <button v-if="it.creditCode" class="btn btn-sm" @click="openUrl(`https://www.tianyancha.com/search?key=${encodeURIComponent(it.name)}`)">天眼查详情</button>
        </div>
      </div>
    </div>
    <div v-else-if="!loading && searched && !warnings.length" class="panel-empty">未找到相关信息</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast } from '../../../composables/useToast'
import { searchCompany, listCompanyFavorites, addCompanyFavorite, removeCompanyFavorite } from '../../../api/tool'

const keyword = ref('')
const city = ref('')
const loading = ref(false)
const searched = ref(false)
const list = ref([])
const states = ref([])
const warnings = ref([])
const favorites = ref([])
const recent = ref([])

function stateTag(status) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[status] || 'tag-gray'
}
function stateText(s) {
  if (s.status === 'ok') return `成功 ${s.resultCount} 条`
  if (s.status === 'skipped') return '未配置 Key'
  return `${s.error || '失败'}`
}
function faved(name) {
  return favorites.value.some((f) => f.company_key === name)
}

async function loadFavorites() {
  try {
    favorites.value = await listCompanyFavorites()
  } catch (e) { /* 收藏加载失败静默 */ }
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) { showToast('请输入公司名称', 'info'); return }
  loading.value = true
  searched.value = true
  states.value = []
  warnings.value = []
  try {
    const res = await searchCompany({ keyword: kw, city: city.value })
    list.value = res.list || []
    states.value = res.states || []
    warnings.value = res.warnings || []
    recent.value = [kw, ...recent.value.filter((k) => k !== kw)].slice(0, 5)
  } catch (e) {
    showToast(e.message || '搜索失败', 'error')
  } finally {
    loading.value = false
  }
}

function quickSearch(k) {
  keyword.value = k
  doSearch()
}

async function fav(it) {
  try {
    await addCompanyFavorite({ companyKey: it.name, snapshot: it })
    showToast('已收藏')
    loadFavorites()
  } catch (e) {
    showToast(e.message || '收藏失败', 'error')
  }
}

async function unfav(name) {
  try {
    await removeCompanyFavorite(name)
    showToast('已取消收藏')
    loadFavorites()
  } catch (e) {
    showToast(e.message || '取消收藏失败', 'error')
  }
}

function openUrl(url) {
  if (!url) return
  if (window.api && window.api.sys && window.api.sys.openExternal) window.api.sys.openExternal({ url })
  else window.open(url, '_blank')
}

onMounted(loadFavorites)
</script>

<style scoped>
.muted-text { color: var(--text-3); font-size: 13px; }
.tools-chip { cursor: pointer; border: none; }
.src-states { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tool-warn { margin-bottom: 10px; }
.tool-warn-line { color: var(--warning); font-size: 12px; line-height: 1.7; }
.co-list { display: flex; flex-direction: column; gap: 10px; }
.co-item { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; }
.co-head { display: flex; align-items: center; gap: 8px; }
.co-name { font-size: 15px; }
.co-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--text-2); font-size: 12px; margin: 6px 0; }
.co-desc { color: var(--text-2); font-size: 13px; line-height: 1.6; }
</style>
