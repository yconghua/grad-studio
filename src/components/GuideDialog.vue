<template>
  <div v-if="visible" class="guide-mask">
    <div class="guide-box">
      <div class="guide-head">
        <span class="guide-step">{{ stepIndex + 1 }} / {{ steps.length }}</span>
        <button class="guide-close" @click="close" title="关闭">×</button>
      </div>
      <div class="guide-body">
        <div class="guide-icon">{{ current.icon }}</div>
        <h3 class="guide-title">{{ current.title }}</h3>
        <p class="guide-desc">{{ current.desc }}</p>
        <button v-if="current.to" class="guide-link" @click="goStep(current)">去看看 →</button>
      </div>
      <div class="guide-foot">
        <button class="guide-btn ghost" @click="close">跳过</button>
        <div class="guide-dots">
          <span v-for="(s, i) in steps" :key="i" class="guide-dot" :class="{ on: i === stepIndex }"></span>
        </div>
        <button v-if="stepIndex < steps.length - 1" class="guide-btn primary" @click="next">下一步</button>
        <button v-else class="guide-btn primary" @click="close">开始使用</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  visible: { type: Boolean, default: false },
  role: { type: String, default: '' },
  userId: { type: [Number, String], default: '' },
  version: { type: [Number, String], default: '1' }
})
const emit = defineEmits(['close'])
const router = useRouter()

// 三角色引导步骤；无匹配角色时回退通用步骤
const GUIDES = {
  student: [
    { icon: '📝', title: '每周交周报', desc: '每周五前到「协同办公 → 周报提交」填写本周进展、遇到的问题和下周计划，导师会批注打分。', to: '/collaboration/weekly-report' },
    { icon: '📋', title: '任务协作看板', desc: '「任务协作」用看板查看导师派给你的任务，拖拽卡片即可更新状态（待办 / 进行中 / 已完成 / 延期）。', to: '/collaboration/task' },
    { icon: '🎓', title: '科研与毕业进度', desc: '在「科研管理」维护论文、专利、成果登记；「毕业进度」里有你的里程碑和截止日期，逾期会亮预警。', to: '/research/graduation' },
    { icon: '🔔', title: '消息通知', desc: '右上角铃铛是消息中心：审批结果、任务分配、活动报名成功都会自动通知你。', to: '/profile/message' }
  ],
  mentor: [
    { icon: '👥', title: '成员管理', desc: '「工作室事务 → 成员管理」查看名下学生、新增成员、为学生分配指导导师。', to: '/studio/member' },
    { icon: '📝', title: '周报批注与转待办', desc: '学生提交周报后，在周报页批注、打分；勾选「转为待办」可一键生成任务指派给学生。', to: '/collaboration/weekly-report' },
    { icon: '👥', title: '组会与已读回执', desc: '发布组会纪要后，在「已读情况」查看谁看了谁没看，一键提醒未读成员。', to: '/collaboration/meeting' },
    { icon: '✅', title: '审批中心', desc: '入组离组、请假等申请统一在「审批中心」处理。', to: '/collaboration/approval' }
  ],
  admin: [
    { icon: '👥', title: '成员管理', desc: '新增 / 批量导入用户、分配导师、重置密码都在成员管理完成。', to: '/studio/member' },
    { icon: '⚙️', title: '系统参数', desc: '密码长度等系统配置在「系统设置 → 系统参数」维护；登录引导也可以在这里开关。', to: '/system/param' },
    { icon: '📊', title: '统计报表与日志', desc: '「统计报表」看整体趋势；「操作日志」可追溯所有关键操作。', to: '/report/achievement-stat' },
    { icon: '💾', title: '数据备份', desc: '定期到「系统设置 → 数据备份」导出数据库 SQL，防患于未然。', to: '/system/backup' }
  ]
}

const fallback = [
  { icon: '🏠', title: '工作台', desc: '工作台是你的首页：待办、消息、组会、快捷入口都在这里。', to: '/workbench' },
  { icon: '🔔', title: '消息中心', desc: '右上角铃铛查看消息与通知。', to: '/profile/message' },
  { icon: '👤', title: '个人主页', desc: '维护个人资料、学术档案与通知偏好。', to: '/profile' }
]

const steps = computed(() => GUIDES[props.role] || fallback)
const stepIndex = ref(0)
const current = computed(() => steps.value[stepIndex.value])

function next() {
  if (stepIndex.value < steps.value.length - 1) stepIndex.value += 1
}

function goStep(step) {
  // 只跳转页面，不关闭引导：用户看完目标页后点「下一步」继续剩余步骤；
  // 只有「跳过 / × / 开始使用」才算看完并记录已看过
  if (step.to) router.push(step.to)
}

function close() {
  // 记录"已看过"：以 用户 + 引导版本 为维度，升级版本号可让用户再看一次
  try {
    if (props.userId !== '' && props.userId !== null && props.userId !== undefined) {
      localStorage.setItem(`guide_seen_${props.userId}_${props.version}`, '1')
    }
  } catch (e) {}
  emit('close')
}
</script>

<style scoped>
.guide-mask {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.guide-box {
  width: 460px;
  max-width: 92vw;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
}
.guide-step {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}
.guide-close {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.guide-close:hover {
  background: rgba(255, 255, 255, 0.32);
}
.guide-body {
  padding: 28px 28px 20px;
  text-align: center;
}
.guide-icon {
  font-size: 44px;
  line-height: 1;
  margin-bottom: 14px;
}
.guide-title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}
.guide-desc {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.7;
  color: #4e5969;
}
.guide-link {
  border: none;
  background: #eef5ff;
  color: #0d80e0;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  padding: 6px 16px;
  cursor: pointer;
}
.guide-link:hover {
  background: #dff0ff;
}
.guide-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 28px 20px;
}
.guide-btn {
  height: 34px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.guide-btn.ghost {
  border: 1px solid #dfe3e8;
  background: #fff;
  color: #8a9099;
}
.guide-btn.ghost:hover {
  color: #4e5969;
  border-color: #c3c9d1;
}
.guide-btn.primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.guide-btn.primary:hover {
  opacity: 0.92;
}
.guide-dots {
  display: flex;
  gap: 6px;
}
.guide-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e0e3e8;
  transition: all 0.2s;
}
.guide-dot.on {
  width: 20px;
  border-radius: 4px;
  background: #0d80e0;
}
</style>
