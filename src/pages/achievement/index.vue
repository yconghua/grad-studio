<template>
  <div class="ach-page">
    <div class="header-card">
      <div class="header-left">
        <h2 class="page-title">🏆 科研成果</h2>
        <p class="page-desc">学生申报科研成果与论文投稿，导师审核归档。</p>
      </div>
      <div class="header-right">
        <button v-if="tab === 'ach' && !isManager" class="btn btn-primary" @click="openAchModal()">
          ＋ 新增成果
        </button>
        <button v-if="tab === 'paper' && !isManager" class="btn btn-primary" @click="openPaperModal()">＋ 新增论文</button>
      </div>
    </div>

    <div class="tab-bar">
      <button :class="['tab-btn', { active: tab === 'ach' }]" @click="switchTab('ach')">科研成果</button>
      <button :class="['tab-btn', { active: tab === 'paper' }]" @click="switchTab('paper')">论文投稿</button>
    </div>

    <!-- 科研成果 -->
    <div v-show="tab === 'ach'" class="card">
      <p v-if="loadingAch" class="empty-tip">加载中…</p>
      <p v-else-if="!achievements.length" class="empty-tip">{{ isManager ? '暂无全组成果' : '暂无我的成果' }}</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>成果名称</th>
            <th v-if="isManager">归属人</th>
            <th>提交日期</th>
            <th>状态</th>
            <th>审核意见</th>
            <th>{{ isManager ? '操作' : (editableMode ? '操作' : '') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in achievements" :key="a.id" @click="openAchDetail(a)" style="cursor:pointer">
            <td>{{ achTypeText(a.ach_type) }}</td>
            <td class="cell-title">{{ a.title }}</td>
            <td v-if="isManager">{{ nameOf(a.user_id) }}</td>
            <td class="cell-time">{{ a.submit_date || '—' }}</td>
            <td><span :class="['status-tag', 'st-' + a.status]">{{ achStatusText(a.status) }}</span></td>
            <td class="cell-desc">{{ a.audit_comment || '—' }}</td>
            <td @click.stop>
              <template v-if="isManager && a.status === 'pending'">
                <button class="btn btn-mini btn-primary" @click="openReviewModal(a, 'approved')">通过</button>
                <button class="btn btn-mini btn-danger" @click="openReviewModal(a, 'rejected')">驳回</button>
              </template>
              <template v-else-if="editableMode && a.status === 'pending'">
                <button class="btn btn-mini" @click="openAchModal(a)">编辑</button>
                <button class="btn btn-mini btn-danger" @click="onRemoveAch(a)">删除</button>
              </template>
              <template v-else-if="editableMode">
                <button class="btn btn-mini btn-danger" @click="onRemoveAch(a)">删除</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 论文投稿 -->
    <div v-show="tab === 'paper'" class="card">
      <p v-if="loadingPaper" class="empty-tip">加载中…</p>
      <p v-else-if="!papers.length" class="empty-tip">暂无论文投稿记录</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>论文标题</th>
            <th>作者</th>
            <th v-if="isManager">归属人</th>
            <th>期刊 / 会议</th>
            <th>等级</th>
            <th>状态</th>
            <th>投稿日期</th>
            <th>发表日期</th>
            <th>DOI</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in papers" :key="p.id" @click="openPaperDetail(p)" style="cursor:pointer">
            <td class="cell-title">{{ p.title }}</td>
            <td class="cell-desc">{{ p.authors || '—' }}</td>
            <td v-if="isManager">{{ paperOwnerName(p) }}</td>
            <td>{{ p.journal || p.conference || '—' }}</td>
            <td>{{ p.level_desc || '—' }}</td>
            <td><span :class="['status-tag', 'pt-' + p.status]">{{ paperStatusText(p.status) }}</span></td>
            <td class="cell-time">{{ p.submit_date || '—' }}</td>
            <td class="cell-time">{{ p.publish_date || '—' }}</td>
            <td class="cell-desc">{{ p.doi || '—' }}</td>
            <td @click.stop>
              <button v-if="!isManager" class="btn btn-mini" @click="openPaperModal(p)">编辑</button>
              <button v-if="!isManager" class="btn btn-mini btn-danger" @click="onRemovePaper(p)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 成果新增/编辑弹窗 -->
    <div v-if="achModal.visible" class="modal-mask" @click.self="achModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ achModal.form.id ? '编辑成果' : '新增成果' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">成果名称 *</span>
            <input v-model="achModal.form.title" type="text" placeholder="成果名称" />
          </label>
          <label class="form-item">
            <span class="form-label">类型</span>
            <select v-model="achModal.form.ach_type">
              <option value="paper">论文</option>
              <option value="patent">专利</option>
              <option value="software">软著</option>
              <option value="award">获奖</option>
              <option value="project">项目</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">提交日期</span>
            <input v-model="achModal.form.submit_date" type="date" />
          </label>
          <label class="form-item full">
            <span class="form-label">成果说明</span>
            <textarea v-model="achModal.form.description" rows="3" placeholder="成果简介 / 说明"></textarea>
          </label>
          <label class="form-item full">
            <span class="form-label">证明材料附件路径</span>
            <input v-model="achModal.form.file_path" type="text" placeholder="附件路径（可空）" />
          </label>
          <label class="form-item full">
            <span class="form-label">备注</span>
            <input v-model="achModal.form.remark" type="text" />
          </label>
        </div>
        <p v-if="achModal.error" class="form-error">{{ achModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="achModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="achModal.saving" @click="onSaveAch">
            {{ achModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 成果审核弹窗 -->
    <div v-if="reviewModal.visible" class="modal-mask" @click.self="reviewModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ reviewModal.form.status === 'approved' ? '审核通过' : '审核驳回' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">审核意见</span>
            <textarea v-model="reviewModal.form.audit_comment" rows="3" placeholder="审核意见（可空）"></textarea>
          </label>
        </div>
        <p v-if="reviewModal.error" class="form-error">{{ reviewModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="reviewModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="reviewModal.saving" @click="onReviewAch">
            {{ reviewModal.saving ? '提交中…' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 论文新增/编辑弹窗 -->
    <div v-if="paperModal.visible" class="modal-mask" @click.self="paperModal.visible = false">
      <div class="modal-box">
        <h3 class="modal-title">{{ paperModal.form.id ? '编辑论文' : '新增论文' }}</h3>
        <div class="form-grid">
          <label class="form-item full">
            <span class="form-label">论文标题 *</span>
            <input v-model="paperModal.form.title" type="text" placeholder="论文标题" />
          </label>
          <label class="form-item full">
            <span class="form-label">作者列表</span>
            <input v-model="paperModal.form.authors" type="text" placeholder="按署名顺序填写" />
          </label>
          <label class="form-item">
            <span class="form-label">投稿期刊</span>
            <input v-model="paperModal.form.journal" type="text" />
          </label>
          <label class="form-item">
            <span class="form-label">会议名称</span>
            <input v-model="paperModal.form.conference" type="text" />
          </label>
          <label class="form-item">
            <span class="form-label">期刊等级 / 分区</span>
            <input v-model="paperModal.form.level_desc" type="text" placeholder="如 JCR Q1" />
          </label>
          <label class="form-item">
            <span class="form-label">投稿状态</span>
            <select v-model="paperModal.form.status">
              <option value="drafting">撰写中</option>
              <option value="submitted">已投稿</option>
              <option value="under_review">在审</option>
              <option value="accepted">已录用</option>
              <option value="published">已发表</option>
              <option value="rejected">被拒</option>
            </select>
          </label>
          <label class="form-item">
            <span class="form-label">投稿日期</span>
            <input v-model="paperModal.form.submit_date" type="date" />
          </label>
          <label class="form-item">
            <span class="form-label">录用日期</span>
            <input v-model="paperModal.form.accept_date" type="date" />
          </label>
          <label class="form-item">
            <span class="form-label">发表日期</span>
            <input v-model="paperModal.form.publish_date" type="date" />
          </label>
          <label class="form-item full">
            <span class="form-label">DOI</span>
            <input v-model="paperModal.form.doi" type="text" />
          </label>
          <label class="form-item full check-item">
            <input v-model="paperModal.form.is_first_author" type="checkbox" true-value="1" false-value="0" />
            <span class="form-label">本人为第一作者</span>
          </label>
        </div>
        <p v-if="paperModal.error" class="form-error">{{ paperModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="paperModal.visible = false">取消</button>
          <button class="btn btn-primary" :disabled="paperModal.saving" @click="onSavePaper">
            {{ paperModal.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
    <!-- 成果详情弹窗（只读） -->
    <div v-if="achDetail.visible" class="modal-mask" @click.self="achDetail.visible = false">
      <div class="modal-box detail-box">
        <h3 class="modal-title">成果详情</h3>
        <div v-if="achDetail.row" class="detail-grid">
          <div class="detail-item full"><span class="detail-label">成果名称</span><span class="detail-value">{{ achDetail.row.title }}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">{{ achTypeText(achDetail.row.ach_type) }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value"><span :class="['status-tag', 'st-' + achDetail.row.status]">{{ achStatusText(achDetail.row.status) }}</span></span></div>
          <div class="detail-item"><span class="detail-label">提交日期</span><span class="detail-value">{{ fmtDate(achDetail.row.submit_date) }}</span></div>
          <div class="detail-item" v-if="isManager"><span class="detail-label">归属人</span><span class="detail-value">{{ nameOf(achDetail.row.user_id) }}</span></div>
          <div class="detail-item full"><span class="detail-label">成果说明</span><span class="detail-value detail-text">{{ achDetail.row.description || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">审核意见</span><span class="detail-value detail-text">{{ achDetail.row.audit_comment || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">附件路径</span><span class="detail-value detail-text">{{ achDetail.row.file_path || '—' }}</span></div>
          <div class="detail-item full"><span class="detail-label">备注</span><span class="detail-value detail-text">{{ achDetail.row.remark || '—' }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="achDetail.visible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 论文详情弹窗（只读） -->
    <div v-if="paperDetail.visible" class="modal-mask" @click.self="paperDetail.visible = false">
      <div class="modal-box detail-box">
        <h3 class="modal-title">论文详情</h3>
        <div v-if="paperDetail.row" class="detail-grid">
          <div class="detail-item full"><span class="detail-label">论文标题</span><span class="detail-value">{{ paperDetail.row.title }}</span></div>
          <div class="detail-item full"><span class="detail-label">作者列表</span><span class="detail-value">{{ paperDetail.row.authors || '—' }}</span></div>
          <div class="detail-item" v-if="isManager"><span class="detail-label">归属人</span><span class="detail-value">{{ paperOwnerName(paperDetail.row) }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value"><span :class="['status-tag', 'pt-' + paperDetail.row.status]">{{ paperStatusText(paperDetail.row.status) }}</span></span></div>
          <div class="detail-item"><span class="detail-label">期刊 / 会议</span><span class="detail-value">{{ paperDetail.row.journal || paperDetail.row.conference || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">等级 / 分区</span><span class="detail-value">{{ paperDetail.row.level_desc || '—' }}</span></div>
          <div class="detail-item"><span class="detail-label">本人一作</span><span class="detail-value">{{ paperDetail.row.is_first_author ? '是' : '否' }}</span></div>
          <div class="detail-item"><span class="detail-label">投稿日期</span><span class="detail-value">{{ fmtDate(paperDetail.row.submit_date) }}</span></div>
          <div class="detail-item"><span class="detail-label">录用日期</span><span class="detail-value">{{ fmtDate(paperDetail.row.accept_date) }}</span></div>
          <div class="detail-item"><span class="detail-label">发表日期</span><span class="detail-value">{{ fmtDate(paperDetail.row.publish_date) }}</span></div>
          <div class="detail-item full"><span class="detail-label">DOI</span><span class="detail-value">{{ paperDetail.row.doi || '—' }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="paperDetail.visible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { ref, onMounted, watch } from 'vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'
import {
  listMyAchievements, createAchievement, updateAchievement, removeAchievement,
  listAllAchievements, reviewAchievement,
  listPapers, createPaper, updatePaper, removePaper,
  listMembers
} from '../../api'

const { currentGroupId } = useGroupContext()
const { isManager, isStudent } = useRole()
const editableMode = !isManager

const tab = ref('ach')
const achievements = ref([])
const papers = ref([])
const members = ref([])
const loadingAch = ref(false)
const loadingPaper = ref(false)

const ACH_TYPE_TEXT = { paper: '论文', patent: '专利', software: '软著', award: '获奖', project: '项目', other: '其他' }
const ACH_STATUS_TEXT = { pending: '待审核', approved: '已通过', rejected: '已打回' }
const PAPER_STATUS_TEXT = {
  drafting: '撰写中', submitted: '已投稿', under_review: '在审',
  accepted: '已录用', published: '已发表', rejected: '被拒'
}

function achTypeText(t) { return ACH_TYPE_TEXT[t] || t || '—' }
function achStatusText(s) { return ACH_STATUS_TEXT[s] || s || '—' }
function paperStatusText(s) { return PAPER_STATUS_TEXT[s] || s || '—' }
function nameOf(id) {
  const m = members.value.find((x) => x.id === Number(id))
  return m ? memberLabel(m) : (id ? ('#' + id) : '—')
}
function memberLabel(m) {
  return m.real_name ? m.real_name + '（' + m.username + '）' : (m.username || ('#' + m.id))
}
function paperOwnerName(p) {
  if (p.real_name || p.username) {
    return p.real_name ? p.real_name + '（' + p.username + '）' : p.username
  }
  return nameOf(p.user_id)
}

// ===== 详情弹窗 =====
const achDetail = ref({ visible: false, row: null })
function openAchDetail(row) {
  achDetail.value.row = row
  achDetail.value.visible = true
}
const paperDetail = ref({ visible: false, row: null })
function openPaperDetail(row) {
  paperDetail.value.row = row
  paperDetail.value.visible = true
}
function fmtDate(v) { return v || '—' }

async function loadMembers() {
  try {
    const res = await listMembers()
    if (res && res.success) members.value = res.members || []
  } catch (e) { /* 忽略 */ }
}

async function loadAchievements() {
  loadingAch.value = true
  try {
    if (isManager && !currentGroupId.value) {
      achievements.value = []
      return
    }
    const res = isManager
      ? await listAllAchievements({ group_id: currentGroupId.value })
      : await listMyAchievements()
    if (res && res.success) {
      achievements.value = res.data || []
    } else {
      achievements.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loadingAch.value = false }
}

async function loadPapers() {
  loadingPaper.value = true
  try {
    const opts = (isManager && currentGroupId.value) ? { group_id: currentGroupId.value } : {}
    const res = await listPapers(opts)
    if (res && res.success) {
      papers.value = res.data || []
    } else {
      papers.value = []
      if (res && res.message) dialogAlert(res.message)
    }
  } finally { loadingPaper.value = false }
}

function switchTab(t) {
  tab.value = t
  if (t === 'paper') loadPapers()
}

// ===== 成果弹窗（学生新增/编辑） =====
const emptyAch = () => ({ id: null, ach_type: 'paper', title: '', description: '', file_path: '', submit_date: '', remark: '' })
const achModal = ref({ visible: false, saving: false, error: '', form: emptyAch() })

function openAchModal(row) {
  if (isManager) return
  achModal.value.form = row ? {
    id: row.id, ach_type: row.ach_type || 'paper', title: row.title,
    description: row.description || '', file_path: row.file_path || '',
    submit_date: row.submit_date || '', remark: row.remark || ''
  } : emptyAch()
  achModal.value.error = ''
  achModal.value.visible = true
}

async function onSaveAch() {
  const f = achModal.value.form
  if (!f.title.trim()) { achModal.value.error = '请填写成果名称'; return }
  achModal.value.saving = true
  achModal.value.error = ''
  const payload = {
    ach_type: f.ach_type, title: f.title.trim(), description: f.description,
    file_path: f.file_path, submit_date: f.submit_date, remark: f.remark
  }
  try {
    const res = f.id ? await updateAchievement({ id: f.id, ...payload }) : await createAchievement(payload)
    if (res && res.success) {
      achModal.value.visible = false
      loadAchievements()
    } else {
      achModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    achModal.value.error = '保存失败，请稍后重试'
  } finally {
    achModal.value.saving = false
  }
}

async function onRemoveAch(row) {
  if (!await dialogConfirm(`确认删除成果「${row.title}」？`)) return
  const res = await removeAchievement(row.id)
  if (res && res.success) loadAchievements()
  else dialogAlert((res && res.message) || '删除失败')
}

// ===== 成果审核弹窗 =====
const reviewModal = ref({ visible: false, saving: false, error: '', form: { id: null, status: 'approved', audit_comment: '' } })
function openReviewModal(row, status) {
  reviewModal.value.form = { id: row.id, status, audit_comment: '' }
  reviewModal.value.error = ''
  reviewModal.value.visible = true
}
async function onReviewAch() {
  const f = reviewModal.value.form
  reviewModal.value.saving = true
  reviewModal.value.error = ''
  try {
    const res = await reviewAchievement({ id: f.id, status: f.status, audit_comment: f.audit_comment, group_id: currentGroupId.value })
    if (res && res.success) {
      reviewModal.value.visible = false
      loadAchievements()
    } else {
      reviewModal.value.error = (res && res.message) || '操作失败'
    }
  } catch (e) {
    reviewModal.value.error = '操作失败，请稍后重试'
  } finally {
    reviewModal.value.saving = false
  }
}

// ===== 论文弹窗 =====
const emptyPaper = () => ({
  id: null, title: '', authors: '', journal: '', conference: '', level_desc: '',
  status: 'drafting', is_first_author: '1', submit_date: '', accept_date: '', publish_date: '', doi: ''
})
const paperModal = ref({ visible: false, saving: false, error: '', form: emptyPaper() })

function openPaperModal(row) {
  paperModal.value.form = row ? {
    id: row.id, title: row.title, authors: row.authors || '', journal: row.journal || '',
    conference: row.conference || '', level_desc: row.level_desc || '', status: row.status || 'drafting',
    is_first_author: String(row.is_first_author ?? 1), submit_date: row.submit_date || '',
    accept_date: row.accept_date || '', publish_date: row.publish_date || '', doi: row.doi || ''
  } : emptyPaper()
  paperModal.value.error = ''
  paperModal.value.visible = true
}

async function onSavePaper() {
  const f = paperModal.value.form
  if (!f.title.trim()) { paperModal.value.error = '请填写论文标题'; return }
  paperModal.value.saving = true
  paperModal.value.error = ''
  const payload = {
    title: f.title.trim(), authors: f.authors, journal: f.journal, conference: f.conference,
    level_desc: f.level_desc, status: f.status, is_first_author: Number(f.is_first_author),
    submit_date: f.submit_date, accept_date: f.accept_date, publish_date: f.publish_date, doi: f.doi
  }
  try {
    const res = f.id ? await updatePaper({ id: f.id, ...payload }) : await createPaper(payload)
    if (res && res.success) {
      paperModal.value.visible = false
      loadPapers()
    } else {
      paperModal.value.error = (res && res.message) || '保存失败'
    }
  } catch (e) {
    paperModal.value.error = '保存失败，请稍后重试'
  } finally {
    paperModal.value.saving = false
  }
}

async function onRemovePaper(row) {
  if (!await dialogConfirm(`确认删除论文「${row.title}」？`)) return
  const res = await removePaper(row.id)
  if (res && res.success) loadPapers()
  else dialogAlert((res && res.message) || '删除失败')
}

watch(currentGroupId, () => {
  if (isManager) {
    loadAchievements()
    if (tab.value === 'paper') loadPapers()
  }
})

onMounted(() => {
  loadMembers()
  loadAchievements()
})
</script>

<style scoped>
.header-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05);
}
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }

.tab-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.tab-btn {
  padding: 7px 18px; border: 1px solid #dfe3e8; border-radius: 8px; background: #fff;
  font-size: 13px; color: #4e5969; cursor: pointer;
}
.tab-btn.active {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border-color: transparent;
}

.card {
  background: #fff; border-radius: 12px; padding: 8px;
  box-shadow: 0 2px 8px rgba(15, 35, 80, 0.05); overflow-x: auto;
}
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969;
  font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.cell-desc { max-width: 200px; color: #4e5969; }

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-approved { background: #e8f7ee; color: #19a558; }
.st-rejected { background: #fdecea; color: #ea4335; }
.st-pending { background: #fff5e6; color: #e8890c; }
.pt-drafting { background: #f0f2f5; color: #8a9099; }
.pt-submitted, .pt-under_review { background: #e8f0fb; color: #0d80e0; }
.pt-accepted { background: #e8f7ee; color: #19a558; }
.pt-published { background: #e8f7ee; color: #19a558; }
.pt-rejected { background: #fdecea; color: #ea4335; }

.empty-tip { text-align: center; color: #8a9099; font-size: 13px; padding: 36px 0; }

.btn {
  padding: 7px 14px; border-radius: 8px; border: 1px solid #dfe3e8; background: #fff;
  font-size: 13px; color: #1f2329; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-primary {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff; border: none;
}
.btn-primary:hover { opacity: 0.9; color: #fff; }
.btn-danger { color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { border-color: #ea4335; color: #ea4335; }
.btn-mini { padding: 4px 10px; font-size: 12px; margin-right: 6px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(20, 30, 50, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 22px 24px; width: 600px; max-width: 92vw;
  max-height: 86vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-title { margin: 0 0 16px; font-size: 16px; color: #1f2329; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
.form-item { display: flex; flex-direction: column; gap: 5px; }
.form-item.full { grid-column: 1 / -1; }
.check-item { flex-direction: row; align-items: center; flex-direction: row; }
.check-item input { width: 16px; height: 16px; }
.form-label { font-size: 12px; color: #4e5969; }
.form-item input, .form-item select, .form-item textarea {
  border: 1px solid #dfe3e8; border-radius: 8px; padding: 8px 10px; font-size: 13px;
  outline: none; background: #fff; color: #1f2329; font-family: inherit;
}
.form-item input:focus, .form-item select:focus, .form-item textarea:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 10px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item.full { grid-column: 1 / -1; }
.detail-label { font-size: 12px; color: #8a9099; }
.detail-value { font-size: 13px; color: #1f2329; }
.detail-value.detail-text { white-space: pre-wrap; line-height: 1.6; }

/* ===== 详情弹窗美化（仅 .detail-box 容器内生效） ===== */
.detail-box {
  padding: 0;
  overflow: hidden;
  border: 1px solid #eef1f5;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 35, 80, 0.22);
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.detail-box .modal-title {
  margin: 0;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  color: #1f2329;
  background: linear-gradient(135deg, #f2f8ff 0%, #f2faf6 100%);
  border-bottom: 1px solid #eef1f5;
  flex: 0 0 auto;
}
.detail-box .modal-title::before {
  content: '';
  flex: 0 0 auto;
  width: 4px;
  height: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, #0d80e0, #19a558);
}
.detail-box .detail-grid {
  padding: 20px 24px;
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
.detail-box .detail-item {
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 10px;
  padding: 10px 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.detail-box .detail-item:hover {
  border-color: #cfe4f7;
  box-shadow: 0 2px 8px rgba(13, 128, 224, 0.06);
}
.detail-box .detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8a9099;
}
.detail-box .detail-label::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-value {
  font-size: 13px;
  color: #1f2329;
  line-height: 1.6;
}
.detail-box .detail-value.detail-text {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #4e5969;
  max-height: 40vh;
  overflow-y: auto;
}
.detail-box .modal-actions {
  margin: 0;
  padding: 14px 24px;
  background: #fafbfc;
  border-top: 1px solid #eef1f5;
  flex: 0 0 auto;
}
.detail-box .modal-actions .btn {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border: none;
  color: #fff;
  font-weight: 600;
  min-width: 80px;
}
.detail-box .modal-actions .btn:hover {
  opacity: 0.92;
  color: #fff;
  border-color: transparent;
}
</style>
