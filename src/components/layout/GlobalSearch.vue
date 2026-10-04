<template>
  <div ref="rootRef" class="global-search">
    <!-- 顶栏窄搜索框：Ctrl+K 全局聚焦，输入防抖搜索 -->
    <div class="search-box" :class="{ on: panelVisible }">
      <svg class="search-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        ref="inputRef"
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="全局搜索（Ctrl+K）"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <kbd v-if="!panelVisible" class="search-kbd">Ctrl K</kbd>
      <button v-else-if="keyword" type="button" class="search-clear" title="清空" @mousedown.prevent="clear">
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- 结果面板：按模块分组，支持 ↑↓ 选择 / Enter 跳转 / Esc 关闭 -->
    <div v-if="panelVisible" class="search-panel">
      <div v-if="loading" class="panel-empty">搜索中…</div>
      <template v-else-if="groups.length">
        <div v-for="(g, gi) in groups" :key="g.type" class="panel-group">
          <div class="group-head">
            <span class="group-label">{{ g.label }}</span>
            <span class="group-count">{{ g.items.length }}</span>
          </div>
          <div
            v-for="(it, ii) in g.items"
            :key="`${g.type}-${it.id}`"
            class="group-item"
            :class="{ active: flatIndexOf(gi, ii) === activeIndex }"
            @mousedown.prevent="go(g.type, it)"
          >
            <div class="item-title">
              <template v-for="(p, pi) in highlightParts(it.title)" :key="pi">
                <mark v-if="p.hit" class="hit">{{ p.text }}</mark>
                <span v-else>{{ p.text }}</span>
              </template>
            </div>
            <div v-if="it.snippet" class="item-snippet">
              <template v-for="(p, pi) in highlightParts(it.snippet)" :key="pi">
                <mark v-if="p.hit" class="hit">{{ p.text }}</mark>
                <span v-else>{{ p.text }}</span>
              </template>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="panel-empty">未找到相关内容</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { searchGlobal } from '../../api/search'
import { useSession } from '../../composables/useSession'
import {
  ROLE_SUPER_ADMIN,
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} from '../../config/constants'

// 结果类型 → 各角色跳转路由（id 为业务主键，groupId 为会议所属组）
// 与 notificationRoutes 同思路：同一业务不同角色路由不同，跳转前按当前角色拼出实际路由。
// 精确直达：task/meeting/note/group 走列表页 + open 参数（目标页自动打开详情）；
// notice/report 第一版跳对应列表页。
const SEARCH_ROUTES = {
  user: {
    [ROLE_SUPER_ADMIN]: (id) => `/admin/users?open=${id}`,
    [ROLE_GROUP_ADMIN]: () => '/group-admin/members',
    [ROLE_MENTOR]: () => '/mentor/students'
  },
  group: {
    [ROLE_SUPER_ADMIN]: (id) => `/admin/groups?open=${id}`
  },
  notice: {
    [ROLE_SUPER_ADMIN]: (id) => `/admin/notices?open=${id}`,
    [ROLE_GROUP_ADMIN]: (id) => `/group-admin/notices?open=${id}`,
    [ROLE_MENTOR]: (id) => `/mentor/notices?open=${id}`,
    [ROLE_STUDENT]: (id) => `/student/notices?open=${id}`
  },
  meeting: {
    [ROLE_SUPER_ADMIN]: (id, gid) => `/admin/meetings?open=${id}${gid ? `&group=${gid}` : ''}`,
    [ROLE_GROUP_ADMIN]: (id, gid) => `/group-admin/meetings?open=${id}${gid ? `&group=${gid}` : ''}`,
    [ROLE_MENTOR]: (id, gid) => `/mentor/meetings?open=${id}${gid ? `&group=${gid}` : ''}`,
    [ROLE_STUDENT]: (id, gid) => `/student/meetings?open=${id}${gid ? `&group=${gid}` : ''}`
  },
  task: {
    [ROLE_GROUP_ADMIN]: (id) => `/group-admin/tasks?open=${id}`,
    [ROLE_MENTOR]: (id) => `/mentor/tasks?open=${id}`,
    [ROLE_STUDENT]: (id) => `/student/tasks?open=${id}`
  },
  note: {
    [ROLE_STUDENT]: (id) => `/student/notes?open=${id}`
  },
  report: {
    [ROLE_SUPER_ADMIN]: () => '/admin/report',
    [ROLE_GROUP_ADMIN]: () => '/group-admin/report',
    [ROLE_MENTOR]: () => '/mentor/report',
    [ROLE_STUDENT]: () => '/student/report'
  }
}

const router = useRouter()
const { getSessionUser } = useSession()

const rootRef = ref(null)
const inputRef = ref(null)
const keyword = ref('')
const groups = ref([])
const loading = ref(false)
const focused = ref(false)
const activeIndex = ref(-1)
let searchTimer = null

// 当前角色（会话快照；全局搜索只出现在登录后的角色布局内）
const role = computed(() => {
  const u = getSessionUser()
  return u ? u.role : ''
})

// 面板是否显示：聚焦且有内容状态（关键词非空或正在搜索）
const panelVisible = computed(() => focused.value && (loading.value || keyword.value.trim() !== ''))

// 扁平化索引：跨组键盘导航用
function flatIndexOf(gi, ii) {
  let idx = 0
  for (let g = 0; g < gi; g++) idx += groups.value[g] ? groups.value[g].items.length : 0
  return idx + ii
}
const totalItems = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

// 高亮分段：把关键词命中处拆成独立片段（纯文本渲染，避免 v-html XSS）
function highlightParts(text) {
  const t = String(text == null ? '' : text)
  const k = keyword.value.trim()
  if (!k) return [{ text: t, hit: false }]
  const lower = t.toLowerCase()
  const kl = k.toLowerCase()
  const parts = []
  let i = 0
  while (i < t.length) {
    const idx = lower.indexOf(kl, i)
    if (idx < 0) {
      parts.push({ text: t.slice(i), hit: false })
      break
    }
    if (idx > i) parts.push({ text: t.slice(i, idx), hit: false })
    parts.push({ text: t.slice(idx, idx + k.length), hit: true })
    i = idx + k.length
  }
  return parts.length ? parts : [{ text: t, hit: false }]
}

// 防抖搜索：停止输入 150ms 后发起
function onInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(runSearch, 150)
}

async function runSearch() {
  const kw = keyword.value.trim()
  if (!kw) {
    groups.value = []
    activeIndex.value = -1
    return
  }
  loading.value = true
  activeIndex.value = -1
  try {
    const res = await searchGlobal(kw)
    groups.value = res && res.success ? (res.data && res.data.groups) || [] : []
  } catch (e) {
    groups.value = []
  } finally {
    loading.value = false
  }
}

// 跳转：type 来自结果分组（条目本身不含 type），按当前角色拼路由后关闭面板
function go(type, item) {
  if (!item || !type) return
  const table = SEARCH_ROUTES[type]
  const fn = table && table[role.value]
  if (!fn) return
  const target = fn(item.id, item.groupId)
  if (!target) return
  closePanel()
  router.push(target)
}

// 键盘导航：↑↓ 移动、Enter 跳转、Esc 关闭
function onKeydown(e) {
  if (e.key === 'Escape') {
    closePanel()
    inputRef.value && inputRef.value.blur()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!panelVisible.value || !totalItems.value) return
    activeIndex.value = (activeIndex.value + 1) % totalItems.value
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!panelVisible.value || !totalItems.value) return
    activeIndex.value = activeIndex.value <= 0 ? totalItems.value - 1 : activeIndex.value - 1
    return
  }
  if (e.key === 'Enter') {
    if (activeIndex.value < 0 || !totalItems.value) return
    // 按扁平序号反查分组内条目
    let rest = activeIndex.value
    for (const g of groups.value) {
      if (rest < g.items.length) {
        go(g.type, g.items[rest])
        return
      }
      rest -= g.items.length
    }
  }
}

function onFocus() {
  focused.value = true
}
function onBlur() {
  // 延迟置 false：让 @mousedown.prevent 的点击先触发 go()
  setTimeout(() => {
    focused.value = false
  }, 120)
}
function clear() {
  keyword.value = ''
  groups.value = []
  activeIndex.value = -1
  inputRef.value && inputRef.value.focus()
}
function closePanel() {
  focused.value = false
}

// Ctrl+K 全局聚焦（阻止浏览器默认行为）
function onGlobalKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    inputRef.value && inputRef.value.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
.global-search {
  position: relative;
  flex-shrink: 0;
  margin: 0 16px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 300px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-page);
  transition: border-color 0.15s;
}
.search-box.on {
  border-color: var(--primary);
}
.search-icon {
  flex-shrink: 0;
  color: var(--text-2);
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text);
}
.search-input::placeholder {
  color: var(--text-2);
}
.search-kbd {
  flex-shrink: 0;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-card);
}
.search-clear {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--border-light);
  color: var(--text-2);
  cursor: pointer;
}
.search-clear:hover {
  background: var(--border);
}

/* 结果面板 */
.search-panel {
  position: absolute;
  top: 40px;
  left: 0;
  width: 380px;
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 300;
}
.panel-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
}
.panel-group {
  padding: 6px 0;
}
.panel-group + .panel-group {
  border-top: 1px solid var(--border-light);
}
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.group-count {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--border-light);
  font-size: 11px;
  font-weight: 400;
  color: var(--text-2);
}
.group-item {
  padding: 7px 12px;
  cursor: pointer;
}
.group-item.active,
.group-item:hover {
  background: var(--primary-soft);
}
.item-title {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-snippet {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hit {
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
</style>
