<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">本组公告管理</h2>
        <p class="page-sub">仅可管理当前绑定课题组的公告（不能操作其他课题组）</p>
      </div>
      <button class="btn btn-primary" :disabled="groupStopped" @click="openCreate">发布公告</button>
    </div>

    <div v-if="groupStopped" class="banner-warn">课题组已停用，不能发布 / 编辑 / 置顶公告，历史公告照常可查看与管理</div>

    <!-- 筛选区：课题组固定为本组，不可切换 -->
    <div class="toolbar">
      <span class="input" style="width: 200px; display: inline-flex; align-items: center; color: var(--text-2)">
        所属课题组：<b>{{ groupName }}</b>
      </span>
      <select v-model="status" class="select" @change="search">
        <option value="">全部状态</option>
        <option :value="1">已发布</option>
        <option :value="2">下架</option>
      </select>
      <input v-model="keyword" class="input" style="width: 220px" placeholder="公告标题" @keyup.enter="search" />
      <button class="btn btn-primary" @click="search">查询</button>
      <button class="btn" @click="reset">重置</button>
      <div class="spacer"></div>
      <span style="font-size: 13px; color: var(--text-2)">共 <b>{{ total }}</b> 条公告</span>
    </div>

    <!-- 公告表格 -->
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>发布人</th>
            <th>状态</th>
            <th>发布时间</th>
            <th style="width: 240px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in list" :key="n.id" @click="openDetail(n, noticeDetailFields, '公告详情')">
            <td>{{ n.id }}</td>
            <td class="ellipsis" style="max-width: 200px">
              <span v-if="n.isTop" class="tag tag-orange" style="margin-right: 4px">置顶</span>{{ n.title }}
            </td>
            <td class="ellipsis">{{ n.publisherName }}</td>
            <td><span :class="noticeStatusClass(n.status)">{{ noticeStatusText(n.status) }}</span></td>
            <td>{{ n.publishTime }}</td>
            <td>
              <div class="ops" @click.stop>
                <button class="btn btn-sm" :disabled="groupStopped" @click="openEdit(n)">编辑</button>
                <button class="btn btn-sm" :disabled="groupStopped" @click="doTop(n)">{{ n.isTop ? '取消置顶' : '置顶' }}</button>
                <button class="btn btn-sm" @click="doStats(n)">统计</button>
                <button class="btn btn-sm btn-danger" @click="doDelete(n)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="6"><div class="empty">暂无公告数据</div></td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-sm" :disabled="page <= 1" @click="page--; load()">上一页</button>
        <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
        <button class="btn btn-sm" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
      </div>
    </div>

    <!-- 发布 / 编辑公告弹窗（发布固定发到本组，无选组） -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal lg">
        <div class="modal-head">
          <h3>{{ isEdit ? '编辑公告' : '发布公告' }}</h3>
          <button type="button" class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>所属课题组</label>
            <input :value="form.groupName" class="input" readonly />
            <p class="hint">公告仅发布到当前绑定的课题组</p>
          </div>
          <div class="field">
            <label>公告标题</label>
            <input v-model.trim="form.title" class="input" placeholder="请输入公告标题" maxlength="100" />
            <p class="hint">不超过 100 个字符</p>
          </div>
          <div class="field">
            <label>公告内容（支持 Markdown 排版，或直接输入纯文本）</label>
            <div class="md-toolbar">
              <button type="button" class="btn btn-sm" @click="insertMd('**', '**', '加粗文本')">加粗</button>
              <button type="button" class="btn btn-sm" @click="insertMd('*', '*', '斜体文本')">斜体</button>
              <button type="button" class="btn btn-sm" @click="insertMd('\n- ', '', '列表项')">列表</button>
              <button type="button" class="btn btn-sm" @click="insertMd('\n1. ', '', '列表项')">有序列表</button>
              <button type="button" class="btn btn-sm" @click="insertMd('[', '](https://)', '链接文字')">链接</button>
              <button type="button" class="btn btn-sm" @click="insertMd('\n> ', '', '引用内容')">引用</button>
              <button type="button" class="btn btn-sm" @click="insertMd('`', '`', '代码')">代码</button>
              <button type="button" class="btn btn-sm" @click="insertMd('\n```\n', '\n```', '代码块')">代码块</button>
            </div>
            <div class="md-editor">
              <textarea ref="contentEl" v-model="form.content" placeholder="支持 Markdown 排版，或直接输入纯文本" maxlength="10000" style="min-height: 220px"></textarea>
              <div class="md-preview">
                <NoticeContent :content="form.content" />
                <p v-if="!form.content" class="hint">输入内容后此处实时预览</p>
              </div>
            </div>
            <p class="hint">不超过 10000 个字符；支持加粗、斜体、列表、链接、引用、代码块</p>
          </div>
          <div class="field" v-if="isEdit">
            <label>状态</label>
            <select v-model="form.status" class="select">
              <option :value="1">已发布</option>
              <option :value="2">下架</option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 已读统计弹窗 -->
    <div v-if="showStats" class="modal-mask" @click.self="showStats = false">
      <div class="modal">
        <div class="modal-head">
          <h3>已读统计</h3>
          <button type="button" class="modal-close" @click="showStats = false">×</button>
        </div>
        <div class="modal-body">
          <p class="panel-sub" style="margin-bottom: 10px">公告：{{ stats.title }}</p>
          <p style="font-size: 13px; color: var(--text-2-strong); margin-bottom: 10px">
            应读 <b>{{ stats.totalMembers }}</b> 人（本组启用状态的导师 + 学生）／已读 <b>{{ stats.readCount }}</b> 人
          </p>
          <div class="tbl-wrap" v-if="stats.list && stats.list.length">
            <table class="tbl">
              <thead>
                <tr><th>姓名</th><th>用户名</th><th>已读时间</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in stats.list" :key="r.userId">
                  <td>{{ r.realName || '-' }}</td>
                  <td>{{ r.username }}</td>
                  <td>{{ r.readAt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty">暂无已读记录</div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="showStats = false">关闭</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 公告行详情弹窗 -->
  <RowDetailDialog v-model:visible="detailVisible" :title="detailTitle" :row="detailRow" :fields="detailFields" />
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import RowDetailDialog from '../../components/RowDetailDialog.vue'
import NoticeContent from '../../components/NoticeContent.vue'
import { listNotices, createNotice, updateNotice, deleteNotice, toggleNoticeTop, getNoticeReadStats } from '../../api'
import { getOwnGroup } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

// 课题组管理员独立页面：本组公告管理（课题组固定为本组，不能切换）
const keyword = ref('')
const status = ref('')
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const groupName = ref('')
const groupStopped = ref(false)

const showModal = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref(null)
const form = reactive({ groupId: '', groupName: '', title: '', content: '', status: 1 })

const showStats = ref(false)
const stats = ref({ title: '', totalMembers: 0, readCount: 0, list: [] })

const noticeStatusText = (s) => (Number(s) === 2 ? '下架' : '已发布')
const noticeStatusClass = (s) => (Number(s) === 2 ? 'tag' : 'tag tag-blue')

// ===== 行详情 =====
const detailVisible = ref(false)
const detailRow = ref(null)
const detailFields = ref([])
const detailTitle = ref('')
// 公告详情字段：本组公告，内容全文在弹窗内查看
const noticeDetailFields = [
  { key: 'id', label: 'ID' },
  { key: 'groupId', label: '所属课题组', render: (v) => (v ? `本组 (ID ${v})` : '-') },
  { key: 'title', label: '标题' },
  { key: 'publisherName', label: '发布人' },
  { key: 'isTop', label: '置顶', render: (v) => (v ? '是' : '否') },
  { key: 'status', label: '状态', render: noticeStatusText },
  { key: 'publishTime', label: '发布时间' },
  { key: 'content', label: '内容', markdown: true }
]
function openDetail(row, fields, title) {
  detailRow.value = row
  detailFields.value = fields
  detailTitle.value = title
  detailVisible.value = true
}

async function load() {
  const res = await listNotices({ page: page.value, keyword: keyword.value, status: status.value })
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
  status.value = ''
  page.value = 1
  load()
}

async function openCreate() {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能发布公告')
  isEdit.value = false
  editId.value = null
  Object.assign(form, { groupId: '', groupName: groupName.value, title: '', content: '', status: 1 })
  showModal.value = true
}

async function openEdit(n) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能编辑公告')
  isEdit.value = true
  editId.value = n.id
  Object.assign(form, { groupId: n.groupId, groupName: n.groupName, title: n.title, content: n.content, status: n.status })
  showModal.value = true
}

async function save() {
  if (!form.title) return dialogAlert('请输入公告标题')
  if (!form.content) return dialogAlert('请输入公告内容')
  if (form.content.length > 10000) return dialogAlert('公告内容不能超过 10000 个字符')
  saving.value = true
  try {
    // 不传 groupId：服务端强制发布到当前绑定课题组
    const res = isEdit.value
      ? await updateNotice(editId.value, { title: form.title, content: form.content, status: form.status })
      : await createNotice({ title: form.title, content: form.content })
    if (res && res.success) {
      showModal.value = false
      await refreshAfterWrite(isEdit.value ? '保存成功' : '发布成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function doTop(n) {
  if (groupStopped.value) return dialogAlert('课题组已停用，不能置顶公告')
  const res = await toggleNoticeTop(n.id)
  if (res && res.success) {
    await refreshAfterWrite(n.isTop ? '已取消置顶' : '已置顶')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doDelete(n) {
  const ok = await dialogConfirm(`确定删除公告「${n.title}」吗？删除后不可恢复。`)
  if (!ok) return
  const res = await deleteNotice(n.id)
  if (res && res.success) {
    await refreshAfterWrite('删除成功')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

async function doStats(n) {
  const res = await getNoticeReadStats(n.id)
  if (res && res.success) {
    stats.value = res.data || { title: '', totalMembers: 0, readCount: 0, list: [] }
    showStats.value = true
  } else {
    dialogAlert((res && res.message) || '加载统计失败')
  }
}

// Markdown 工具栏：在光标处插入语法标记（有选区则包住选区，无选区插入示例文本）
const contentEl = ref(null)
function insertMd(before, after, placeholder) {
  const ta = contentEl.value
  const cur = form.content || ''
  if (!ta) {
    form.content = cur + before + placeholder + after
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const sel = cur.slice(start, end) || placeholder
  const prefix = start > 0 && cur[start - 1] !== '\n' && before.startsWith('\n') ? '\n' : ''
  form.content = cur.slice(0, start) + prefix + before + sel + after + cur.slice(end)
  ta.focus()
  const pos = start + prefix.length + before.length + sel.length + after.length
  ta.setSelectionRange(pos, pos)
}

onMounted(async () => {
  const res = await getOwnGroup()
  if (res && res.success && res.data) {
    groupName.value = res.data.name || ''
    groupStopped.value = res.data.status === 0
  } else {
    dialogAlert((res && res.message) || '未绑定课题组')
  }
  load()
})
</script>

<style scoped>
.banner-warn {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, var(--bg-card));
  color: var(--warning);
  font-size: 13px;
}
.md-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.md-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.md-preview {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  min-height: 220px;
  max-height: 260px;
  overflow: auto;
  background: var(--bg-hover-soft);
}
@media (max-width: 900px) {
  .md-editor {
    grid-template-columns: 1fr;
  }
}
</style>
