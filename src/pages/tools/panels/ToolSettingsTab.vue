<template>
  <div>
    <!-- 通用偏好 -->
    <div class="panel">
      <div class="panel-title">通用偏好</div>
      <div class="pref-row">
        <span class="pref-label">默认引用格式</span>
        <select v-model="defaultCitation" class="select" style="width: 180px" @change="savePref">
          <option value="gb7714">GB/T 7714</option>
          <option value="apa">APA</option>
          <option value="mla">MLA</option>
          <option value="chicago">Chicago</option>
          <option value="bibtex">BibTeX</option>
        </select>
      </div>
      <div class="pref-row">
        <span class="pref-label">默认展示的翻译引擎</span>
        <label class="chk" v-for="opt in engineOptions" :key="opt.value">
          <input v-model="translateEngines" type="checkbox" :value="opt.value" @change="savePref" /> {{ opt.label }}
        </label>
        <span class="tip">不选则使用所有已配置 Key 的引擎</span>
      </div>
    </div>

    <!-- API Key 管理 -->
    <div class="panel">
      <div class="panel-title">API Key 管理
        <span class="tip">需 Key 数据源在此配置后才会启用；未配置的源在查询时提示，不影响其他源</span>
      </div>
      <div v-for="g in keyGroups" :key="g.title" class="key-group">
        <div class="key-group-title">{{ g.title }}</div>
        <div v-for="field in g.fields" :key="field.key" class="key-row">
          <span class="key-label">{{ field.label }}</span>
          <input
            v-model="keyDraft[field.key]"
            type="password"
            class="input"
            style="width: 300px"
            :placeholder="configured[field.key] ? '已配置（留空保持不变）' : '请输入 ' + field.label"
          />
          <span v-if="configured[field.key]" class="tag tag-green">已配置</span>
          <button class="btn btn-sm" @click="testKey(field)">测试</button>
        </div>
      </div>
      <div class="ops" style="margin-top: 12px">
        <button class="btn btn-primary" :disabled="saving" @click="saveKeys">{{ saving ? '保存中…' : '保存全部 Key' }}</button>
      </div>
    </div>

    <!-- 缓存管理 -->
    <div class="panel">
      <div class="panel-title">缓存管理</div>
      <div class="cache-row" v-for="c in cacheList" :key="c.table">
        <span>{{ c.label }}缓存：{{ c.count }} 条</span>
        <button class="btn btn-sm" @click="clearCache(c.table)">清理</button>
      </div>
    </div>

    <!-- 数据源调用日志 -->
    <div class="panel">
      <div class="panel-title">数据源调用日志
        <span class="tip">记录每次查询各数据源的调用状态与耗时，默认保留最近 30 天</span>
      </div>
      <div class="toolbar" style="margin-bottom: 10px">
        <select v-model="logTool" class="select" style="width: 140px" @change="loadLogs(1)">
          <option value="">全部工具</option>
          <option v-for="o in logToolOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="logStatus" class="select" style="width: 120px" @change="loadLogs(1)">
          <option value="">全部状态</option>
          <option v-for="o in logStatusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button class="btn btn-sm" @click="clearLogs">清理 30 天前</button>
        <div class="spacer"></div>
      </div>
      <div class="tbl-wrap" v-if="logList.length">
        <table
          v-resizable-columns="{ min: 48, minByIndex: { 7: 120 } }"
          v-sortable-columns="{ field: sortField, order: sortOrder, onSort }"
          class="tbl"
        >
          <thead>
            <tr>
              <th data-sort="createdAt">时间</th>
              <th data-sort="tool">工具</th>
              <th>查询参数</th>
              <th data-sort="sourceName">数据源</th>
              <th data-sort="status">状态</th>
              <th data-sort="costMs">耗时</th>
              <th data-sort="resultCount">结果</th>
              <th>错误信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in logList" :key="l.id" @click="openLogDetail(l)">
              <td>{{ l.created_at }}</td>
              <td>{{ toolName(l.tool) }}</td>
              <td :title="l.query_snapshot" class="ellipsis" style="max-width: 200px">{{ l.query_snapshot || '-' }}</td>
              <td>{{ l.source_name }}</td>
              <td><span class="tag" :class="logStateTag(l.status)">{{ logStateText(l.status) }}</span></td>
              <td>{{ l.cost_ms }}ms</td>
              <td>{{ l.result_count }}</td>
              <td :title="l.error_msg" class="ellipsis" style="max-width: 200px">{{ l.error_msg || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <span>共 {{ logTotal }} 条</span>
          <button class="btn btn-sm" :disabled="logPage <= 1" @click="loadLogs(logPage - 1)">上一页</button>
          <span>第 {{ logPage }} / {{ logTotalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="logPage >= logTotalPages" @click="loadLogs(logPage + 1)">下一页</button>
        </div>
      </div>
      <div v-else class="panel-empty">暂无调用日志</div>
    </div>

    <RowDetailDialog v-model:visible="logDetailVisible" title="调用日志详情" :row="logDetailRow" :fields="logDetailFields" size="lg" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast } from '../../../composables/useToast'
import { getToolSettings, saveToolSettings, testToolKey, getToolCacheInfo, clearToolCache, getToolLogs, clearToolLogs } from '../../../api/tool'
import RowDetailDialog from '../../../components/common/RowDetailDialog.vue'

const engineOptions = [
  { label: 'DeepL', value: 'deepl' },
  { label: '百度翻译', value: 'baidu' },
  { label: '有道翻译', value: 'youdao' },
  { label: 'LibreTranslate', value: 'libreTranslate' },
  { label: 'MyMemory', value: 'myMemory' },
  { label: '谷歌翻译', value: 'googleTranslate' },
  { label: '微软翻译', value: 'microsoftTranslate' },
  { label: '阿里云翻译', value: 'aliyunTranslate' },
  { label: '腾讯翻译', value: 'tencentTranslate' }
]

const defaultCitation = ref('gb7714')
const translateEngines = ref([])
const configured = ref({})
const keyDraft = ref({})
const saving = ref(false)

const keyGroups = [
  {
    title: '翻译引擎',
    fields: [
      { key: 'deepl', label: 'DeepL API Key' },
      { key: 'baiduAppid', label: '百度翻译 APPID' },
      { key: 'baiduSecret', label: '百度翻译 密钥' },
      { key: 'youdaoAppKey', label: '有道翻译 APP Key' },
      { key: 'youdaoSecret', label: '有道翻译 密钥' },
      { key: 'googleTranslate', label: '谷歌翻译 API Key' },
      { key: 'microsoftTranslate', label: '微软翻译 Azure Key' },
      { key: 'aliyunTranslate', label: '阿里云翻译 Key（暂不可用）' },
      { key: 'tencentTranslate', label: '腾讯翻译 Key（暂不可用）' }
    ]
  },
  {
    title: '期刊查询',
    fields: [
      { key: 'juheJcr', label: '聚合数据 JCR Key' },
      { key: 'webOfScience', label: 'Web of Science 开发者 Key' },
      { key: 'xrScholar', label: '新锐学术 API Key' },
      { key: 'scopus', label: 'Scopus API Key' }
    ]
  },
  {
    title: 'DOI 查询',
    fields: [
      { key: 'unpaywall', label: 'Unpaywall Key（邮箱）' }
    ]
  },
  {
    title: '学术搜索（选填提额）',
    fields: [
      { key: 'pubmed', label: 'PubMed API Key' },
      { key: 'semanticScholar', label: 'Semantic Scholar API Key' },
      { key: 'baseUsername', label: 'BASE Key（注册用户名）' },
      { key: 'core', label: 'CORE API Key' },
      { key: 'lens', label: 'Lens.org Token' }
    ]
  },
  {
    title: '公司搜索',
    fields: [
      { key: 'tianyancha', label: '天眼查 Key' },
      { key: 'qichacha', label: '企查查 Key' },
      { key: 'qichachaSecret', label: '企查查 SecretKey' },
      { key: 'coresignal', label: 'Coresignal Key' },
      { key: 'apify', label: 'Apify Token' },
      { key: 'openCorporates', label: 'OpenCorporates Token' },
      { key: 'clearbit', label: 'Clearbit Key' },
      { key: 'adzunaAppId', label: 'Adzuna app_id' },
      { key: 'adzunaKey', label: 'Adzuna app_key' },
      { key: 'crunchbase', label: 'Crunchbase user_key' },
      { key: 'qixin', label: '启信宝 Key' },
      { key: 'aiqicha', label: '爱企查 Key（暂不可用）' }
    ]
  }
]

// 缓存管理
const cacheList = ref([])
// 调用日志
const logTool = ref('')
const logStatus = ref('')
const logList = ref([])
const logTotal = ref(0)
const logPage = ref(1)
const logTotalPages = ref(1)
const sortField = ref('')
const sortOrder = ref('')
// 行详情
const logDetailVisible = ref(false)
const logDetailRow = ref(null)
const logDetailFields = [
  { key: 'created_at', label: '时间' },
  { key: 'tool', label: '工具', render: (v) => toolName(v) },
  { key: 'query_snapshot', label: '查询参数' },
  { key: 'source_name', label: '数据源' },
  { key: 'status', label: '状态', render: (v) => logStateText(v) },
  { key: 'cost_ms', label: '耗时', render: (v) => (v != null ? v + 'ms' : '-') },
  { key: 'result_count', label: '结果数量' },
  { key: 'error_msg', label: '错误信息' }
]
const logToolOptions = [
  { value: 'doi', label: 'DOI 查询' },
  { value: 'journal', label: '期刊查询' },
  { value: 'search', label: '学术搜索' },
  { value: 'translate', label: '在线翻译' },
  { value: 'company', label: '公司搜索' }
]
const logStatusOptions = [
  { value: 'ok', label: '成功' },
  { value: 'fail', label: '失败' },
  { value: 'timeout', label: '超时' },
  { value: 'skipped', label: '跳过' }
]

function toolName(t) {
  return { doi: 'DOI 查询', journal: '期刊查询', search: '学术搜索', translate: '在线翻译', company: '公司搜索' }[t] || t
}
function logStateTag(s) {
  return { ok: 'tag-green', timeout: 'tag-orange', skipped: 'tag-gray', fail: 'tag-red' }[s] || 'tag-gray'
}
function logStateText(s) {
  return { ok: '成功', fail: '失败', timeout: '超时', skipped: '跳过' }[s] || s
}

async function loadSettings() {
  try {
    const s = await getToolSettings()
    defaultCitation.value = s.defaultCitation || 'gb7714'
    translateEngines.value = s.translateEngines || []
    configured.value = s.apiKeys || {}
  } catch (e) {
    showToast(e.message || '设置加载失败', 'error')
  }
}

async function savePref() {
  try {
    await saveToolSettings({ defaultCitation: defaultCitation.value, translateEngines: translateEngines.value })
    showToast('偏好已保存')
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  }
}

async function testKey(field) {
  const value = keyDraft.value[field.key]
  if (!value) { showToast('请输入' + field.label, 'info'); return }
  try {
    const res = await testToolKey(field.key, value)
    if (res.ok) showToast(res.message || '连接成功')
    else showToast(res.message || '连接失败', 'error')
  } catch (e) {
    showToast(e.message || '测试失败', 'error')
  }
}

async function saveKeys() {
  const patch = {}
  for (const g of keyGroups) {
    for (const f of g.fields) {
      const v = keyDraft.value[f.key]
      if (v && String(v).trim()) patch[f.key] = String(v).trim()
    }
  }
  if (!Object.keys(patch).length) { showToast('没有新填写的 Key', 'info'); return }
  saving.value = true
  try {
    await saveToolSettings({ apiKeys: patch })
    showToast('Key 已保存')
    keyDraft.value = {}
    loadSettings()
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function loadCacheInfo() {
  try {
    const info = await getToolCacheInfo()
    cacheList.value = [
      { table: 'doi', label: 'DOI 查询', count: info.doi },
      { table: 'journal', label: '期刊查询', count: info.journal },
      { table: 'company', label: '公司搜索', count: info.company }
    ]
  } catch (e) { /* 缓存信息加载失败静默 */ }
}

async function clearCache(table) {
  try {
    await clearToolCache(table)
    showToast('缓存已清理')
    loadCacheInfo()
  } catch (e) {
    showToast(e.message || '清理失败', 'error')
  }
}

async function loadLogs(page = 1) {
  try {
    const res = await getToolLogs({ tool: logTool.value, status: logStatus.value, page, pageSize: 8, sortField: sortField.value, sortOrder: sortOrder.value })
    logList.value = res.list || []
    logTotal.value = res.total || 0
    logPage.value = res.page || 1
    logTotalPages.value = res.totalPages || 1
  } catch (e) {
    showToast(e.message || '日志加载失败', 'error')
  }
}

// 表头排序（后端 SQL 排序，翻页保持全局顺序）
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  loadLogs(1)
}

function openLogDetail(row) {
  logDetailRow.value = row
  logDetailVisible.value = true
}

async function clearLogs() {
  try {
    const res = await clearToolLogs(30)
    showToast('已清理 ' + (res.cleared || 0) + ' 条日志')
    loadLogs(1)
  } catch (e) {
    showToast(e.message || '清理失败', 'error')
  }
}

const emit = defineEmits(['key-saved'])

onMounted(() => {
  loadSettings()
  loadCacheInfo()
  loadLogs(1)
})
</script>

<style scoped>
.pref-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.pref-label { font-size: 13px; color: var(--text-2); }
.pref-row .tip { color: var(--muted); font-size: 12px; }
.chk { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-2); }
.key-group { margin-bottom: 14px; }
.key-group-title { font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.key-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.key-label { width: 150px; text-align: right; color: var(--text-2); font-size: 13px; }
.cache-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
</style>
