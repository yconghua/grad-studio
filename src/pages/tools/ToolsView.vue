<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工具箱</h2>
        <p class="page-sub">面向导师与学生的科研 / 就业查询工具，多数据源并行合并，仅本人可见。</p>
      </div>
    </div>

    <!-- 顶部：工具搜索 + 最近使用 + 收藏 -->
    <div class="toolbar tools-topbar">
      <input v-model="keyword" class="input" style="width: 220px" placeholder="搜索工具名…" />
      <template v-if="recentList.length">
        <span class="tools-label">最近使用</span>
        <button v-for="t in recentList" :key="t.key" type="button" class="tag tag-blue tools-chip" @click="openTool(t.key)">{{ t.name }}</button>
      </template>
      <template v-if="favoriteList.length">
        <span class="tools-label">收藏</span>
        <button v-for="t in favoriteList" :key="t.key" type="button" class="tag tag-orange tools-chip" @click="openTool(t.key)">{{ t.name }}</button>
      </template>
      <div class="spacer"></div>
    </div>

    <!-- 三个 Tab -->
    <div class="tabs">
      <button type="button" class="tab" :class="activeTab === 'academic' ? 'active' : ''" @click="activeTab = 'academic'">学术工具</button>
      <button type="button" class="tab" :class="activeTab === 'job' ? 'active' : ''" @click="activeTab = 'job'">就业工具</button>
      <button type="button" class="tab" :class="activeTab === 'settings' ? 'active' : ''" @click="activeTab = 'settings'">工具箱设置</button>
    </div>

    <!-- 学术工具 -->
    <template v-if="activeTab === 'academic'">
      <div class="tools-grid">
        <div
          v-for="t in academicTools"
          :key="t.key"
          class="tools-card"
          :class="{ active: activeTool === t.key }"
          @click="openTool(t.key)"
        >
          <div class="tools-card-title">{{ t.name }}</div>
          <div class="tools-card-desc">{{ t.desc }}</div>
          <div class="tools-card-foot">
            <span v-if="t.needKey" class="tag tag-orange">需配置 Key</span>
            <span v-else class="tag tag-green">免 Key</span>
            <a @click.stop="toggleFavorite(t.key)">{{ isFav(t.key) ? '★ 已收藏' : '☆ 收藏' }}</a>
          </div>
        </div>
      </div>
      <div v-if="activeTool === 'doi'" class="panel tools-panel"><DoiToolPanel /></div>
      <div v-if="activeTool === 'journal'" class="panel tools-panel"><JournalToolPanel /></div>
      <div v-if="activeTool === 'search'" class="panel tools-panel"><SearchToolPanel /></div>
      <div v-if="activeTool === 'translate'" class="panel tools-panel"><TranslateToolPanel /></div>
    </template>

    <!-- 就业工具 -->
    <template v-else-if="activeTab === 'job'">
      <div class="tools-grid">
        <div
          v-for="t in jobTools"
          :key="t.key"
          class="tools-card"
          :class="{ active: activeTool === t.key }"
          @click="openTool(t.key)"
        >
          <div class="tools-card-title">{{ t.name }}</div>
          <div class="tools-card-desc">{{ t.desc }}</div>
          <div class="tools-card-foot">
            <span class="tag tag-orange">需配置 Key</span>
            <a @click.stop="toggleFavorite(t.key)">{{ isFav(t.key) ? '★ 已收藏' : '☆ 收藏' }}</a>
          </div>
        </div>
      </div>
      <div v-if="activeTool === 'company'" class="panel tools-panel"><CompanyToolPanel /></div>
    </template>

    <!-- 工具箱设置 -->
    <ToolSettingsTab v-else @key-saved="onKeySaved" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showToast } from '../../composables/useToast'
import { getToolSettings, saveToolSettings } from '../../api/tool'
import DoiToolPanel from './panels/DoiToolPanel.vue'
import JournalToolPanel from './panels/JournalToolPanel.vue'
import SearchToolPanel from './panels/SearchToolPanel.vue'
import TranslateToolPanel from './panels/TranslateToolPanel.vue'
import CompanyToolPanel from './panels/CompanyToolPanel.vue'
import ToolSettingsTab from './panels/ToolSettingsTab.vue'

const TOOLS = [
  { key: 'doi', name: 'DOI 文献信息查询', group: 'academic', needKey: false, desc: '输入 DOI / 标题 / PMID，获取文献元数据、引用次数与多种引用格式。' },
  { key: 'journal', name: '期刊信息查询', group: 'academic', needKey: false, desc: '输入期刊名 / ISSN，查询影响因子、JCR / 中科院分区、预警状态等。' },
  { key: 'search', name: '学术搜索聚合', group: 'academic', needKey: false, desc: '一个搜索框同时检索 CrossRef / OpenAlex / arXiv / PubMed / S2。' },
  { key: 'translate', name: '在线翻译', group: 'academic', needKey: true, desc: 'DeepL / 百度 / 有道多引擎并列对比，适合学术文本翻译。' },
  { key: 'company', name: '公司搜索', group: 'job', needKey: true, desc: '输入公司名，查询工商信息与招聘信息（官网 / 招聘官网）。' }
]

const activeTab = ref('academic')
const activeTool = ref('doi')
const keyword = ref('')
const settings = ref({ favorites: { tools: [] }, recentUsed: [] })

const academicTools = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return TOOLS.filter((t) => t.group === 'academic' && (!kw || t.name.toLowerCase().includes(kw) || t.desc.toLowerCase().includes(kw)))
})
const jobTools = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return TOOLS.filter((t) => t.group === 'job' && (!kw || t.name.toLowerCase().includes(kw) || t.desc.toLowerCase().includes(kw)))
})
const recentList = computed(() => (settings.value.recentUsed || []).map((k) => TOOLS.find((t) => t.key === k)).filter(Boolean).slice(0, 5))
const favoriteList = computed(() => ((settings.value.favorites || {}).tools || []).map((k) => TOOLS.find((t) => t.key === k)).filter(Boolean).slice(0, 5))

function isFav(key) {
  return ((settings.value.favorites || {}).tools || []).includes(key)
}

async function loadSettings() {
  try {
    settings.value = await getToolSettings()
  } catch (e) {
    showToast(e.message || '设置加载失败', 'error')
  }
}

function openTool(key) {
  const t = TOOLS.find((x) => x.key === key)
  if (!t) return
  activeTab.value = t.group === 'job' ? 'job' : 'academic'
  activeTool.value = key
  // 记录最近使用（去重置顶，最多 8 个）
  const list = [key, ...(settings.value.recentUsed || []).filter((k) => k !== key)].slice(0, 8)
  settings.value.recentUsed = list
  saveToolSettings({ recentUsed: list }).catch(() => {})
}

function toggleFavorite(key) {
  const favs = ((settings.value.favorites || {}).tools || []).slice()
  const next = favs.includes(key) ? favs.filter((k) => k !== key) : [...favs, key]
  settings.value.favorites = { ...(settings.value.favorites || {}), tools: next }
  saveToolSettings({ favorites: settings.value.favorites })
    .then(() => loadSettings())
    .catch((e) => showToast(e.message || '收藏保存失败', 'error'))
}

function onKeySaved() {
  loadSettings()
}

// 翻译面板"去配置 Key"→ 切到工具箱设置 Tab
function onGotoSettings() {
  activeTab.value = 'settings'
}

onMounted(() => {
  loadSettings()
  window.addEventListener('tools:goto-settings', onGotoSettings)
})
onUnmounted(() => {
  window.removeEventListener('tools:goto-settings', onGotoSettings)
})
</script>

<style scoped>
.tools-topbar { align-items: center; }
.tools-label { color: var(--muted); font-size: 13px; }
.tools-chip { cursor: pointer; border: none; }
.tools-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
.tools-card {
  width: 240px; padding: 14px 16px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: pointer;
  transition: border-color 0.15s;
}
.tools-card:hover, .tools-card.active { border-color: var(--primary); }
.tools-card-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.tools-card-desc { font-size: 12px; color: var(--muted); min-height: 34px; line-height: 1.5; }
.tools-card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.tools-card-foot a { font-size: 12px; }
.tools-panel { margin-top: 4px; }
</style>
