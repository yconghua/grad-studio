<template>
  <div class="ud">
    <div v-if="!detail" class="state">加载中…</div>
    <template v-else>
      <!-- 基本信息 + 个人档案 -->
      <div class="base-card">
        <div class="base-item"><span class="k">账号</span><span class="v">{{ detail.user.username }}</span></div>
        <div class="base-item"><span class="k">姓名</span><span class="v">{{ (detail.profile && detail.profile.real_name) || '—' }}</span></div>
        <div class="base-item"><span class="k">角色</span><span class="v">{{ roleLabel(detail.user.role) }}</span></div>
        <div class="base-item"><span class="k">状态</span><span class="v">{{ statusLabel(detail.user.status) }}</span></div>
        <div class="base-item"><span class="k">强制改密</span><span class="v">{{ detail.user.must_change_password ? '是' : '否' }}</span></div>
        <div class="base-item"><span class="k">档案创建时间</span><span class="v">{{ (detail.profile && fmtTime(detail.profile.created_at)) || '—' }}</span></div>
        <div class="base-item"><span class="k">性别</span><span class="v">{{ (detail.profile && detail.profile.gender) || '—' }}</span></div>
        <div class="base-item"><span class="k">学号</span><span class="v">{{ (detail.profile && detail.profile.student_no) || '—' }}</span></div>
        <div class="base-item"><span class="k">邮箱</span><span class="v">{{ (detail.profile && detail.profile.email) || '—' }}</span></div>
        <div class="base-item"><span class="k">电话</span><span class="v">{{ (detail.profile && detail.profile.phone) || '—' }}</span></div>
        <div class="base-item"><span class="k">学院</span><span class="v">{{ (detail.profile && detail.profile.college) || '—' }}</span></div>
        <div class="base-item"><span class="k">系/部门</span><span class="v">{{ (detail.profile && detail.profile.department) || '—' }}</span></div>
        <div class="base-item"><span class="k">专业</span><span class="v">{{ (detail.profile && detail.profile.major) || '—' }}</span></div>
        <div class="base-item"><span class="k">年级</span><span class="v">{{ (detail.profile && detail.profile.grade) || '—' }}</span></div>
        <div class="base-item"><span class="k">学位类型</span><span class="v">{{ (detail.profile && detail.profile.degree_type) || '—' }}</span></div>
        <div class="base-item"><span class="k">职称/职务</span><span class="v">{{ (detail.profile && detail.profile.position) || '—' }}</span></div>
        <div class="base-item"><span class="k">入学日期</span><span class="v">{{ (detail.profile && fmtTime(detail.profile.join_date)) || '—' }}</span></div>
        <div v-if="detail.profile && detail.profile.bio" class="base-item wide"><span class="k">个人简介</span><span class="v">{{ detail.profile.bio }}</span></div>
      </div>

      <ModuleSection title="所属课题组" :rows="detail.groups" :columns="groupsCols"
        :filename="`数据总览-${detail.user.username}-所属课题组.csv`" />
      <ModuleSection title="指导老师（作为学生）" :rows="detail.mentors" :columns="mentorsCols"
        :filename="`数据总览-${detail.user.username}-指导老师.csv`" />
      <ModuleSection title="名下学生（作为导师）" :rows="detail.mentorStudents" :columns="mentorStudentsCols"
        :filename="`数据总览-${detail.user.username}-名下学生.csv`" />
      <ModuleSection title="科研日志" :rows="detail.researchLogs" :columns="researchLogsCols"
        :filename="`数据总览-${detail.user.username}-科研日志.csv`" />
      <ModuleSection title="周报" :rows="detail.weeklyReports" :columns="weeklyReportsCols"
        :filename="`数据总览-${detail.user.username}-周报.csv`" />
      <ModuleSection title="学生学位记录" :rows="detail.degreeRecords" :columns="degreeRecordsCols"
        :filename="`数据总览-${detail.user.username}-学位记录.csv`" />
      <ModuleSection title="文献" :rows="detail.literatures" :columns="literaturesCols"
        :filename="`数据总览-${detail.user.username}-文献.csv`" />
      <ModuleSection title="文献笔记" :rows="detail.literatureNotes" :columns="literatureNotesCols"
        :filename="`数据总览-${detail.user.username}-文献笔记.csv`" />
      <ModuleSection title="科研档案" :rows="detail.archives" :columns="archivesCols"
        :filename="`数据总览-${detail.user.username}-科研档案.csv`" />
      <ModuleSection title="科研成果" :rows="detail.achievements" :columns="achievementsCols"
        :filename="`数据总览-${detail.user.username}-科研成果.csv`" />
      <ModuleSection title="论文" :rows="detail.papers" :columns="papersCols"
        :filename="`数据总览-${detail.user.username}-论文.csv`" />
      <ModuleSection title="任务（作为执行人）" :rows="detail.tasksAsAssignee" :columns="tasksCols"
        :filename="`数据总览-${detail.user.username}-执行任务.csv`" />
      <ModuleSection title="任务（作为创建人）" :rows="detail.tasksAsAssigner" :columns="tasksCols2"
        :filename="`数据总览-${detail.user.username}-创建任务.csv`" />
      <ModuleSection title="任务进展" :rows="detail.taskProgress" :columns="taskProgressCols"
        :filename="`数据总览-${detail.user.username}-任务进展.csv`" />
      <ModuleSection title="组会汇报" :rows="detail.meetingReports" :columns="meetingReportsCols"
        :filename="`数据总览-${detail.user.username}-组会汇报.csv`" />
      <ModuleSection title="消息" :rows="detail.messages" :columns="messagesCols"
        :filename="`数据总览-${detail.user.username}-消息.csv`" />
      <ModuleSection title="操作日志" :rows="detail.operationLogs" :columns="operationLogsCols"
        :filename="`数据总览-${detail.user.username}-操作日志.csv`" />
    </template>
  </div>
</template>

<script setup>
import ModuleSection from './ModuleSection.vue'

defineProps({
  detail: { type: Object, default: null }
})

function fmtTime(s) {
  if (!s) return ''
  return String(s).replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/\.\d{3}$/, '').replace('Z', '')
}
function roleLabel(r) {
  return { super_admin: '超级管理员', group_admin: '课题组管理员', mentor: '导师', student: '学生' }[r] || r
}
function statusLabel(s) {
  return { active: '正常', disabled: '禁用', leave: '离组' }[s] || s
}

const groupsCols = [
  { key: 'group_name', label: '课题组' }, { key: 'group_code', label: '编号' },
  { key: 'role_in_group', label: '组内角色' }, { key: 'member_status', label: '状态' },
  { key: 'joined_at', label: '加入时间' }, { key: 'left_at', label: '离开时间' }, { key: 'remark', label: '备注' }
]
const mentorsCols = [
  { key: 'group_name', label: '所属课题组' }, { key: 'mentor_username', label: '导师账号' },
  { key: 'mentor_real_name', label: '导师姓名' }, { key: 'status', label: '状态' }, { key: 'remark', label: '备注' }
]
const mentorStudentsCols = [
  { key: 'group_name', label: '所属课题组' }, { key: 'student_username', label: '学生账号' },
  { key: 'student_real_name', label: '学生姓名' }, { key: 'status', label: '状态' }, { key: 'remark', label: '备注' }
]
const researchLogsCols = [
  { key: 'log_date', label: '日期' }, { key: 'content', label: '内容' },
  { key: 'tags', label: '标签' }, { key: 'attachment', label: '附件' }, { key: 'created_at', label: '创建时间' }
]
const weeklyReportsCols = [
  { key: 'week_start', label: '周开始' }, { key: 'week_end', label: '周结束' },
  { key: 'status', label: '状态' }, { key: 'submitted_at', label: '提交时间' },
  { key: 'review_comment', label: '评语' }, { key: 'reviewed_at', label: '评审时间' }, { key: 'created_at', label: '创建时间' }
]
const degreeRecordsCols = [
  { key: 'node_name', label: '学位节点' }, { key: 'group_name', label: '课题组' },
  { key: 'status', label: '状态' }, { key: 'complete_date', label: '完成日期' },
  { key: 'score', label: '评分' }, { key: 'remark', label: '备注' }, { key: 'updated_at', label: '更新时间' }
]
const literaturesCols = [
  { key: 'title', label: '标题' }, { key: 'authors', label: '作者' },
  { key: 'source', label: '出处' }, { key: 'source_type', label: '类型' },
  { key: 'year', label: '年份' }, { key: 'doi', label: 'DOI' }, { key: 'url', label: '链接' },
  { key: 'read_status', label: '阅读状态' }, { key: 'rating', label: '评分' }, { key: 'created_at', label: '创建时间' }
]
const literatureNotesCols = [
  { key: 'literature_title', label: '所属文献' }, { key: 'content', label: '内容' }, { key: 'created_at', label: '创建时间' }
]
const archivesCols = [
  { key: 'record_type', label: '类型' }, { key: 'title', label: '标题' },
  { key: 'content', label: '内容' }, { key: 'record_date', label: '记录日期' },
  { key: 'attachment', label: '附件' }, { key: 'created_at', label: '创建时间' }
]
const achievementsCols = [
  { key: 'ach_type', label: '成果类型' }, { key: 'title', label: '标题' },
  { key: 'status', label: '状态' }, { key: 'submit_date', label: '提交日期' },
  { key: 'audit_comment', label: '审核意见' }, { key: 'audit_at', label: '审核时间' },
  { key: 'remark', label: '备注' }, { key: 'created_at', label: '创建时间' }
]
const papersCols = [
  { key: 'title', label: '标题' }, { key: 'authors', label: '作者' },
  { key: 'journal', label: '期刊' }, { key: 'conference', label: '会议' },
  { key: 'level_desc', label: '等级' }, { key: 'status', label: '状态' },
  { key: 'is_first_author', label: '一作' }, { key: 'submit_date', label: '投稿日期' },
  { key: 'accept_date', label: '录用日期' }, { key: 'publish_date', label: '发表日期' },
  { key: 'doi', label: 'DOI' }, { key: 'created_at', label: '创建时间' }
]
const tasksCols = [
  { key: 'title', label: '任务标题' }, { key: 'subject_id', label: '课题ID' },
  { key: 'group_id', label: '课题组ID' }, { key: 'assigner_id', label: '创建人ID' },
  { key: 'priority', label: '优先级' }, { key: 'status', label: '状态' },
  { key: 'progress_percent', label: '进度%' }, { key: 'deadline', label: '截止时间' },
  { key: 'completed_at', label: '完成时间' }, { key: 'created_at', label: '创建时间' }
]
const tasksCols2 = [
  { key: 'title', label: '任务标题' }, { key: 'subject_id', label: '课题ID' },
  { key: 'group_id', label: '课题组ID' }, { key: 'assignee_id', label: '执行人ID' },
  { key: 'priority', label: '优先级' }, { key: 'status', label: '状态' },
  { key: 'progress_percent', label: '进度%' }, { key: 'deadline', label: '截止时间' },
  { key: 'completed_at', label: '完成时间' }, { key: 'created_at', label: '创建时间' }
]
const taskProgressCols = [
  { key: 'task_title', label: '所属任务' }, { key: 'content', label: '进展内容' },
  { key: 'progress_percent', label: '进度%' }, { key: 'attachment', label: '附件' }, { key: 'created_at', label: '提交时间' }
]
const meetingReportsCols = [
  { key: 'meeting_title', label: '所属组会' }, { key: 'topic', label: '主题' },
  { key: 'content', label: '内容' }, { key: 'status', label: '状态' },
  { key: 'review_comment', label: '评语' }, { key: 'reviewed_at', label: '评审时间' }, { key: 'created_at', label: '创建时间' }
]
const messagesCols = [
  { key: 'sender_id', label: '发送人ID' }, { key: 'receiver_id', label: '接收人ID' },
  { key: 'msg_type', label: '类型' }, { key: 'title', label: '标题' },
  { key: 'content', label: '内容' }, { key: 'status', label: '状态' },
  { key: 'ref_type', label: '关联类型' }, { key: 'ref_id', label: '关联ID' },
  { key: 'read_at', label: '阅读时间' }, { key: 'created_at', label: '创建时间' }
]
const operationLogsCols = [
  { key: 'action', label: '动作' }, { key: 'target_type', label: '对象类型' },
  { key: 'target_id', label: '对象ID' }, { key: 'detail', label: '详情' }, { key: 'created_at', label: '时间' }
]
</script>

<style scoped>
.ud { display: flex; flex-direction: column; gap: 14px; }
.base-card {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 16px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px; padding: 14px 16px;
}
.base-item { display: flex; flex-direction: column; gap: 2px; }
.base-item.wide { grid-column: 1 / -1; }
.base-item .k { font-size: 12px; color: #8a9099; }
.base-item .v { font-size: 14px; color: #1f2329; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
</style>
