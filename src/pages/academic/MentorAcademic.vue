<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">学生学业档案</h2>
        <p class="page-sub">查看名下学生档案，确认或退回已提交节点</p>
      </div>
    </div>

    <div class="card mt-toolbar">
      <div class="mt-search">
        <input v-model="keyword" class="input" style="width: 240px" placeholder="用户名 / 真实姓名" @keyup.enter="search" />
        <button class="btn btn-sm" @click="search">搜索</button>
      </div>
      <span class="mt-count">共 {{ total }} 名学生</span>
    </div>

    <div class="card mt-table">
      <div class="tbl-wrap">
        <table v-resizable-columns="{ min: 48 }" v-sortable-columns="{ field: sortField, order: sortOrder, onSort }" class="tbl">
          <thead>
            <tr>
              <th data-sort="realName">学生</th>
              <th data-sort="userNo">学号</th>
              <th data-sort="degree">类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in list" :key="s.id" @click="openDetail(s.id)">
              <td class="ellipsis">{{ s.realName || s.username }}</td>
              <td class="ellipsis">{{ s.userNo || '-' }}</td>
              <td>{{ labelOfDegree(s.degree) }}</td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="3"><div class="empty">暂无名下学生</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
          <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
          <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
          <span>共 {{ total }} 人</span>
        </div>
      </div>
    </div>

    <MentorAcademicDetailDialog v-model:visible="detailVisible" :user-id="detailUserId" @changed="load" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MentorAcademicDetailDialog from './MentorAcademicDetailDialog.vue'
import { listMyStudents } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 学位（users.degree）→ 培养类型展示名，与超管/组管统计口径一致
function labelOfDegree(d) {
  const s = String(d || '')
  if (s.includes('博士')) return '博士'
  if (s.includes('学士') || s.includes('本科')) return '本科'
  return '硕士'
}

const keyword = ref('')
// 列表：与其他列表统一的后端分页（每页 8 条）+ 表头排序
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const sortField = ref('')
const sortOrder = ref('')
// 详情弹窗
const detailVisible = ref(false)
const detailUserId = ref(null)

async function load() {
  try {
    const res = await listMyStudents({
      page: page.value,
      keyword: keyword.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value
    })
    if (res && res.success) {
      list.value = (res.data && res.data.list) || []
      total.value = (res.data && res.data.total) || 0
      totalPages.value = (res.data && res.data.totalPages) || 1
    } else {
      dialogAlert((res && res.message) || '加载失败')
    }
  } catch (e) {
    dialogAlert('加载失败：' + (e && e.message ? e.message : '请稍后重试'))
  }
}
function search() {
  page.value = 1
  load()
}
// 表头排序：回到第一页并重新加载（与其他列表一致）
function onSort(field, order) {
  sortField.value = field
  sortOrder.value = order
  page.value = 1
  load()
}
// 点击行：打开档案详情弹窗
function openDetail(userId) {
  detailUserId.value = userId
  detailVisible.value = true
}

onMounted(load)
useAutoRefresh(load)
</script>

<style scoped>
.mt-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 18px;
}
.mt-search { display: flex; gap: 8px; }
.mt-count { margin-left: auto; font-size: 13px; color: var(--text-2, #6b7280); }
.mt-table { padding: 10px; }
.mt-table tr { cursor: pointer; }
.mt-table tr:hover td { background: var(--bg-hover, #f3f4f6); }
</style>
