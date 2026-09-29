<template>
  <div class="page">
    <div class="page-head card">
      <div class="header-left">
        <h2 class="page-title">🎓 学位进度</h2>
        <p class="page-desc">查看本组学位培养节点与我当前的完成情况（只读，由导师维护）。</p>
      </div>
    </div>

    <div v-if="!currentGroupId" class="card">
      <div class="state">请先在页头选择 / 输入课题组ID</div>
    </div>
    <template v-else>
      <!-- 总体进度 -->
      <div class="card">
        <div class="overall">
          <span class="overall-num">{{ doneCount }} / {{ nodes.length }}</span>
          <span class="overall-label">培养节点已完成</span>
          <div class="bar"><div class="bar-inner" :style="{ width: percent + '%' }"></div></div>
          <span class="overall-pct">{{ percent }}%</span>
        </div>
      </div>

      <!-- 节点明细 -->
      <div class="card">
        <p v-if="loading" class="state">加载中…</p>
        <p v-else-if="!nodes.length" class="state">本组暂未配置学位节点</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>顺序</th>
              <th>节点名称</th>
              <th>要求</th>
              <th>我的状态</th>
              <th>完成日期</th>
              <th>成绩</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in nodes" :key="n.id" class="row-clickable" @click="openDetail(n)">
              <td>{{ n.node_order }}</td>
              <td class="cell-title">{{ n.name }}</td>
              <td>{{ n.is_required ? '必达' : '选做' }}</td>
              <td>
                <span :class="['status-tag', 'st-' + (recordOf(n.id).status || 'not_started')]">
                  {{ statusText(recordOf(n.id).status || 'not_started') }}
                </span>
              </td>
              <td class="cell-time">{{ recordOf(n.id).complete_date || '—' }}</td>
              <td>{{ recordOf(n.id).score != null ? recordOf(n.id).score : '—' }}</td>
              <td class="cell-desc">{{ recordOf(n.id).remark || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 节点详情弹窗：点击表格行弹出，展示节点要求与本人的完成情况 -->
    <div v-if="detail.show" class="modal-mask" @click.self="detail.show = false">
      <div class="modal-box wide detail-box">
        <h3 class="modal-title">学位节点详情</h3>
        <div class="detail">
          <p class="detail-line"><b>节点名称：</b>{{ detail.node.name }}</p>
          <p class="detail-line"><b>顺序：</b>第 {{ detail.node.node_order }} 个节点</p>
          <p class="detail-line"><b>要求：</b>{{ detail.node.is_required ? '必达' : '选做' }}</p>
          <div class="detail-block">
            <div class="detail-block-label">节点说明</div>
            <div class="detail-block-body">{{ detail.node.description || '（导师未填写节点说明）' }}</div>
          </div>
          <div class="detail-block">
            <div class="detail-block-label">我的完成情况</div>
            <div class="detail-block-body record-body">
              <p v-if="!detail.record.id" class="detail-line muted-tip">（导师尚未为你填写该节点的完成记录）</p>
              <template v-else>
                <p class="detail-line">
                  <b>状态：</b>
                  <span class="status-tag" :class="'st-' + (detail.record.status || 'not_started')">{{ statusText(detail.record.status || 'not_started') }}</span>
                </p>
                <p class="detail-line"><b>完成日期：</b>{{ detail.record.complete_date || '—' }}</p>
                <p class="detail-line"><b>成绩：</b>{{ detail.record.score != null ? detail.record.score : '—' }}</p>
                <p class="detail-line"><b>备注：</b>{{ detail.record.remark || '—' }}</p>
                <p class="detail-line"><b>记录更新时间：</b>{{ detail.record.updated_at ? fmtTime(detail.record.updated_at) : '—' }}</p>
              </template>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="detail.show = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { listDegreeNodes, listDegreeRecords } from '../../api'

const { currentGroupId, loadGroups } = useGroupContext()

const nodes = ref([])
const records = ref([])
const loading = ref(false)

// 节点详情弹窗（点击表格行弹出，只读展示节点要求与本人完成情况）
const detail = ref({ show: false, node: null, record: null })

function openDetail(node) {
  detail.value = { show: true, node, record: recordOf(node.id) }
}

const STATUS_TEXT = { not_started: '未开始', in_progress: '进行中', completed: '已完成', failed: '未通过' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }

function fmtTime(t) {
  if (!t) return ''
  return String(t).replace('T', ' ').slice(0, 16)
}

// 按节点 id 取本人记录（学生接口仅返回本人记录）
function recordOf(nodeId) {
  return records.value.find((r) => Number(r.node_id) === Number(nodeId)) || {}
}

const doneCount = computed(() => records.value.filter((r) => r.status === 'completed').length)
const percent = computed(() => {
  if (!nodes.value.length) return 0
  return Math.round((doneCount.value / nodes.value.length) * 100)
})

async function load() {
  const gid = currentGroupId.value
  if (!gid) { nodes.value = []; records.value = []; return }
  loading.value = true
  try {
    const [n, r] = await Promise.all([
      listDegreeNodes(gid),
      listDegreeRecords({ group_id: gid })
    ])
    nodes.value = (n && n.success ? n.data : []) || []
    records.value = (r && r.success ? r.data : []) || []
  } catch (e) {
    nodes.value = []
    records.value = []
  } finally {
    loading.value = false
  }
}

loadGroups()
watch(currentGroupId, load, { immediate: true })
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px; padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.state { padding: 36px 0; text-align: center; color: #8a9099; font-size: 13px; }

.overall { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.overall-num { font-size: 28px; font-weight: 700; color: #1f2329; }
.overall-label { font-size: 13px; color: #8a9099; }
.bar { flex: 1; min-width: 140px; height: 8px; background: #eceff3; border-radius: 999px; overflow: hidden; }
.bar-inner { height: 100%; background: linear-gradient(135deg, #0d80e0, #19a558); border-radius: 999px; }
.overall-pct { font-size: 13px; color: #4e5969; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969;
  font-weight: 600; border-bottom: 1px solid #eceff3; white-space: nowrap;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:hover { background: #eef6ff; }
.row-clickable { cursor: pointer; }
.cell-title { font-weight: 600; }
.cell-time { color: #8a9099; white-space: nowrap; }
.cell-desc { max-width: 260px; color: #4e5969; }

.status-tag {
  display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px;
  background: #f0f2f5; color: #4e5969; white-space: nowrap;
}
.st-not_started { background: #f0f2f5; color: #8a9099; }
.st-in_progress { background: #e6f4ff; color: #0d80e0; }
.st-completed { background: #e8f7ef; color: #19a558; }
.st-failed { background: #fdecea; color: #ea4335; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box {
  background: #fff; border-radius: 12px; padding: 24px; width: 420px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.18);
}
.modal-box.wide { width: 560px; max-height: 86vh; overflow-y: auto; }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn:hover { border-color: #0d80e0; color: #0d80e0; }

.detail { background: #fafbfc; border: 1px solid #eceff3; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.detail-line { margin: 0 0 8px; font-size: 13px; color: #4e5969; line-height: 1.7; }
.detail-line:last-child { margin-bottom: 0; }
.muted-tip { color: #8a9099; }
.detail-block { margin-top: 14px; }
.detail-block-label { font-size: 12px; font-weight: 600; color: #8a9099; margin-bottom: 6px; }
.detail-block-body {
  font-size: 13px; color: #1f2329; line-height: 1.8;
  white-space: pre-wrap; word-break: break-word;
  background: #fff; border: 1px solid #eceff3; border-radius: 8px; padding: 10px 12px;
  max-height: 40vh; overflow-y: auto;
}
.record-body { background: #f7f9fc; border-color: #e3e8ef; }

/* ===== 详情弹窗美化（仅 .detail-box 容器内生效，与组会管理/科研成果风格一致） ===== */
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
.detail-box .detail {
  margin: 0;
  padding: 20px 24px;
  background: transparent;
  border: none;
  border-radius: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
.detail-box .detail > .detail-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #eef1f5;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.detail-box .detail > .detail-line:hover {
  border-color: #cfe4f7;
  box-shadow: 0 2px 8px rgba(13, 128, 224, 0.06);
}
.detail-box .detail > .detail-line:last-child { margin-bottom: 0; }
.detail-box .detail-line b {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #8a9099;
  line-height: 1.7;
}
.detail-box .detail-line b::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-block { margin-top: 14px; }
.detail-box .detail-block-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #8a9099;
  margin-bottom: 8px;
}
.detail-box .detail-block-label::before {
  content: '';
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d80e0, #19a558);
  opacity: 0.75;
}
.detail-box .detail-block-body {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #4e5969;
  font-size: 13px;
  max-height: 40vh;
  overflow-y: auto;
}
/* 「我的完成情况」块保留浅灰底，嵌套字段行不卡片化 */
.detail-box .record-body {
  background: #f7f9fc;
  border-color: #e3e8ef;
}
.detail-box .modal-actions {
  margin: 0;
  padding: 14px 24px;
  background: #fafbfc;
  border-top: 1px solid #eef1f5;
  flex: 0 0 auto;
}
/* 首个按钮（关闭）升级为主按钮 */
.detail-box .modal-actions .btn:first-child {
  background: linear-gradient(135deg, #0d80e0, #19a558);
  border: none;
  color: #fff;
  font-weight: 600;
  min-width: 80px;
}
.detail-box .modal-actions .btn:first-child:hover {
  opacity: 0.92;
  color: #fff;
  border-color: transparent;
}
</style>
