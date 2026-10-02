<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="page-sub">{{ pageSub }}</p>
      </div>
      <button v-if="canCreate" class="btn btn-primary" type="button" @click="goCreate">+ 创建任务</button>
    </div>

    <!-- 角色 Tab（学生无 Tab） -->
    <div v-if="tabs.length > 1" class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="tab-btn"
        :class="{ active: scope === t.key }"
        @click="switchTab(t.key)"
      >{{ t.title }}</button>
    </div>

    <!-- 未入组空态 -->
    <div v-if="notInGroup" class="panel">
      <div class="empty">当前未加入课题组，无法查看任务</div>
    </div>

    <template v-else>
      <!-- 筛选区 -->
      <div class="toolbar">
        <select v-model="status" class="select" @change="search">
          <option :value="''">全部状态</option>
          <option v-for="(txt, val) in TASK_STATUS_TEXT" :key="val" :value="Number(val)">{{ txt }}</option>
        </select>
        <select v-model="priority" class="select" @change="search">
          <option :value="''">全部优先级</option>
          <option v-for="(txt, val) in TASK_PRIORITY_TEXT" :key="val" :value="Number(val)">{{ txt }}</option>
        </select>
        <select v-if="showMemberFilter" v-model="memberId" class="select" @change="search">
          <option :value="''">全部成员</option>
          <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.realName || m.username }}</option>
        </select>
        <input v-model="keyword" class="input" style="width: 200px" placeholder="任务标题关键词" @keyup.enter="search" />
        <button class="btn btn-primary" type="button" @click="search">查询</button>
        <button class="btn" type="button" @click="reset">重置</button>
        <div class="spacer"></div>
        <span style="font-size: 13px; color: var(--text-2)">共 <b>{{ total }}</b> 条任务</span>
      </div>

      <!-- 任务表格 -->
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>任务标题</th>
              <th>创建人</th>
              <th>状态</th>
              <th>优先级</th>
              <th>截止时间</th>
              <th>进度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in list" :key="t.id" @click="!deletedMap[t.id] && openDetail(t)">
              <td>{{ t.id }}</td>
              <td class="ellipsis" style="max-width: 220px">
                <span class="title-cell">{{ t.title }}</span>
                <span v-if="isOverdue(t)" class="overdue-mark">逾期</span>
              </td>
              <td class="ellipsis" style="max-width: 100px">{{ t.creatorName }}</td>
              <td>
                <span v-if="deletedMap[t.id]" class="tag tag-red">已删除</span>
                <span v-else :class="taskStatusTagClass(t.status)">{{ taskStatusText(t.status) }}</span>
              </td>
              <td><span :class="taskPriorityTagClass(t.priority)">{{ taskPriorityText(t.priority) }}</span></td>
              <td>{{ t.dueTime || '-' }}</td>
              <td>
                <div class="prog">
                  <span class="prog-bar" :style="{ width: t.progress + '%' }"></span>
                  <span class="prog-num">{{ t.progress }}%</span>
                </div>
              </td>
              <td>
                <div class="ops" @click.stop>
                  <button
                    v-if="deletedMap[t.id]"
                    class="btn btn-sm btn-green"
                    type="button"
                    @click="doRestore(t)"
                  >恢复</button>
                  <template v-else>
                                        <template v-if="scope === 'mine-created'">
                      <button class="btn btn-sm" type="button" @click="openEdit(t.id)">编辑</button>
                      <button
                        v-if="t.status === 3"
                        class="btn btn-sm btn-green"
                        type="button"
                        @click="doVerify(t)"
                      >验收</button>
                      <button
                        v-if="t.status === 1 || t.status === 2"
                        class="btn btn-sm"
                        type="button"
                        @click="doCancel(t)"
                      >取消</button>
                      <button
                        v-if="t.status === 4"
                        class="btn btn-sm"
                        type="button"
                        @click="doReopen(t)"
                      >重开</button>
                      <button class="btn btn-sm btn-red" type="button" @click="doDelete(t)">删除</button>
                    </template>
                    <template v-if="scope === 'mine-participated'">
                      <button
                        v-if="t.status === 1 || t.status === 2"
                        class="btn btn-sm"
                        type="button"
                        @click="openDetail(t, true)"
                      >提交进展</button>
                      <button
                        v-if="t.status === 2"
                        class="btn btn-sm btn-green"
                        type="button"
                        @click="doComplete(t)"
                      >完成任务</button>
                    </template>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="8"><div class="empty">暂无任务数据</div></td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button class="btn btn-sm" type="button" :disabled="page <= 1" @click="page--; load()">上一页</button>
          <span>第 {{ page }} / {{ totalPages || 1 }} 页</span>
          <button class="btn btn-sm" type="button" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
        </div>
      </div>
    </template>
  </div>

  <!-- 任务详情弹窗 / 任务编辑弹窗：列表内交互，不离开本页 -->
  <TaskDetailDialog
    v-if="detailVisible"
    :task-id="detailId"
    :initial-progress="detailProgress"
    @close="detailVisible = false"
    @edit="onDetailEdit"
    @changed="load"
  />
  <TaskEditDialog
    v-if="editVisible"
    :task-id="editId"
    @close="editVisible = false"
    @saved="onEditSaved"
  />
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TaskDetailDialog from '../../components/task/TaskDetailDialog.vue'
import TaskEditDialog from '../../components/task/TaskEditDialog.vue'
import {
  listTasks,
  deleteTask,
  restoreTask,
  verifyTask,
  cancelTask,
  reopenTask,
  completeTask,
  getTaskParticipantOptions
} from '../../api/task'
import { useSession } from '../../composables/useSession'
import { dialogAlert, dialogConfirm, dialogPrompt } from '../../composables/useDialog'
import {
  ROLE_GROUP_ADMIN,
  ROLE_MENTOR,
  ROLE_STUDENT
} from '../../config/constants'
import {
  taskStatusText,
  taskStatusTagClass,
  taskPriorityText,
  taskPriorityTagClass,
  TASK_STATUS_TEXT,
  TASK_PRIORITY_TEXT
} from '../../utils/labels'

const route = useRoute()
const router = useRouter()
const { getSessionUser } = useSession()
const user = getSessionUser()
const role = user && user.role

// ===== 角色 Tab 配置 =====
const tabs = computed(() => {
  if (role === ROLE_GROUP_ADMIN) {
    return [
      { key: 'mine-created', title: '我创建的任务' },
      { key: 'group', title: '组内成员任务' }
    ]
  }
  if (role === ROLE_MENTOR) {
    return [
      { key: 'mine-created', title: '我创建的任务' },
      { key: 'mine-participated', title: '我参与的任务' },
      { key: 'my-students', title: '自己学生的任务' }
    ]
  }
  return [] // 学生
})

const scope = ref(role === ROLE_STUDENT ? 'mine-participated' : 'mine-created')
const pageTitle = computed(() => {
  if (role === ROLE_GROUP_ADMIN) return '本组任务管理'
  if (role === ROLE_MENTOR) return '任务'
  return '我的任务'
})
const pageSub = computed(() => {
  if (scope.value === 'group') return '查看本组全部成员的任务（只读，仅可管理自己创建的任务）'
  if (scope.value === 'my-students') return '查看名下学生参与的任务（只读）'
  if (scope.value === 'mine-participated') return '查看我参与的任务，可提交进展、完成任务'
  return '管理我创建的任务：编辑、分配、验收、删除'
})
const canCreate = computed(() => role === ROLE_GROUP_ADMIN || role === ROLE_MENTOR)
const showMemberFilter = computed(() => scope.value === 'group' || scope.value === 'my-students')

// ===== 筛选 =====
const status = ref('')
const priority = ref('')
const keyword = ref('')
const memberId = ref('')
const memberOptions = ref([])
const page = ref(1)
const list = ref([])
const total = ref(0)
const totalPages = ref(1)
const notInGroup = ref(false)
// 刚删除的任务（仅本页会话内展示「已删除/恢复」），刷新后由服务端过滤不再出现
const deletedMap = reactive({})

function switchTab(key) {
  scope.value = key
  reset()
}

async function loadMemberOptions() {
  if (!showMemberFilter.value || memberOptions.value.length > 0) return
  const res = await getTaskParticipantOptions()
  if (res && res.success) memberOptions.value = res.data || []
}

async function load() {
  if (scope.value === 'group' || scope.value === 'my-students') loadMemberOptions()
  const res = await listTasks({
    scope: scope.value,
    page: page.value,
    status: status.value === '' ? undefined : status.value,
    priority: priority.value === '' ? undefined : priority.value,
    keyword: keyword.value || undefined,
    memberId: memberId.value === '' ? undefined : memberId.value
  })
  if (res && res.success) {
    const data = res.data || {}
    list.value = data.list || []
    total.value = data.total || 0
    totalPages.value = data.totalPages || 1
    notInGroup.value = data.groupId === null || data.groupId === undefined
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

function search() {
  page.value = 1
  load()
}
function reset() {
  status.value = ''
  priority.value = ''
  keyword.value = ''
  memberId.value = ''
  page.value = 1
  load()
}

// ===== 操作 =====
function goCreate() {
  router.push({ name: `${role}-task-create` })
}

// ===== 详情 / 编辑弹窗（行点击与按钮交互，不跳转页面） =====
const detailVisible = ref(false)
const detailId = ref(null)
const detailProgress = ref(false)
const editVisible = ref(false)
const editId = ref(null)

function openDetail(t, progress) {
  detailId.value = t.id
  detailProgress.value = !!progress
  detailVisible.value = true
}
function openEdit(id) {
  editId.value = id
  editVisible.value = true
}
// 详情弹窗内「编辑」：先关详情，再开编辑弹窗
function onDetailEdit(id) {
  detailVisible.value = false
  openEdit(id)
}
// 编辑保存成功后：关弹窗并刷新列表
function onEditSaved() {
  editVisible.value = false
  load()
}

async function doVerify(t) {
  const pass = await dialogConfirm(`任务「${t.title}」验收通过？`, '验收任务')
  if (!pass) return
  const res = await verifyTask(t.id, true, '')
  if (res && res.success) {
    dialogAlert('验收通过')
    load()
  } else {
    dialogAlert((res && res.message) || '验收失败')
  }
}

async function doCancel(t) {
  const ok = await dialogConfirm(`确认取消任务「${t.title}」？`, '取消任务')
  if (!ok) return
  const res = await cancelTask(t.id)
  if (res && res.success) {
    dialogAlert('任务已取消')
    load()
  } else {
    dialogAlert((res && res.message) || '取消失败')
  }
}

async function doReopen(t) {
  const ok = await dialogConfirm(`确认重新打开任务「${t.title}」？`, '重新打开')
  if (!ok) return
  const res = await reopenTask(t.id)
  if (res && res.success) {
    dialogAlert('任务已重新打开为进行中')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function doDelete(t) {
  const ok = await dialogConfirm(`确认删除任务「${t.title}」？删除后可在本列表恢复。`, '删除任务')
  if (!ok) return
  const res = await deleteTask(t.id)
  if (res && res.success) {
    deletedMap[t.id] = true
    dialogAlert('任务已删除，可在本列表点击「恢复」撤销')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

async function doRestore(t) {
  const res = await restoreTask(t.id)
  if (res && res.success) {
    delete deletedMap[t.id]
    dialogAlert('任务已恢复')
    load()
  } else {
    dialogAlert((res && res.message) || '恢复失败')
  }
}

async function doComplete(t) {
  const ok = await dialogConfirm(`确认完成任务「${t.title}」？提交后进入待验收，由创建者验收。`, '完成任务')
  if (!ok) return
  const res = await completeTask(t.id)
  if (res && res.success) {
    dialogAlert('已提交完成，等待验收')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

function isOverdue(t) {
  if (!t.dueTime) return false
  if (t.status === 4 || t.status === 5) return false
  return new Date(t.dueTime.replace(' ', 'T')).getTime() < Date.now()
}

onMounted(() => {
  // 支持从工作台带参数直达（如待验收筛选）
  const qStatus = route.query.status
  if (qStatus) status.value = Number(qStatus)
  load()
})
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  padding: 8px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 14px;
  color: var(--text-2);
  cursor: pointer;
}
.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.overdue-mark {
  margin-left: 6px;
  color: var(--unread);
  font-size: 12px;
}
.title-cell {
  color: var(--text-2-strong);
}
.tbl tbody tr {
  cursor: pointer;
}
.tbl tbody tr:hover {
  background: var(--bg-hover);
}
.ops {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.prog {
  position: relative;
  width: 90px;
  height: 16px;
  border-radius: var(--radius-md);
  background: var(--border-light);
  overflow: hidden;
}
.prog-bar {
  display: block;
  height: 100%;
  border-radius: var(--radius-md);
  background: var(--primary);
}
.prog-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-2);
}
</style>
