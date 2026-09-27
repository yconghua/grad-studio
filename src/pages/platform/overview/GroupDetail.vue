<template>
  <div class="gd">
    <div v-if="!detail" class="state">加载中…</div>
    <template v-else>
      <!-- 基本信息 -->
      <div class="base-card">
        <div class="base-item"><span class="k">课题组名称</span><span class="v">{{ detail.group.name }}</span></div>
        <div class="base-item"><span class="k">课题组编号</span><span class="v">{{ detail.group.code }}</span></div>
        <div class="base-item"><span class="k">状态</span><span class="v">{{ statusLabel(detail.group.status) }}</span></div>
        <div class="base-item"><span class="k">管理员</span><span class="v">{{ detail.group.admin_username || '—' }}</span></div>
        <div class="base-item"><span class="k">成员数</span><span class="v">{{ detail.members.length }} 人</span></div>
        <div class="base-item"><span class="k">创建时间</span><span class="v">{{ fmtTime(detail.group.created_at) }}</span></div>
        <div v-if="detail.group.description" class="base-item wide"><span class="k">描述</span><span class="v">{{ detail.group.description }}</span></div>
      </div>

      <ModuleSection title="成员" :rows="detail.members" :columns="membersCols"
        :filename="`数据总览-${detail.group.name}-成员.csv`" />
      <ModuleSection title="师生关系" :rows="detail.mentorStudents" :columns="mentorStudentsCols"
        :filename="`数据总览-${detail.group.name}-师生关系.csv`" />
      <ModuleSection title="课题组公告" :rows="detail.notices" :columns="noticesCols"
        :filename="`数据总览-${detail.group.name}-公告.csv`" />
      <ModuleSection title="学位节点" :rows="detail.degreeNodes" :columns="degreeNodesCols"
        :filename="`数据总览-${detail.group.name}-学位节点.csv`" />
      <ModuleSection title="学生学位记录" :rows="detail.degreeRecords" :columns="degreeRecordsCols"
        :filename="`数据总览-${detail.group.name}-学位记录.csv`" />
      <ModuleSection title="组会" :rows="detail.meetings" :columns="meetingsCols"
        :filename="`数据总览-${detail.group.name}-组会.csv`" />
      <ModuleSection title="组会汇报" :rows="detail.meetingReports" :columns="meetingReportsCols"
        :filename="`数据总览-${detail.group.name}-组会汇报.csv`" />
      <ModuleSection title="课题" :rows="detail.subjects" :columns="subjectsCols"
        :filename="`数据总览-${detail.group.name}-课题.csv`" />
      <ModuleSection title="课题成员" :rows="detail.subjectMembers" :columns="subjectMembersCols"
        :filename="`数据总览-${detail.group.name}-课题成员.csv`" />
      <ModuleSection title="任务" :rows="detail.tasks" :columns="tasksCols"
        :filename="`数据总览-${detail.group.name}-任务.csv`" />
      <ModuleSection title="任务进展" :rows="detail.taskProgress" :columns="taskProgressCols"
        :filename="`数据总览-${detail.group.name}-任务进展.csv`" />
      <ModuleSection title="学生周报" :rows="detail.weeklyReports" :columns="weeklyReportsCols"
        :filename="`数据总览-${detail.group.name}-周报.csv`" />
      <ModuleSection title="科研成果" :rows="detail.achievements" :columns="achievementsCols"
        :filename="`数据总览-${detail.group.name}-科研成果.csv`" />
      <ModuleSection title="知识库节点" :rows="detail.knowledge" :columns="knowledgeCols"
        :filename="`数据总览-${detail.group.name}-知识库节点.csv`" />
      <ModuleSection title="知识库文件" :rows="detail.knowledgeFiles" :columns="knowledgeFilesCols"
        :filename="`数据总览-${detail.group.name}-知识库文件.csv`" />
      <ModuleSection title="课题组配置" :rows="detail.groupSettings" :columns="groupSettingsCols"
        :filename="`数据总览-${detail.group.name}-课题组配置.csv`" />
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
function statusLabel(st) {
  return { active: '正常', disabled: '停用' }[st] || st
}

const membersCols = [
  { key: 'username', label: '账号' }, { key: 'real_name', label: '姓名' },
  { key: 'role_in_group', label: '组内角色' }, { key: 'member_status', label: '状态' },
  { key: 'joined_at', label: '加入时间' }, { key: 'left_at', label: '离开时间' }, { key: 'remark', label: '备注' }
]
const mentorStudentsCols = [
  { key: 'mentor_username', label: '导师账号' }, { key: 'mentor_real_name', label: '导师姓名' },
  { key: 'student_username', label: '学生账号' }, { key: 'student_real_name', label: '学生姓名' },
  { key: 'status', label: '状态' }, { key: 'remark', label: '备注' }, { key: 'created_at', label: '建立时间' }
]
const noticesCols = [
  { key: 'title', label: '标题' }, { key: 'content', label: '内容' },
  { key: 'is_top', label: '置顶' }, { key: 'status', label: '状态' },
  { key: 'published_at', label: '发布时间' }, { key: 'publisher_username', label: '发布人' }, { key: 'created_at', label: '创建时间' }
]
const degreeNodesCols = [
  { key: 'name', label: '节点名称' }, { key: 'node_order', label: '顺序' },
  { key: 'description', label: '说明' }, { key: 'is_required', label: '必填' }, { key: 'created_at', label: '创建时间' }
]
const degreeRecordsCols = [
  { key: 'student_username', label: '学生账号' }, { key: 'student_real_name', label: '学生姓名' },
  { key: 'node_name', label: '学位节点' }, { key: 'status', label: '状态' },
  { key: 'complete_date', label: '完成日期' }, { key: 'score', label: '评分' },
  { key: 'remark', label: '备注' }, { key: 'updated_at', label: '更新时间' }
]
const meetingsCols = [
  { key: 'title', label: '标题' }, { key: 'meeting_type', label: '类型' },
  { key: 'location', label: '地点' }, { key: 'start_time', label: '开始时间' },
  { key: 'end_time', label: '结束时间' }, { key: 'status', label: '状态' }, { key: 'created_at', label: '创建时间' }
]
const meetingReportsCols = [
  { key: 'meeting_title', label: '所属组会' }, { key: 'student_username', label: '学生账号' },
  { key: 'student_real_name', label: '学生姓名' }, { key: 'topic', label: '主题' },
  { key: 'status', label: '状态' }, { key: 'review_comment', label: '评语' },
  { key: 'reviewed_at', label: '评审时间' }, { key: 'created_at', label: '创建时间' }
]
const subjectsCols = [
  { key: 'name', label: '课题名称' }, { key: 'code', label: '编号' },
  { key: 'subject_type', label: '类型' }, { key: 'status', label: '状态' },
  { key: 'start_date', label: '开始日期' }, { key: 'end_date', label: '结束日期' },
  { key: 'funding', label: '经费' }, { key: 'source', label: '来源' },
  { key: 'remark', label: '备注' }, { key: 'created_at', label: '创建时间' }
]
const subjectMembersCols = [
  { key: 'subject_name', label: '所属课题' }, { key: 'username', label: '账号' },
  { key: 'real_name', label: '姓名' }, { key: 'role_in_subject', label: '课题角色' },
  { key: 'join_date', label: '加入日期' }, { key: 'quit_date', label: '退出日期' }, { key: 'status', label: '状态' }
]
const tasksCols = [
  { key: 'title', label: '任务标题' }, { key: 'subject_id', label: '课题ID' },
  { key: 'assigner_id', label: '创建人ID' }, { key: 'assignee_id', label: '执行人ID' },
  { key: 'priority', label: '优先级' }, { key: 'status', label: '状态' },
  { key: 'progress_percent', label: '进度%' }, { key: 'deadline', label: '截止时间' },
  { key: 'completed_at', label: '完成时间' }, { key: 'remark', label: '备注' }, { key: 'created_at', label: '创建时间' }
]
const taskProgressCols = [
  { key: 'task_title', label: '所属任务' }, { key: 'username', label: '账号' },
  { key: 'real_name', label: '姓名' }, { key: 'content', label: '进展内容' },
  { key: 'progress_percent', label: '进度%' }, { key: 'attachment', label: '附件' }, { key: 'created_at', label: '提交时间' }
]
const weeklyReportsCols = [
  { key: 'student_username', label: '学生账号' }, { key: 'student_real_name', label: '学生姓名' },
  { key: 'week_start', label: '周开始' }, { key: 'week_end', label: '周结束' },
  { key: 'status', label: '状态' }, { key: 'submitted_at', label: '提交时间' },
  { key: 'review_comment', label: '评语' }, { key: 'reviewed_at', label: '评审时间' }, { key: 'created_at', label: '创建时间' }
]
const achievementsCols = [
  { key: 'ach_type', label: '成果类型' }, { key: 'title', label: '标题' },
  { key: 'status', label: '状态' }, { key: 'submit_date', label: '提交日期' },
  { key: 'audit_comment', label: '审核意见' }, { key: 'audit_at', label: '审核时间' },
  { key: 'remark', label: '备注' }, { key: 'created_at', label: '创建时间' }
]
const knowledgeCols = [
  { key: 'name', label: '节点名称' }, { key: 'node_type', label: '类型' },
  { key: 'parent_id', label: '父节点ID' }, { key: 'description', label: '说明' },
  { key: 'sort_order', label: '排序' }, { key: 'created_at', label: '创建时间' }
]
const knowledgeFilesCols = [
  { key: 'knowledge_name', label: '所属节点' }, { key: 'title', label: '标题' },
  { key: 'file_size', label: '大小(字节)' }, { key: 'file_type', label: '类型' },
  { key: 'uploader_username', label: '上传人' }, { key: 'download_count', label: '下载次数' },
  { key: 'status', label: '状态' }, { key: 'created_at', label: '上传时间' }
]
const groupSettingsCols = [
  { key: 'config_key', label: '配置键' }, { key: 'config_value', label: '配置值' },
  { key: 'description', label: '说明' }, { key: 'updated_at', label: '更新时间' }
]
</script>

<style scoped>
.gd { display: flex; flex-direction: column; gap: 14px; }
.base-card {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 16px;
  background: #fff; border: 1px solid #eceff3; border-radius: 10px; padding: 14px 16px;
}
.base-item { display: flex; flex-direction: column; gap: 2px; }
.base-item.wide { grid-column: 1 / -1; }
.base-item .k { font-size: 12px; color: #8a9099; }
.base-item .v { font-size: 14px; color: #1f2329; }
.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
</style>
