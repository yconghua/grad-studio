<template>
  <div class="weblinks-tab">
    <!-- 过滤工具条：关键字搜索 + 分组下拉，可组合过滤 -->
    <div class="filter-bar">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"></circle>
          <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
        </svg>
        <input
          v-model="keyword"
          class="search-input"
          type="text"
          placeholder="搜索网址名称 / 描述 / 链接…"
        />
      </div>
      <select v-model="groupKey" class="group-select" title="按分组筛选">
        <option value="all">全部分组</option>
        <option v-for="g in groups" :key="g.title" :value="g.title">{{ g.title }}</option>
      </select>
      <span v-if="hasFilter" class="match-count">命中 {{ matchCount }} / {{ total }}</span>
      <button v-if="hasFilter" class="clear-btn" @click="resetFilter">清除筛选</button>
    </div>

    <!-- 顶部说明：内置清单位置 + 打开方式 -->
    <p class="tip">
      共 <b>{{ total }}</b> 个常用网址，按分组排列；点击任意一条将在系统默认浏览器中打开。
    </p>

    <!-- 分组卡片（按过滤结果渲染） -->
    <div v-if="filteredGroups.length" class="grid">
      <section v-for="group in filteredGroups" :key="group.title" class="card">
        <h3 class="card-title">{{ group.title }}</h3>
        <ul class="link-list">
          <li v-for="(link, idx) in group.links" :key="`${link.url}-${idx}`">
            <a
              class="link"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="`${link.name}（${link.url}）`"
            >
              <span class="link-main">
                <span class="link-name">{{ link.name }}</span>
                <span class="link-desc">{{ link.desc || hostOf(link.url) }}</span>
              </span>
              <span class="link-domain">{{ hostOf(link.url) }}</span>
              <span class="link-arrow" aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </section>
    </div>

    <!-- 空态：过滤后无结果 -->
    <p v-else class="empty">没有匹配的网址，换个关键词或分组试试。</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
// 网址收藏夹数据为静态内置 JSON（源码分发随包携带，使用者可自行增删网址）
import weblinks from './weblinks.json'

const groups = computed(() => weblinks.groups || [])
const total = computed(() =>
  groups.value.reduce((sum, g) => sum + (g.links ? g.links.length : 0), 0)
)

// 过滤状态：关键字（名称/描述/链接）+ 分组下拉（all = 全部分组）
const keyword = ref('')
const groupKey = ref('all')
const hasFilter = computed(
  () => keyword.value.trim() !== '' || groupKey.value !== 'all'
)
const matchCount = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.links.length, 0)
)
// 过滤结果：先按分组筛，再按关键字筛（保留原组顺序与结构，空组隐藏）
const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return groups.value
    .filter((g) => groupKey.value === 'all' || g.title === groupKey.value)
    .map((g) => {
      if (!kw) return g
      const hit = (g.links || []).filter(
        (l) =>
          (l.name || '').toLowerCase().includes(kw) ||
          (l.desc || '').toLowerCase().includes(kw) ||
          (l.url || '').toLowerCase().includes(kw)
      )
      return { ...g, links: hit }
    })
    .filter((g) => g.links && g.links.length > 0)
})

function resetFilter() {
  keyword.value = ''
  groupKey.value = 'all'
}

// 提取展示用域名：去掉协议与 www. 前缀，便于整行布局
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return url
  }
}
</script>

<style scoped>
.weblinks-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* 过滤工具条 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search-wrap {
  position: relative;
  flex: 1 1 240px;
  max-width: 360px;
}
.search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: #c9cdd4;
  pointer-events: none;
}
.search-input {
  width: 100%;
  height: 38px;
  padding: 0 12px 0 34px;
  font-size: 13px;
  color: #1f2329;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.search-input::placeholder {
  color: #c9cdd4;
}
.search-input:focus {
  border-color: #0d80e0;
}
.group-select {
  height: 38px;
  padding: 0 30px 0 12px;
  font-size: 13px;
  color: #4e5969;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  outline: none;
  cursor: pointer;
}
.group-select:focus {
  border-color: #0d80e0;
}
.match-count {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
}
.clear-btn {
  height: 38px;
  padding: 0 14px;
  font-size: 13px;
  color: #0d80e0;
  background: #fff;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.clear-btn:hover {
  border-color: #0d80e0;
}
/* 空态 */
.empty {
  margin: 0;
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #86909c;
}
/* 顶部说明 */
.tip {
  margin: 0;
  font-size: 13px;
  color: #86909c;
  line-height: 1.7;
}
.tip b {
  color: #4e5969;
}
.tip code {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #0d80e0;
  background: #e8f3fe;
  padding: 1px 6px;
  border-radius: 4px;
}
/* 分组纵向单列排列：每组卡片自上而下占满整行，不并排 */
.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #eceff3;
  padding: 18px 20px 8px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin: 0 0 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f2f3f5;
}
.link-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  text-decoration: none;
  transition: background-color 0.15s;
}
.link:hover {
  background: #f5f7fa;
}
.link-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.link-name {
  font-size: 14px;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link:hover .link-name {
  color: #0d80e0;
}
.link-desc {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link-domain {
  flex: 0 0 auto;
  font-size: 12px;
  color: #c9cdd4;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link-arrow {
  flex: 0 0 auto;
  font-size: 13px;
  color: #c9cdd4;
  transition: transform 0.15s;
}
.link:hover .link-arrow {
  color: #0d80e0;
  transform: translate(2px, -2px);
}
</style>
