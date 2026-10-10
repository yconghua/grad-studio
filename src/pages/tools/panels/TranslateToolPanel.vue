<template>
  <div>
    <div class="panel-title">在线翻译
      <span class="tip">DeepL · 百度翻译 · 有道翻译 多引擎并列对比（引擎 Key 在工具箱设置中配置）</span>
    </div>

    <div class="toolbar">
      <select v-model="srcLang" class="select" style="width: 110px">
        <option value="auto">自动检测</option>
        <option value="zh">中文</option>
        <option value="en">英文</option>
        <option value="ja">日文</option>
      </select>
      <select v-model="targetLang" class="select" style="width: 110px">
        <option value="zh">中文</option>
        <option value="en">英文</option>
        <option value="ja">日文</option>
      </select>
      <div class="spacer"></div>
      <template v-if="keyHint">
        <span class="tag tag-orange">已启用引擎：{{ keyHint }}</span>
      </template>
      <button v-else class="btn btn-sm" @click="gotoSettings">去配置翻译引擎 Key</button>
    </div>

    <div class="tr-box">
      <div class="tr-col">
        <textarea v-model="text" class="tool-textarea" rows="6" placeholder="输入待翻译的学术文本…"></textarea>
      </div>
      <div class="tr-actions">
        <button class="btn btn-primary" :disabled="loading" @click="doTranslate">{{ loading ? '翻译中…' : '翻译' }}</button>
        <button v-if="results.length" class="btn" @click="replace">回填原文</button>
      </div>
      <div class="tr-col tr-results">
        <div v-for="r in results" :key="r.engine" class="tr-result">
          <div class="tr-result-head">
            <b>{{ r.label }}</b>
            <span v-if="r.from === 'cache'" class="tag tag-gray">缓存</span>
            <button class="btn btn-sm" @click="copyText(r.translatedText)">复制</button>
          </div>
          <div class="tr-result-text">{{ r.translatedText || '（无译文）' }}</div>
        </div>
        <div v-if="!results.length && !loading" class="panel-empty">译文将在此并列展示</div>
      </div>
    </div>

    <div v-if="states.length" class="src-states">
      <span v-for="(s, i) in states" :key="i" class="tag" :class="stateTag(s.status)">{{ s.label }}：{{ stateText(s) }}</span>
    </div>
    <div v-if="warnings.length" class="tool-warn">
      <div v-for="(w, i) in warnings" :key="i" class="tool-warn-line">⚠ {{ w }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from '../../../composables/useToast'
import { translateText, getToolSettings } from '../../../api/tool'

const srcLang = ref('auto')
const targetLang = ref('zh')
const text = ref('')
const loading = ref(false)
const results = ref([])
const states = ref([])
const warnings = ref([])
const settings = ref({ apiKeys: {}, translateEngines: [] })

const keyHint = computed(() => {
  const cfg = Object.keys(settings.value.apiKeys || {}).filter((k) => ['deepl', 'baiduAppid', 'youdaoAppKey'].includes(k))
  if (cfg.length) return cfg.map((k) => ({ deepl: 'DeepL', baiduAppid: '百度', youdaoAppKey: '有道' }[k])).join(' / ')
  return ''
})

async function loadSettings() {
  try {
    settings.value = await getToolSettings()
  } catch (e) { /* 设置加载失败静默 */ }
}

function stateTag(status) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[status] || 'tag-gray'
}
function stateText(s) {
  if (s.status === 'ok') return `成功 ${s.resultCount} 条`
  if (s.status === 'skipped') return '未配置 Key'
  return `${s.error || '失败'}`
}

async function doTranslate() {
  const t = text.value.trim()
  if (!t) { showToast('请输入待翻译文本', 'info'); return }
  loading.value = true
  states.value = []
  warnings.value = []
  try {
    const res = await translateText({ text: t, srcLang: srcLang.value, targetLang: targetLang.value })
    results.value = res.results || []
    states.value = res.states || []
    warnings.value = res.warnings || []
    if (!results.value.length && !warnings.value.length) showToast('翻译引擎均未返回结果，请检查 Key 配置', 'info')
  } catch (e) {
    showToast(e.message || '翻译失败', 'error')
  } finally {
    loading.value = false
  }
}

function copyText(t) {
  if (!t) { showToast('暂无内容可复制', 'info'); return }
  navigator.clipboard.writeText(t).then(() => showToast('已复制')).catch(() => showToast('复制失败', 'error'))
}

function replace() {
  if (results.value.length) text.value = results.value[0].translatedText
}

function gotoSettings() {
  // 通知父级切换到设置 Tab（通过自定义事件）
  window.dispatchEvent(new CustomEvent('tools:goto-settings'))
}

loadSettings()
</script>

<style scoped>
.tr-box { display: flex; gap: 12px; margin-bottom: 12px; }
.tr-col { flex: 1; min-width: 0; }
.tr-actions { display: flex; flex-direction: column; gap: 8px; justify-content: center; }
.tr-results { display: flex; flex-direction: column; gap: 10px; }
.tr-result { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 12px; }
.tr-result-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.tr-result-text { color: var(--text-2); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
.src-states { display: flex; flex-wrap: wrap; gap: 6px; }
.tool-warn { margin-top: 8px; }
.tool-warn-line { color: var(--warning); font-size: 12px; line-height: 1.7; }
.tool-textarea { width: 100%; box-sizing: border-box; min-height: 120px; padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; resize: vertical; outline: none; background: var(--bg-card); color: var(--text); }
.tool-textarea:focus { border-color: var(--primary); }
</style>
