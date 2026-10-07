<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal md">
      <div class="modal-head">
        <h3>成果详情</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="ad-overview">
          <div class="ad-overview__item"><span class="ad-overview__label">学生</span><b>{{ row.user.realName || row.user.username }}</b></div>
          <div class="ad-overview__item"><span class="ad-overview__label">学号</span><b>{{ row.user.userNo || '-' }}</b></div>
          <div class="ad-overview__item"><span class="ad-overview__label">类型</span><b>{{ row.typeLabel }}</b></div>
          <div class="ad-overview__item"><span class="ad-overview__label">状态</span><span :class="statusTagClass">{{ statusLabel }}</span></div>
          <div class="ad-overview__actions">
            <template v-if="mode === 'mentor'">
              <template v-if="row.status === 'submitted'">
                <button class="btn btn-sm btn-primary" :disabled="acting" @click="confirm">确认</button>
                <button class="btn btn-sm" :disabled="acting" @click="openReturn">退回</button>
              </template>
              <button v-else-if="row.status === 'confirmed'" class="btn btn-sm" :disabled="acting" @click="openReturn">退回</button>
              <button class="btn btn-sm" @click="openCreate">新增成果</button>
            </template>
            <template v-else-if="mode === 'super-admin'">
              <button class="btn btn-sm" @click="openCreate">新增成果</button>
              <button class="btn btn-sm btn-danger" :disabled="acting" @click="remove">删除</button>
            </template>
            <template v-else-if="mode === 'student'">
              <button v-if="row.status !== 'confirmed'" class="btn btn-sm" @click="openEdit">编辑</button>
              <button v-if="row.status === 'pending'" class="btn btn-sm btn-primary" :disabled="acting" @click="submit">提交</button>
              <button class="btn btn-sm btn-danger" :disabled="acting" @click="remove">删除</button>
            </template>
          </div>
        </div>

        <div class="ad-detail">
          <div class="ad-item"><span class="ad-item__label">成果名称</span><span class="ad-item__value">{{ row.title }}</span></div>
          <div class="ad-item"><span class="ad-item__label">发表载体</span><span class="ad-item__value">{{ row.venue || '-' }}</span></div>
          <div class="ad-item"><span class="ad-item__label">级别</span><span class="ad-item__value">{{ row.level || '-' }}</span></div>
          <div class="ad-item"><span class="ad-item__label">作者</span><span class="ad-item__value">{{ row.authors || '-' }}</span></div>
          <div class="ad-item"><span class="ad-item__label">第一作者</span><span class="ad-item__value">{{ row.isFirst ? '是' : '否' }}</span></div>
          <div class="ad-item"><span class="ad-item__label">发表/授权日期</span><span class="ad-item__value">{{ row.publishDate || '-' }}</span></div>
          <div class="ad-item ad-item--block">
            <span class="ad-item__label">附件</span>
            <div class="attach-box">
              <div v-if="!attachments.length" class="attach-empty">无附件</div>
              <div v-for="a in attachments" :key="a.id" class="attach-item">
                <span class="attach-icon">📎</span>
                <span class="attach-name" :title="a.file_name">{{ a.file_name }}</span>
                <span class="attach-size">{{ sizeText(a.file_size) }}</span>
                <button type="button" class="btn btn-sm" @click="onDownload(a)">下载</button>
              </div>
            </div>
          </div>
          <div class="ad-item"><span class="ad-item__label">成果说明</span><span class="ad-item__value ad-item__value--block">{{ row.description || '-' }}</span></div>
          <div v-if="row.rejectReason" class="ad-item"><span class="ad-item__label">退回意见</span><span class="ad-item__value ad-item__value--block" style="color:#dc2626">{{ row.rejectReason }}</span></div>

          <!-- 时间进度 -->
          <div class="ad-item ad-item--block">
            <span class="ad-item__label">时间进度</span>
            <div class="stage-box">
              <div v-if="stageLoading" class="stage-empty">加载中…</div>
              <template v-else>
                <div v-for="(s, i) in timeline" :key="s.nodeKey" class="stage-row" :class="{ 'stage-row--done': s.record && s.record.status === 'confirmed' }">
                  <div class="stage-row__main">
                    <span class="stage-idx">{{ i + 1 }}</span>
                    <span class="stage-name">{{ s.nodeName }}</span>
                    <span :class="stageTagClass(s)">{{ stageStatusLabel(s) }}</span>
                    <span class="stage-date">{{ s.record ? (s.record.happenDate || '待填写日期') : '' }}</span>
                  </div>
                  <div v-if="s.record && (s.record.remark || s.record.rejectReason)" class="stage-note">
                    <span v-if="s.record.remark">备注：{{ s.record.remark }}</span>
                    <span v-if="s.record.rejectReason" style="color:#dc2626">退回意见：{{ s.record.rejectReason }}</span>
                  </div>
                  <div v-if="s.record && s.record.reviewedBy" class="stage-meta">审核：导师 · {{ s.record.reviewedAt || '' }}</div>
                  <div class="stage-actions">
                    <template v-if="mode === 'student' && row.status !== 'confirmed'">
                      <button v-if="!s.record" class="btn btn-sm btn-primary" @click="openRecord(s)">填写</button>
                      <template v-else-if="s.record.status === 'pending'">
                        <button class="btn btn-sm" @click="openRecord(s)">修改</button>
                        <button class="btn btn-sm btn-primary" :disabled="stageActing" @click="submitNode(s)">提交</button>
                      </template>
                      <span v-else-if="s.record.status === 'submitted'" class="stage-hint">待导师确认</span>
                    </template>
                    <template v-else-if="mode === 'mentor'">
                      <template v-if="s.record && s.record.status === 'submitted'">
                        <button class="btn btn-sm btn-primary" :disabled="stageActing" @click="confirmNode(s)">确认</button>
                        <button class="btn btn-sm" :disabled="stageActing" @click="openNodeReturn(s)">退回</button>
                      </template>
                      <button v-else-if="s.record && s.record.status === 'confirmed'" class="btn btn-sm" :disabled="stageActing" @click="openNodeReturn(s)">退回</button>
                    </template>
                  </div>
                </div>
                <div v-if="!timeline.length" class="stage-empty">该成果类型暂未配置进度节点</div>
              </template>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>

  <!-- 退回意见弹窗 -->
  <div v-if="returnVisible" class="modal-mask" @click.self="returnVisible = false">
    <div class="modal sm">
      <div class="modal-head">
        <h3>退回「{{ row.title }}」</h3>
        <button class="modal-close" @click="returnVisible = false">×</button>
      </div>
      <div class="modal-body">
        <textarea v-model="returnReason" class="textarea" rows="4" placeholder="请填写退回意见（必填）"></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="returnVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="!returnReason.trim() || acting" @click="doReturn">
          {{ acting ? '退回中…' : '确认退回' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 节点退回意见弹窗 -->
  <div v-if="nodeReturnVisible" class="modal-mask" @click.self="nodeReturnVisible = false">
    <div class="modal sm">
      <div class="modal-head">
        <h3>退回节点「{{ nodeReturnTarget ? nodeReturnTarget.nodeName : '' }}」</h3>
        <button class="modal-close" @click="nodeReturnVisible = false">×</button>
      </div>
      <div class="modal-body">
        <textarea v-model="nodeReturnReason" class="textarea" rows="4" placeholder="请填写退回意见（必填）"></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="nodeReturnVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="!nodeReturnReason.trim() || stageActing" @click="doNodeReturn">
          {{ stageActing ? '退回中…' : '确认退回' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 编辑 / 代填新增成果弹窗（编辑传 row，新增不传） -->
  <AchievementEditDialog v-model:visible="editVisible" :row="editRow" :user-id="row && row.userId" @save="saveNew" />

  <!-- 节点时间填写弹窗 -->
  <AchievementStageRecordDialog
    v-model:visible="recordVisible"
    :achievement-id="row && row.id"
    :node-key="recordTarget ? recordTarget.nodeKey : ''"
    :node-name="recordTarget ? recordTarget.nodeName : ''"
    :record="recordTarget && recordTarget.record"
    @saved="loadStages"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AchievementEditDialog from './AchievementEditDialog.vue'
import AchievementStageRecordDialog from './AchievementStageRecordDialog.vue'
import {
  confirmAchievement, returnAchievement, submitAchievement, removeAchievement, saveAchievement,
  listAchievementAttachments, downloadAchievementAttachment,
  getAchievementStageRecords, submitAchievementStageRecord, reviewAchievementStageRecord
} from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

const STATUS_LABELS = { pending: '待填写', submitted: '已提交待确认', confirmed: '已确认' }

const props = defineProps({
  visible: { type: Boolean, default: false },
  row: { type: Object, default: null },
  mode: { type: String, default: 'student' } // student / mentor / super-admin / group-admin
})
const emit = defineEmits(['update:visible', 'changed'])

const acting = ref(false)
const returnVisible = ref(false)
const returnReason = ref('')
const editVisible = ref(false)
const editRow = ref(null)
const attachments = ref([])

// 时间进度
const timeline = ref([])
const stageLoading = ref(false)
const stageActing = ref(false)
const recordVisible = ref(false)
const recordTarget = ref(null)
const nodeReturnVisible = ref(false)
const nodeReturnTarget = ref(null)
const nodeReturnReason = ref('')

const STAGE_STATUS_LABELS = { pending: '已填写待提交', submitted: '待导师确认', confirmed: '已确认' }
function stageStatusLabel(s) {
  if (!s.record) return '待填写'
  return STAGE_STATUS_LABELS[s.record.status] || s.record.status
}
function stageTagClass(s) {
  if (!s.record) return 'tag-off'
  return s.record.status === 'confirmed' ? 'tag-ok' : s.record.status === 'submitted' ? 'tag-warn' : 'tag-off'
}

async function loadStages() {
  if (!props.row || !props.row.id) return
  stageLoading.value = true
  try {
    const res = await getAchievementStageRecords(props.row.id)
    if (res && res.success) {
      timeline.value = (res.data && res.data.timeline) || []
    } else {
      dialogAlert((res && res.message) || '加载时间进度失败')
    }
  } finally {
    stageLoading.value = false
  }
}

function openRecord(s) {
  recordTarget.value = s
  recordVisible.value = true
}
async function submitNode(s) {
  const ok = await dialogConfirm(`提交节点「${s.nodeName}」的时间？提交后需导师确认`)
  if (!ok || !s.record) return
  stageActing.value = true
  try {
    const res = await submitAchievementStageRecord(s.record.id)
    if (res && res.success) {
      await refreshAfterWrite('节点已提交，待导师确认')
      loadStages()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '提交失败')
    }
  } finally {
    stageActing.value = false
  }
}
async function confirmNode(s) {
  const ok = await dialogConfirm(`确认节点「${s.nodeName}」？确认后该节点不可再修改`)
  if (!ok || !s.record) return
  stageActing.value = true
  try {
    const res = await reviewAchievementStageRecord({ recordId: s.record.id, action: 'confirm' })
    if (res && res.success) {
      await refreshAfterWrite('节点已确认')
      loadStages()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    stageActing.value = false
  }
}
function openNodeReturn(s) {
  nodeReturnTarget.value = s
  nodeReturnReason.value = ''
  nodeReturnVisible.value = true
}
async function doNodeReturn() {
  const s = nodeReturnTarget.value
  if (!s || !s.record) return
  stageActing.value = true
  try {
    const res = await reviewAchievementStageRecord({
      recordId: s.record.id,
      action: 'return',
      reason: nodeReturnReason.value.trim()
    })
    if (res && res.success) {
      nodeReturnVisible.value = false
      await refreshAfterWrite('节点已退回')
      loadStages()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    stageActing.value = false
  }
}

function sizeText(bytes) {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + 'MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + 'KB'
  return b + 'B'
}

async function loadAttachments(achievementId) {
  try {
    const res = await listAchievementAttachments(achievementId)
    if (res && res.success) {
      attachments.value = (res.data && res.data.list) || []
    }
  } catch (e) {
    // 附件加载失败不打断详情展示
  }
}

async function onDownload(a) {
  try {
    const res = await downloadAchievementAttachment(a.id)
    if (res && res.success) {
      dialogAlert(`附件已保存：${a.file_name}`)
    } else if (!(res && res.canceled)) {
      dialogAlert((res && res.message) || '下载失败，请重试')
    }
  } catch (e) {
    dialogAlert('下载失败，请重试')
  }
}

const statusLabel = computed(() => STATUS_LABELS[props.row && props.row.status] || (props.row && props.row.status) || '')
const statusTagClass = computed(() => {
  const s = props.row && props.row.status
  return s === 'confirmed' ? 'tag-ok' : s === 'submitted' ? 'tag-warn' : 'tag-off'
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      returnVisible.value = false
      editVisible.value = false
      attachments.value = []
      nodeReturnVisible.value = false
      timeline.value = []
      if (props.row && props.row.id) {
        loadAttachments(props.row.id)
        loadStages()
      }
    }
  }
)

function close() {
  emit('update:visible', false)
}

async function confirm() {
  const ok = await dialogConfirm(`确认成果「${props.row.title}」？`)
  if (!ok) return
  acting.value = true
  try {
    const res = await confirmAchievement(props.row.id)
    if (res && res.success) {
      await refreshAfterWrite('已确认')
      close()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    acting.value = false
  }
}

function openReturn() {
  returnReason.value = ''
  returnVisible.value = true
}
async function doReturn() {
  acting.value = true
  try {
    const res = await returnAchievement(props.row.id, returnReason.value.trim())
    if (res && res.success) {
      returnVisible.value = false
      await refreshAfterWrite('已退回')
      close()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '操作失败')
    }
  } finally {
    acting.value = false
  }
}

function openCreate() {
  editRow.value = null
  editVisible.value = true
}
async function saveNew(payload) {
  const res = await saveAchievement(payload)
  if (res && res.success) {
    editVisible.value = false
    await refreshAfterWrite('已保存')
    close()
    emit('changed')
  } else {
    dialogAlert((res && res.message) || '保存失败')
  }
}

function openEdit() {
  editRow.value = props.row
  editVisible.value = true
}
async function submit() {
  const ok = await dialogConfirm(`确认提交「${props.row.title}」？提交后需导师确认`)
  if (!ok) return
  acting.value = true
  try {
    const res = await submitAchievement(props.row.id)
    if (res && res.success) {
      await refreshAfterWrite('已提交，待导师确认')
      close()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '提交失败')
    }
  } finally {
    acting.value = false
  }
}

async function remove() {
  const ok = await dialogConfirm(`确认删除「${props.row.title}」？`)
  if (!ok) return
  acting.value = true
  try {
    const res = await removeAchievement(props.row.id)
    if (res && res.success) {
      await refreshAfterWrite('已删除')
      close()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '删除失败')
    }
  } finally {
    acting.value = false
  }
}
</script>

<style scoped>
.textarea {
  width: 100%;
  min-height: 90px;
  padding: 8px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  font-size: 14px;
  font-family: inherit;
  color: var(--text, #111827);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.ad-overview {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 16px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 8px;
  align-items: center;
  background: var(--bg-2, #f9fafb);
}
.ad-overview__item { display: flex; align-items: baseline; gap: 8px; }
.ad-overview__label { font-size: 13px; color: var(--text-2, #6b7280); }
.ad-overview__actions { margin-left: auto; display: flex; gap: 8px; }
.ad-detail { display: flex; flex-direction: column; gap: 10px; }
.ad-item { display: flex; gap: 12px; align-items: baseline; }
.ad-item--block { align-items: flex-start; }
.ad-item__label { width: 96px; flex-shrink: 0; font-size: 13px; color: var(--text-2, #6b7280); }
.ad-item__value { font-size: 14px; color: var(--text, #111827); word-break: break-all; }
.ad-item__value--block { flex: 1; white-space: pre-wrap; }
.attach-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-2, #f9fafb);
}
.attach-empty { font-size: 12px; color: var(--text-3, #9aa0aa); }
.attach-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.attach-icon { color: var(--text-2, #6b7280); }
.attach-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text, #111827);
}
.attach-size { color: var(--text-3, #9aa0aa); }
.stage-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-2, #f9fafb);
}
.stage-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-card, #fff);
  border-left: 3px solid var(--border, #e5e7eb);
}
.stage-row--done { border-left-color: #16a34a; }
.stage-row__main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.stage-idx {
  width: 18px; height: 18px; line-height: 18px; text-align: center;
  font-size: 11px; color: var(--text-2, #6b7280);
  background: var(--bg-2, #f3f4f6); border-radius: 50%;
}
.stage-name { font-size: 13px; font-weight: 600; color: var(--text, #111827); }
.stage-date { font-size: 12px; color: var(--text-2, #6b7280); }
.stage-note { font-size: 12px; color: var(--text-2, #6b7280); display: flex; gap: 12px; flex-wrap: wrap; padding-left: 26px; }
.stage-meta { font-size: 11px; color: var(--text-3, #9aa0aa); padding-left: 26px; }
.stage-actions { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.stage-hint { font-size: 12px; color: #d97706; }
.stage-empty { font-size: 12px; color: var(--text-3, #9aa0aa); padding: 6px 0; }
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-warn { background: #fffbeb; color: #d97706; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.btn-danger { color: #dc2626; border-color: #fecaca; }
</style>
