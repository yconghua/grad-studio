<template>
  <div class="todo-calendar">
    <!-- 顶部：月份导航 + 视图切换 -->
    <div class="cal-head">
      <div class="cal-nav">
        <button type="button" class="btn btn-sm" @click="prev">‹ 上一月</button>
        <span class="cal-title">{{ cursorYear }}年{{ cursorMonth }}月</span>
        <button type="button" class="btn btn-sm" @click="next">下一月 ›</button>
        <button type="button" class="btn btn-sm" @click="goToday">今天</button>
      </div>
      <div class="cal-tabs">
        <button type="button" :class="mode === 'month' ? 'on' : ''" @click="switchMode('month')">月</button>
        <button type="button" :class="mode === 'week' ? 'on' : ''" @click="switchMode('week')">周</button>
      </div>
    </div>

    <div class="cal-grid">
      <div v-for="w in WEEK_NAMES" :key="w" class="cal-wk">{{ w }}</div>

      <!-- 月视图：6 行 × 7 列，跨月补格 -->
      <template v-if="mode === 'month'">
        <div
          v-for="d in monthCells"
          :key="d.key"
          :class="['cal-cell', { 'out': d.out, 'today': d.today }]"
          @click="onCellClick(d)"
        >
          <div class="cal-date">{{ d.day }}</div>
          <div class="cal-todos">
            <div
              v-for="t in todosOf(d.key)"
              :key="t.id"
              :class="['cal-todo', t.priority, { done: t.status === 'done' }]"
              :title="t.title"
              @click.stop="onTodoClick(t)"
            >{{ t.title }}</div>
          </div>
        </div>
      </template>

      <!-- 周视图：当前显示周的 7 天 -->
      <template v-else>
        <div
          v-for="d in weekCells"
          :key="d.key"
          :class="['cal-cell', { 'out': false, 'today': d.today }]"
          @click="onCellClick(d)"
        >
          <div class="cal-date">{{ d.month === cursorMonth ? d.day : `${d.month}月${d.day}日` }}</div>
          <div class="cal-todos">
            <div
              v-for="t in todosOf(d.key)"
              :key="t.id"
              :class="['cal-todo', t.priority, { done: t.status === 'done' }]"
              :title="t.title"
              @click.stop="onTodoClick(t)"
            >{{ t.title }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="cal-legend">
      <span><i class="dot low"></i>低</span>
      <span><i class="dot medium"></i>中</span>
      <span><i class="dot high"></i>高</span>
      <span class="legend-tip">点击空白格新建（自动带日期）；点击待办可编辑</span>
    </div>

    <!-- 新建/编辑弹窗（手动新建预填日期；点击待办进入编辑） -->
    <TodoEditDialog v-model:open="editVisible" :row="editRow" :prefill="editPrefill" @saved="onSaved" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import TodoEditDialog from '../../components/todo/TodoEditDialog.vue'
import { getMyTodoCalendar } from '../../api'

// 自绘日历组件（月 + 周）：按天展示待办，按紧急程度着色；
// 点击空白格 → emit 新建（预填日期），点击待办 → 打开编辑弹窗。
const WEEK_NAMES = ['一', '二', '三', '四', '五', '六', '日']

const mode = ref('month')
// cursor：月视图显示月份的第一天；周视图以 cursor 所在周为基准
const cursor = ref(startOfMonth(new Date()))
const weekOffset = ref(0) // 周视图相对本周的偏移（0=本周）
const loading = ref(false)
const todos = ref({}) // { 'YYYY-MM-DD': [todo] }
const editVisible = ref(false)
const editRow = ref(null)
const editPrefill = ref(null)

function pad(n) { return String(n).padStart(2, '0') }
function fmtDay(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
// 某天所在周的周一（周一为一周起点）
function mondayOf(d) {
  const day = d.getDay() || 7
  return addDays(d, 1 - day)
}
function diffWeeks(d) {
  const m1 = mondayOf(new Date())
  const m2 = mondayOf(d)
  return Math.round((m2 - m1) / 86400000 / 7)
}

const cursorYear = computed(() => cursor.value.getFullYear())
const cursorMonth = computed(() => cursor.value.getMonth() + 1)

// 月视图格子：当月第一天所在周的周一起，共 42 格
const monthCells = computed(() => {
  const first = startOfMonth(cursor.value)
  const start = mondayOf(first)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i)
    cells.push({
      key: fmtDay(d),
      day: d.getDate(),
      out: d.getMonth() !== cursor.value.getMonth(),
      today: fmtDay(d) === fmtDay(new Date())
    })
  }
  return cells
})
// 周视图格子：cursor 所在周 + weekOffset 偏移
const weekCells = computed(() => {
  const monday = addDays(mondayOf(cursor.value), weekOffset.value * 7)
  const cells = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i)
    cells.push({
      key: fmtDay(d),
      day: d.getDate(),
      month: d.getMonth() + 1,
      today: fmtDay(d) === fmtDay(new Date())
    })
  }
  return cells
})

function todosOf(key) {
  return todos.value[key] || []
}

// 数据加载：月视图查整月范围；周视图查当前显示周范围
async function load() {
  let start, end
  if (mode.value === 'month') {
    start = cursor.value
    end = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
  } else {
    const monday = addDays(mondayOf(cursor.value), weekOffset.value * 7)
    start = monday
    end = addDays(monday, 7)
  }
  loading.value = true
  try {
    const res = await getMyTodoCalendar(
      `${fmtDay(start)} 00:00:00`,
      `${fmtDay(end)} 00:00:00`
    )
    const list = (res && res.success && res.data && res.data.list) || []
    const grouped = {}
    for (const t of list) {
      const key = String(t.dueTime || '').slice(0, 10)
      if (!key) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(t)
    }
    todos.value = grouped
  } catch (e) {
    todos.value = {}
  } finally {
    loading.value = false
  }
}

function prev() {
  if (mode.value === 'month') {
    cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
    load()
  } else {
    weekOffset.value -= 1
    load()
  }
}
function next() {
  if (mode.value === 'month') {
    cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
    load()
  } else {
    weekOffset.value += 1
    load()
  }
}
function goToday() {
  cursor.value = startOfMonth(new Date())
  weekOffset.value = 0
  load()
}
function switchMode(m) {
  mode.value = m
  if (m === 'week') weekOffset.value = 0
  load()
}

// 月视图点某天：切到周视图并定位该周；周视图点空白/今天保持
function onCellClick(d) {
  if (mode.value === 'month' && d.out) {
    // 跨月格：切换月份后留在月视图
    const t = new Date(d.key.replace(/-/g, '/'))
    cursor.value = startOfMonth(t)
    load()
    return
  }
  if (mode.value === 'month') {
    weekOffset.value = diffWeeks(new Date(d.key.replace(/-/g, '/')))
    mode.value = 'week'
    load()
    return
  }
  // 周视图点空白：新建并预填该天日期
  editRow.value = null
  editPrefill.value = { dueLocal: `${d.key}T09:00` }
  editVisible.value = true
}
function onTodoClick(t) {
  editRow.value = t
  editPrefill.value = null
  editVisible.value = true
}
function onSaved() {
  load()
}

watch(() => cursor.value, load)
onMounted(load)
</script>

<style scoped>
.todo-calendar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  min-width: 96px;
  text-align: center;
}
.cal-tabs {
  display: flex;
  gap: 4px;
}
.cal-tabs button {
  padding: 5px 14px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.cal-tabs button.on {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  min-height: 420px;
}
.cal-wk {
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  padding: 4px 0;
}
.cal-cell {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px;
  min-height: 64px;
  cursor: pointer;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.cal-cell:hover {
  border-color: var(--primary);
}
.cal-cell.out {
  background: var(--bg-hover-soft);
  opacity: 0.55;
}
.cal-cell.today {
  border-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
}
.cal-date {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.cal-todos {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  overflow-y: auto;
}
.cal-todo {
  font-size: 12px;
  line-height: 1.4;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-todo.low { background: #ecfdf5; color: #16a34a; }
.cal-todo.medium { background: #fffbeb; color: #d97706; }
.cal-todo.high { background: #fef2f2; color: #dc2626; }
.cal-todo.done { text-decoration: line-through; opacity: 0.6; }
.cal-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--text-2);
}
.cal-legend span { display: flex; align-items: center; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.low { background: #16a34a; }
.dot.medium { background: #d97706; }
.dot.high { background: #dc2626; }
.legend-tip { margin-left: auto; color: var(--text-3); }
</style>
