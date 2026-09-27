<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">📚 文献与笔记</h2>
        <p class="page-desc">管理个人文献库，选中文献后在右侧记录阅读笔记。</p>
      </div>
      <div class="head-actions">
        <input class="search" v-model="keyword" placeholder="按标题搜索" @keyup.enter="loadLiterature" />
        <button class="btn primary" @click="openLitModal()">＋ 添加文献</button>
      </div>
    </div>

    <div class="body">
      <!-- 左：文献列表 -->
      <div class="card lit-col">
        <div v-if="litLoading" class="state">加载中…</div>
        <div v-else-if="litError" class="state error">{{ litError }}</div>
        <div v-else-if="!literature.length" class="state">暂无文献，点击右上角添加。</div>
        <div v-else class="lit-list">
          <div
            v-for="l in literature" :key="l.id"
            class="lit-item" :class="{ active: selectedId === l.id }"
            @click="selectLit(l)"
          >
            <div class="lit-title">{{ l.title }}</div>
            <div class="lit-meta">
              <span>{{ l.authors || '佚名' }}</span>
              <span class="dot">·</span>
              <span>{{ l.source || '未知出处' }}</span>
              <span class="dot">·</span>
              <span>{{ l.year || '—' }}</span>
            </div>
            <div class="lit-tags">
              <span class="tag">{{ typeText(l.source_type) }}</span>
              <span class="tag" :class="readClass(l.read_status)">{{ readText(l.read_status) }}</span>
              <button v-if="selectedId === l.id" class="link danger" @click.stop="onRemoveLit(l)">删除</button>
              <button v-if="selectedId === l.id" class="link" @click.stop="openLitModal(l)">编辑</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：笔记 -->
      <div class="card note-col">
        <template v-if="selected">
          <div class="note-head">
            <div>
              <h3 class="note-title">{{ selected.title }}</h3>
              <p class="note-sub">{{ selected.authors }} · {{ selected.source }} · {{ selected.year }}</p>
            </div>
            <button class="btn primary sm" @click="openNoteModal()">＋ 写笔记</button>
          </div>
          <div v-if="noteLoading" class="state">加载笔记…</div>
          <div v-else-if="!notes.length" class="state">本篇文献暂无笔记。</div>
          <div v-else class="note-list">
            <div v-for="n in notes" :key="n.id" class="note-item">
              <div class="note-content">{{ n.content }}</div>
              <div class="note-foot">
                <span class="muted">{{ fmtTime(n.created_at) }}</span>
                <span>
                  <button class="link" @click="openNoteModal(n)">编辑</button>
                  <button class="link danger" @click="onRemoveNote(n)">删除</button>
                </span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="empty-note">
          <div class="empty-icon">📖</div>
          <p>从左侧选择一篇文献，查看或记录阅读笔记</p>
        </div>
      </div>
    </div>

    <!-- 文献弹窗 -->
    <div v-if="litModal.show" class="modal-mask" @click.self="litModal.show = false">
      <div class="modal-box wide">
        <h3 class="modal-title">{{ litModal.form.id ? '编辑文献' : '添加文献' }}</h3>
        <label class="form-item">
          <span class="form-label">标题 <i>*</i></span>
          <input type="text" v-model="litModal.form.title" />
        </label>
        <div class="form-row">
          <label class="form-item">
            <span class="form-label">作者</span>
            <input type="text" v-model="litModal.form.authors" />
          </label>
          <label class="form-item">
            <span class="form-label">来源（期刊/会议/书籍）</span>
            <input type="text" v-model="litModal.form.source" />
          </label>
        </div>
        <div class="form-row">
          <label class="form-item">
            <span class="form-label">类型</span>
            <select v-model="litModal.form.source_type">
              <option value="journal">期刊</option>
              <option value="conference">会议</option>
              <option value="book">书籍</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">年份</span>
            <input type="number" v-model.number="litModal.form.year" />
          </label>
          <label class="form-item">
            <span class="form-label">阅读状态</span>
            <select v-model="litModal.form.read_status">
              <option value="unread">未读</option>
              <option value="reading">在读</option>
              <option value="read">已读</option>
            </select>
          </label>
        </div>
        <label class="form-item">
          <span class="form-label">DOI</span>
          <input type="text" v-model="litModal.form.doi" />
        </label>
        <label class="form-item">
          <span class="form-label">原文链接</span>
          <input type="text" v-model="litModal.form.url" />
        </label>
        <label class="form-item">
          <span class="form-label">摘要</span>
          <textarea rows="3" v-model="litModal.form.abstract"></textarea>
        </label>
        <p v-if="litModal.error" class="form-error">{{ litModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="litModal.show = false">取消</button>
          <button class="btn primary" :disabled="litModal.saving" @click="onSaveLit">
            {{ litModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 笔记弹窗 -->
    <div v-if="noteModal.show" class="modal-mask" @click.self="noteModal.show = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ noteModal.form.id ? '编辑笔记' : '写笔记' }}</h3>
        <label class="form-item">
          <span class="form-label">笔记内容 <i>*</i></span>
          <textarea rows="6" v-model="noteModal.form.content" placeholder="记录核心观点、摘录或思考"></textarea>
        </label>
        <p v-if="noteModal.error" class="form-error">{{ noteModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="noteModal.show = false">取消</button>
          <button class="btn primary" :disabled="noteModal.saving" @click="onSaveNote">
            {{ noteModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  listMyLiterature, createLiterature, updateLiterature, removeLiterature,
  listLiteratureNotes, createLiteratureNote, updateLiteratureNote, removeLiteratureNote
} from '../../api'

const literature = ref([])
const litLoading = ref(false)
const litError = ref('')
const keyword = ref('')
const selectedId = ref(null)
const selected = ref(null)

const notes = ref([])
const noteLoading = ref(false)

const litModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, title: '', authors: '', source: '', source_type: 'journal', year: null, doi: '', url: '', abstract: '', read_status: 'unread' }
})
const noteModal = ref({
  show: false, saving: false, error: '',
  form: { id: null, literature_id: null, content: '' }
})

async function loadLiterature() {
  litLoading.value = true
  litError.value = ''
  try {
    const res = await listMyLiterature({ keyword: keyword.value.trim() || undefined })
    if (res && res.success) {
      literature.value = res.data || []
      if (selected.value && !literature.value.find(l => l.id === selectedId.value)) {
        selectedId.value = null
        selected.value = null
        notes.value = []
      }
    } else {
      litError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    litError.value = '网络异常，请重试'
  } finally {
    litLoading.value = false
  }
}

async function selectLit(l) {
  selectedId.value = l.id
  selected.value = l
  await loadNotes(l.id)
}

async function loadNotes(litId) {
  noteLoading.value = true
  notes.value = []
  try {
    const res = await listLiteratureNotes(litId)
    if (res && res.success) notes.value = res.data || []
  } catch (e) {
    notes.value = []
  } finally {
    noteLoading.value = false
  }
}

function openLitModal(item) {
  litModal.value.error = ''
  if (item) {
    litModal.value.form = {
      id: item.id, title: item.title || '', authors: item.authors || '', source: item.source || '',
      source_type: item.source_type || 'journal', year: item.year || null, doi: item.doi || '',
      url: item.url || '', abstract: item.abstract || '', read_status: item.read_status || 'unread'
    }
  } else {
    litModal.value.form = {
      id: null, title: '', authors: '', source: '', source_type: 'journal',
      year: null, doi: '', url: '', abstract: '', read_status: 'unread'
    }
  }
  litModal.value.show = true
}

async function onSaveLit() {
  const f = litModal.value.form
  if (!f.title || !f.title.trim()) { litModal.value.error = '请填写文献标题'; return }
  litModal.value.saving = true
  litModal.value.error = ''
  try {
    const res = f.id ? await updateLiterature(f) : await createLiterature(f)
    if (res && res.success) {
      litModal.value.show = false
      await loadLiterature()
    } else {
      litModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    litModal.value.error = '网络异常，请重试'
  } finally {
    litModal.value.saving = false
  }
}

async function onRemoveLit(l) {
  if (!window.confirm('确定删除该文献及其笔记吗？')) return
  const res = await removeLiterature(l.id)
  if (res && res.success) {
    selectedId.value = null
    selected.value = null
    notes.value = []
    await loadLiterature()
  } else alert((res && res.message) || '删除失败')
}

function openNoteModal(n) {
  noteModal.value.error = ''
  if (n) {
    noteModal.value.form = { id: n.id, literature_id: selectedId.value, content: n.content || '' }
  } else {
    noteModal.value.form = { id: null, literature_id: selectedId.value, content: '' }
  }
  noteModal.value.show = true
}

async function onSaveNote() {
  const f = noteModal.value.form
  if (!f.content || !f.content.trim()) { noteModal.value.error = '笔记内容不能为空'; return }
  noteModal.value.saving = true
  noteModal.value.error = ''
  try {
    const res = f.id ? await updateLiteratureNote(f) : await createLiteratureNote(f)
    if (res && res.success) {
      noteModal.value.show = false
      await loadNotes(selectedId.value)
    } else {
      noteModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    noteModal.value.error = '网络异常，请重试'
  } finally {
    noteModal.value.saving = false
  }
}

async function onRemoveNote(n) {
  if (!window.confirm('确定删除该笔记吗？')) return
  const res = await removeLiteratureNote(n.id)
  if (res && res.success) await loadNotes(selectedId.value)
  else alert((res && res.message) || '删除失败')
}

function typeText(t) {
  return { journal: '期刊', conference: '会议', book: '书籍', other: '其他' }[t] || t
}
function readText(r) {
  return { unread: '未读', reading: '在读', read: '已读' }[r] || r
}
function readClass(r) {
  return { unread: 't-gray', reading: 't-blue', read: 't-green' }[r] || 't-gray'
}
function fmtTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

loadLiterature()
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-head { display: flex; justify-content: space-between; align-items: center; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 10px; align-items: center; }
.search {
  height: 34px; padding: 0 12px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; width: 180px;
}
.search:focus { border-color: #0d80e0; }

.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn.primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.5; }

.body { display: flex; gap: 16px; align-items: stretch; }
.lit-col { flex: 1.2; min-width: 0; }
.note-col { flex: 1; min-width: 0; }

.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }

.lit-list { display: flex; flex-direction: column; gap: 8px; }
.lit-item {
  padding: 12px 14px; border: 1px solid #eceff3; border-radius: 10px; cursor: pointer;
}
.lit-item:hover { border-color: #0d80e0; }
.lit-item.active { border-color: #0d80e0; background: #eef6ff; }
.lit-title { font-size: 14px; color: #1f2329; font-weight: 500; margin-bottom: 4px; }
.lit-meta { font-size: 12px; color: #8a9099; display: flex; gap: 6px; flex-wrap: wrap; }
.lit-meta .dot { color: #dfe3e8; }
.lit-tags { margin-top: 8px; display: flex; align-items: center; gap: 8px; }
.tag { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #f2f3f5; color: #4e5969; }
.t-blue { background: #e6f4ff; color: #0d80e0; }
.t-green { background: #e8f7ef; color: #19a558; }

.note-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.note-title { margin: 0; font-size: 15px; color: #1f2329; }
.note-sub { margin: 4px 0 0; font-size: 12px; color: #8a9099; }
.note-list { display: flex; flex-direction: column; gap: 10px; }
.note-item { border: 1px solid #eceff3; border-radius: 10px; padding: 12px 14px; background: #fafbfc; }
.note-content { font-size: 13px; color: #1f2329; line-height: 1.7; white-space: pre-wrap; }
.note-foot { display: flex; justify-content: space-between; margin-top: 8px; }
.muted { font-size: 12px; color: #8a9099; }
.empty-note { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #b8bec4; gap: 10px; }
.empty-icon { font-size: 40px; }

.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 12px; padding: 0 4px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #ea4335; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 460px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
.modal-box.wide { width: 600px; max-height: 86vh; overflow-y: auto; }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-row { display: flex; gap: 14px; }
.form-row .form-item { flex: 1; }
.form-label { font-size: 13px; color: #4e5969; }
.form-label i { color: #ea4335; font-style: normal; }
.form-item input, .form-item textarea, .form-item select {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical; background: #fff;
}
.form-item input:focus, .form-item textarea:focus, .form-item select:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
