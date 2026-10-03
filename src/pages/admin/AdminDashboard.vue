<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-sub">超级管理员工作台 · 平台全局管理入口</p>
      </div>
    </div>

    <WelcomeInfoPanel :fields="welcomeFields" />

    <!-- 看板区：核心数据卡 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="num">{{ statUsers }}</div>
        <div class="label">用户总数</div>
      </div>
      <div class="stat-card">
        <div class="num">{{ statGroups }}</div>
        <div class="label">课题组数量</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/admin/task-overview')">
        <div class="num">{{ taskSummary.total || 0 }}</div>
        <div class="label">任务总数（总览）</div>
      </div>
      <div class="stat-card clickable" @click="router.push('/admin/report')">
        <div class="num">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</div>
        <div class="label">全平台周报提交率</div>
      </div>
    </div>

    <!-- 行动区（左列）+ 动态区（右列） -->
    <div class="dash-grid">
      <div class="col">
        <!-- 全局周报趋势 -->
        <div class="panel">
          <p class="panel-title">全平台周报提交趋势 <span class="tip">近 6 周</span></p>
          <svg v-if="trend.length" viewBox="0 0 600 200" style="width: 100%; height: auto; display: block">
            <!-- 网格线 -->
            <line v-for="i in 4" :key="'g' + i" x1="40" :y1="20 + i * 40" x2="580" :y2="20 + i * 40" stroke="#eef0f4" stroke-width="1" />
            <!-- 折线 -->
            <polyline :points="linePoints" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            <!-- 数据点 -->
            <circle v-for="(p, i) in trendPoints" :key="'d' + i" :cx="p.x" :cy="p.y" r="4" fill="var(--primary)" />
            <!-- 数值标签 -->
            <text v-for="(p, i) in trendPoints" :key="'t' + i" :x="p.x" :y="p.y - 10" text-anchor="middle" font-size="11" fill="#6b7280">{{ p.rate }}</text>
            <!-- 周次标签 -->
            <text v-for="(p, i) in trendPoints" :key="'w' + i" :x="p.x" :y="192" text-anchor="middle" font-size="10" fill="#9ca3af">{{ p.label }}</text>
          </svg>
          <div v-else class="panel-empty">暂无趋势数据</div>
        </div>

        <!-- 全局周报统计 -->
        <div class="panel">
          <p class="panel-title">全局周报统计 <span class="tip">{{ weekShortLabel(stats.weekKey) }}</span></p>
          <div class="desc-list">
            <div class="row"><span class="k">提交率</span><span class="v">{{ stats.submitRate == null ? '-' : stats.submitRate + '%' }}</span></div>
            <div class="row"><span class="k">批阅率</span><span class="v">{{ reviewRate }}</span></div>
            <div class="row"><span class="k">平均评分</span><span class="v">{{ stats.avgScore == null ? '-' : stats.avgScore + ' 分' }}</span></div>
          </div>
        </div>

        <!-- 各组排名 -->
        <div class="panel">
          <p class="panel-title">各组周报排名 <span class="tip">按提交量</span></p>
          <div v-if="ranking.length" class="item-list">
            <div v-for="(r, idx) in ranking" :key="r.groupId" class="item">
              <div class="item-main">
                <div class="item-title">
                  <span class="rank">#{{ idx + 1 }}</span>{{ r.groupName }}
                </div>
                <div class="item-sub">提交 {{ r.submitted }} 篇 · 按时 {{ r.onTime }} 篇</div>
              </div>
              <div class="item-actions"><span class="tag tag-blue">{{ r.submitted }} 篇</span></div>
            </div>
          </div>
          <div v-else class="panel-empty">暂无排名数据</div>
        </div>

        <!-- 系统运维 -->
        <div class="panel">
          <p class="panel-title">系统运维</p>
          <div class="desc-list">
            <div class="row"><span class="k">系统参数</span><span class="v">{{ statParams }} 项</span></div>
            <div class="row"><span class="k">数据库</span><span class="v">{{ dbStatus }}</span></div>
            <div class="row"><span class="k">运行环境</span><span class="v">{{ runtimeInfo }}</span></div>
          </div>
        </div>
      </div>

      <div class="col">
        <!-- 快捷操作 -->
        <div class="panel">
          <p class="panel-title">快捷操作</p>
          <div class="dash-quick">
            <button class="btn btn-sm btn-primary" @click="router.push('/admin/users')">新增用户</button>
            <button class="btn btn-sm" @click="router.push('/admin/groups')">新增课题组</button>
            <button class="btn btn-sm" @click="router.push('/admin/task-overview')">任务总览</button>
            <button class="btn btn-sm" @click="router.push('/admin/groups')">按组核查</button>
          </div>
        </div>

        <RecentMeetingPanel :meeting="recentMeeting" meetings-path="/admin/meetings" />

        <!-- 管理入口 -->
        <div class="panel">
          <p class="panel-title">全量管理入口</p>
          <div class="dash-quick">
            <button class="btn btn-sm" @click="router.push('/admin/users')">用户管理</button>
            <button class="btn btn-sm" @click="router.push('/admin/groups')">课题组设置</button>
            <button class="btn btn-sm" @click="router.push('/admin/notices')">公告管理</button>
            <button class="btn btn-sm" @click="router.push('/admin/meetings')">会议管理</button>
            <button class="btn btn-sm" @click="router.push('/admin/system')">系统配置</button>
            <button class="btn btn-sm" @click="router.push('/admin/report')">周报统计</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listUsers, listGroups, listParams, getRecentMeeting, getTaskSummary } from '../../api'
import { reportStats } from '../../api/report'
import { getDbInfo } from '../../api/db'
import { useSession } from '../../composables/useSession'
import RecentMeetingPanel from '../../components/dashboard/RecentMeetingPanel.vue'
import WelcomeInfoPanel from '../../components/dashboard/WelcomeInfoPanel.vue'
import { weekShortLabel } from '../../utils/labels'

// 超级管理员独立工作台（与课题组管理员 / 导师 / 学生的工作台为独立文件）
const { getSessionUser } = useSession()
const user = getSessionUser()
const router = useRouter()

const statUsers = ref('-')
const statGroups = ref('-')
const statParams = ref('-')
const recentMeeting = ref(null)
const taskSummary = ref({})
const stats = ref({})
const dbInfo = ref(null)

const welcomeFields = computed(() => [
  { label: '当前账号', value: user ? user.realName || user.username : '' },
  { label: '当前角色', value: '超级管理员' },
  { label: '快捷入口', value: '左侧菜单可进入用户管理、课题组设置与系统配置' }
])

// 趋势折线数据点：x 均匀分布，y 按提交率映射（0-100 → 画布 20-180）
const trend = computed(() => (stats.value && stats.value.trend) || [])
const trendPoints = computed(() => {
  const arr = trend.value
  const n = arr.length
  if (!n) return []
  const stepX = n > 1 ? (580 - 40) / (n - 1) : 0
  return arr.map((t, i) => ({
    x: n > 1 ? 40 + i * stepX : 310,
    y: 180 - Math.min(100, Math.max(0, t.submitRate || 0)) * 1.6,
    rate: `${t.submitRate == null ? 0 : t.submitRate}%`,
    label: t.weekKey ? weekShortLabel(t.weekKey).replace('年第', '/').replace('周', '') : ''
  }))
})
const linePoints = computed(() => trendPoints.value.map((p) => `${p.x},${p.y}`).join(' '))

const ranking = computed(() => (stats.value && stats.value.ranking) || [])
const reviewRate = computed(() => {
  const s = stats.value
  if (!s || !s.submitted) return '-'
  const pct = Math.round((Number(s.reviewed || 0) / Number(s.submitted)) * 100)
  return `${pct}%`
})
const dbStatus = computed(() => {
  const d = dbInfo.value
  if (!d) return '未连接'
  return d.status === 'connected' ? `已连接（${d.name || d.database || ''}）` : '未连接'
})
const runtimeInfo = computed(() => '生产环境')

onMounted(async () => {
  const [u, g, p, t, s, d] = await Promise.allSettled([
    listUsers({ page: 1 }),
    listGroups({ page: 1 }),
    listParams({ page: 1 }),
    getTaskSummary(),
    reportStats({}),
    getDbInfo()
  ])
  if (u.status === 'fulfilled' && u.value && u.value.success) statUsers.value = (u.value.data && u.value.data.total) || 0
  if (g.status === 'fulfilled' && g.value && g.value.success) statGroups.value = (g.value.data && g.value.data.total) || 0
  if (p.status === 'fulfilled' && p.value && p.value.success) statParams.value = (p.value.data && p.value.data.total) || 0
  if (t.status === 'fulfilled' && t.value && t.value.success) taskSummary.value = t.value.data || {}
  if (s.status === 'fulfilled' && s.value && s.value.success) stats.value = s.value.data || {}
  if (d.status === 'fulfilled' && d.value && d.value.success) dbInfo.value = d.value
  const r = await getRecentMeeting()
  if (r && r.success) recentMeeting.value = r.data
})
</script>

<style scoped>
.rank {
  display: inline-block;
  margin-right: 8px;
  font-weight: 700;
  color: var(--primary);
}
</style>
