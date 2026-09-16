<template>
  <div class="page">
    <div class="page-head">
      <h3 class="page-title">讨论区</h3>
      <div class="head-actions">
        <button class="btn btn-primary" @click="openCreate">发帖</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>类型</th>
            <th>作者ID</th>
            <th>浏览</th>
            <th>回复</th>
            <th>时间</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="state">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="7" class="state">暂无帖子</td></tr>
          <tr v-for="row in list" :key="row.id" v-else>
            <td class="title-cell" @click="openDetail(row)">{{ row.title }}</td>
            <td>{{ typeLabel(row.type) }}</td>
            <td>{{ row.author_id }}</td>
            <td>{{ row.view_count }}</td>
            <td>{{ row.reply_count }}</td>
            <td>{{ fmt(row.created_at) }}</td>
            <td class="col-ops">
              <button class="btn-link" @click="openDetail(row)">查看</button>
              <button class="btn-link danger" @click="removePost(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发帖弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal-box">
        <div class="modal-head">
          <h4>发帖</h4>
          <button class="modal-close" @click="formVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">标题<span class="req"> *</span></label>
            <input v-model="form.title" class="form-input" />
          </div>
          <div class="form-item">
            <label class="form-label">类型</label>
            <select v-model="form.type" class="form-input">
              <option v-for="o in FORUM_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">内容</label>
            <textarea v-model="form.content" class="form-input" rows="4"></textarea>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formVisible = false">取消</button>
          <button class="btn btn-primary" @click="submit" :disabled="saving">{{ saving ? '发布中…' : '发布' }}</button>
        </div>
      </div>
    </div>

    <!-- 帖子详情弹窗 -->
    <div v-if="detailVisible" class="modal-mask" @click.self="detailVisible = false">
      <div class="modal-box detail-box">
        <div class="modal-head">
          <h4>{{ currentPost.title }}</h4>
          <button class="modal-close" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body">
          <p class="post-meta">作者ID：{{ currentPost.author_id }} · {{ fmt(currentPost.created_at) }}</p>
          <p class="post-content">{{ currentPost.content || '（无正文）' }}</p>
          <div class="divider"></div>
          <p class="reply-title">回复（{{ replies.length }}）</p>
          <div v-if="!replies.length" class="empty-tip">暂无回复</div>
          <div v-for="r in replies" :key="r.id" class="reply-item">
            <span class="reply-author">{{ r.author_id }}</span>
            <span class="reply-time">{{ fmt(r.created_at) }}</span>
            <p class="reply-content">{{ r.content }}</p>
          </div>
          <div class="reply-form">
            <textarea v-model="replyText" class="form-input" rows="2" placeholder="写下你的回复…"></textarea>
            <button class="btn btn-primary" @click="submitReply">回复</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collab } from '../../api'
import { FORUM_TYPE_OPTIONS } from '../../config/fieldOptions'

const list = ref([])
const loading = ref(false)
const formVisible = ref(false)
const form = ref({})
const formError = ref('')
const saving = ref(false)
const detailVisible = ref(false)
const currentPost = ref({})
const replies = ref([])
const replyText = ref('')

function fmt(v) {
  return v ? String(v).slice(0, 16) : '-'
}
function typeLabel(v) {
  const o = FORUM_TYPE_OPTIONS.find((x) => x.value === v)
  return o ? o.label : (v || '-')
}

async function load() {
  loading.value = true
  try {
    const res = await collab.post.list()
    list.value = res && res.success ? res.list || [] : []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { title: '', type: 'post', content: '' }
  formError.value = ''
  formVisible.value = true
}

async function submit() {
  formError.value = ''
  if (!form.value.title || !String(form.value.title).trim()) {
    formError.value = '请填写标题'
    return
  }
  saving.value = true
  try {
    const res = await collab.post.create(form.value)
    if (res && res.success) {
      formVisible.value = false
      await load()
    } else {
      formError.value = (res && res.message) || '发布失败'
    }
  } catch (e) {
    formError.value = '发布过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}

async function openDetail(row) {
  currentPost.value = row
  replies.value = []
  replyText.value = ''
  detailVisible.value = true
  // 浏览 +1（失败静默忽略）
  collab.viewPost(row.id).catch(() => {})
  try {
    const res = await collab.replyList(row.id)
    replies.value = res && res.success ? res.list || [] : []
  } catch (e) {
    replies.value = []
  }
}

async function submitReply() {
  if (!replyText.value.trim()) return
  try {
    const res = await collab.reply(currentPost.value.id, replyText.value.trim())
    if (res && res.success) {
      replyText.value = ''
      const r = await collab.replyList(currentPost.value.id)
      replies.value = r && r.success ? r.list || [] : []
      await load()
    } else {
      window.alert((res && res.message) || '回复失败')
    }
  } catch (e) {
    window.alert('回复过程出现异常，请重试')
  }
}

async function removePost(row) {
  if (!window.confirm(`确定删除帖子「${row.title}」吗？`)) return
  try {
    const res = await collab.post.remove(row.id)
    if (res && res.success) await load()
    else window.alert((res && res.message) || '删除失败')
  } catch (e) {
    window.alert('删除过程出现异常，请重试')
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 16px 18px;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.btn {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eceff3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.data-table th {
  background: #f5f7fa;
  color: #4e5969;
  font-weight: 600;
}
.state {
  text-align: center;
  color: #8a9099;
  padding: 32px 0;
}
.title-cell {
  color: #0d80e0;
  cursor: pointer;
}
.col-ops {
  width: 110px;
}
.btn-link {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  padding: 0 5px;
}
.btn-link.danger {
  color: #ea4335;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}
.detail-box {
  width: 600px;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eceff3;
}
.modal-head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}
.form-item {
  margin-bottom: 12px;
}
.form-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.req {
  color: #ea4335;
}
.form-input {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
.form-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #eceff3;
}
.post-meta {
  font-size: 12px;
  color: #8a9099;
  margin: 0 0 8px;
}
.post-content {
  font-size: 13px;
  line-height: 1.7;
  color: #1f2329;
  white-space: pre-wrap;
  margin: 0;
}
.divider {
  height: 1px;
  background: #eceff3;
  margin: 16px 0;
}
.reply-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}
.reply-item {
  border-left: 3px solid #e5e6eb;
  padding: 8px 12px;
  margin-bottom: 10px;
}
.reply-author {
  font-size: 13px;
  font-weight: 600;
  color: #0d80e0;
  margin-right: 8px;
}
.reply-time {
  font-size: 12px;
  color: #8a9099;
}
.reply-content {
  font-size: 13px;
  line-height: 1.6;
  color: #4e5969;
  margin: 6px 0 0;
  white-space: pre-wrap;
}
.reply-form {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reply-form .btn {
  align-self: flex-end;
}
.empty-tip {
  text-align: center;
  color: #8a9099;
  padding: 16px 0;
}
</style>
