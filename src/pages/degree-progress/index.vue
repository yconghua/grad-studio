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
            <tr v-for="n in nodes" :key="n.id">
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

const STATUS_TEXT = { not_started: '未开始', in_progress: '进行中', completed: '已完成', failed: '未通过' }
function statusText(s) { return STATUS_TEXT[s] || s || '—' }

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
</style>
