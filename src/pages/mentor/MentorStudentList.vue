<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的学生</h2>
        <p class="page-sub">仅显示当前导师名下的学生（不能查看其他导师的学生）</p>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input" style="width: 220px" placeholder="用户名 / 真实姓名" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <span style="font-size: 13px; color: var(--text-2)">学生数：<b>{{ total }}</b></span>
    </div>

    <div class="tbl-wrap">
      <table v-resizable-columns class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>真实姓名</th>
            <th>手机号</th>
            <th>邮箱</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id" @click="openDetail(u, studentDetailFields, '学生详情')">
            <td>{{ u.id }}</td>
            <td class="ellipsis">{{ u.username }}</td>
            <td class="ellipsis">{{ u.realName || '-' }}</td>
            <td>{{ u.phone || '-' }}</td>
            <td class="ellipsis">{{ u.email || '-' }}</td>
            <td><span :class="statusTagClass(u.status)">{{ statusText(u.status) }}</span></td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="6"><div class="empty">暂无学生</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
        <span>共 {{ total }} 条</span>
      </div>
    </div>
  </div>

  <!-- 学生行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import RowDetailDialog from '../../components/RowDetailDialog.vue'
import { listMyStudents } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { statusText, statusTagClass } from '../../utils/labels'

// 导师独立页面：我的学生（只读列表，一页固定 8 条）
const keyword = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)

// ===== 行详情 =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
const studentDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: '用户名' },
  { key: 'realName', label: '真实姓名' },
  { key: 'phone', label: '手机号' },
  { key: 'email', label: '邮箱' },
  { key: 'status', label: '状态', render: statusText }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

async function load() {
  const res = await listMyStudents({ page: page.value, keyword: keyword.value })
  if (res && res.success) {
    list.value = (res.data && res.data.list) || []
    total.value = (res.data && res.data.total) || 0
    totalPages.value = (res.data && res.data.totalPages) || 1
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}
function search() {
  page.value = 1
  load()
}
function reset() {
  keyword.value = ''
  page.value = 1
  load()
}

onMounted(load)
</script>
