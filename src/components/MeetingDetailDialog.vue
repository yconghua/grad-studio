<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>会议详情</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body" v-if="detail">
        <div class="d-row">
          <div class="d-label">状态</div>
          <div class="d-value"><span :class="statusClass">{{ statusText }}</span></div>
        </div>
        <div class="d-row">
          <div class="d-label">主题</div>
          <div class="d-value">{{ detail.title }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">会议时间</div>
          <div class="d-value">{{ detail.meetingTime }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">地点</div>
          <div class="d-value">{{ detail.location || '-' }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">发起人</div>
          <div class="d-value">{{ detail.hostName }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">所属课题组</div>
          <div class="d-value">{{ detail.groupName || `课题组 #${detail.groupId}` }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">议题</div>
          <div class="d-value">{{ detail.agenda || '-' }}</div>
        </div>
        <div class="d-row">
          <div class="d-label">纪要</div>
          <div class="d-value" style="white-space: normal">
            <NoticeContent v-if="detail.content" :content="detail.content" />
            <span v-else>-</span>
          </div>
        </div>
        <div class="d-row">
          <div class="d-label">参与人</div>
          <div class="d-value">
            <div v-if="detail.participants && detail.participants.length" class="member-list">
              <span v-for="p in detail.participants" :key="p.userId" class="member-chip">
                {{ p.realName || p.username || `用户 #${p.userId}` }}
                <i>{{ p.username }}</i>
              </span>
            </div>
            <span v-else>-</span>
          </div>
        </div>
        <div class="d-row">
          <div class="d-label">公告状态</div>
          <div class="d-value">
            <span v-if="detail.noticeId" style="color: #10b981; font-weight: 600">已发布公告（公告 #{{ detail.noticeId }}）</span>
            <span v-else style="color: #9ca3af">未发布</span>
          </div>
        </div>
      </div>
      <div class="modal-body" v-else>
        <div class="empty">{{ loadError || '加载中…' }}</div>
      </div>
      <div class="modal-foot">
        <!-- 发布为公告：仅超管/组管、仅已发布且未发布过公告；停用组禁用 -->
        <button
          v-if="canManage && detail && detail.status === 2 && !detail.noticeId"
          class="btn btn-primary"
          :disabled="publishing || groupStopped"
          @click="doPublishAsNotice"
        >
          {{ publishing ? '发布中…' : '发布为公告' }}
        </button>
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import NoticeContent from './NoticeContent.vue'
import { getMeetingDetail, publishMeetingAsNotice } from '../api'
import { dialogAlert, dialogConfirm } from '../composables/useDialog'

// 组会详情弹窗（纯只读展示）：进入时按 meetingId 请求详情全文 + 参与人 + noticeId；
// 仅超管/组管可见底部「发布为公告」按钮（仅 status=2 且 noticeId 为空时可用），
// 发布成功回写 noticeId 后按钮置灰并提示刷新。
const props = defineProps({
  visible: { type: Boolean, default: false },
  meetingId: { type: [Number, String], default: null },
  canManage: { type: Boolean, default: false }, // 当前用户是否为超管/组管
  groupStopped: { type: Boolean, default: false } // 课题组已停用：禁用发布为公告
})
const emit = defineEmits(['update:visible', 'published'])

const detail = ref(null)
const loadError = ref('')
const publishing = ref(false)

const statusText = computed(() => {
  const s = Number(detail.value?.status)
  if (s === 1) return '草稿'
  if (s === 2) return '已发布'
  if (s === 3) return '已归档'
  return '-'
})
const statusClass = computed(() => {
  const s = Number(detail.value?.status)
  if (s === 1) return 'tag tag-orange'
  if (s === 2) return 'tag tag-blue'
  return 'tag'
})

watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    detail.value = null
    loadError.value = ''
    const res = await getMeetingDetail(props.meetingId)
    if (res && res.success) {
      detail.value = res.data
    } else {
      loadError.value = (res && res.message) || '加载详情失败'
    }
  }
)

async function doPublishAsNotice() {
  const ok = await dialogConfirm('确认将该组会发布为课题组公告？生成后公告独立存在，改/删组会不会联动公告。')
  if (!ok) return
  publishing.value = true
  try {
    const res = await publishMeetingAsNotice(props.meetingId)
    if (res && res.success) {
      detail.value.noticeId = res.data && res.data.noticeId
      emit('published')
    } else {
      dialogAlert((res && res.message) || '发布失败')
    }
  } finally {
    publishing.value = false
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.d-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f1f3;
  font-size: 13px;
}
.d-row:last-child {
  border-bottom: none;
}
.d-label {
  flex-shrink: 0;
  width: 110px;
  color: #9aa1ac;
}
.d-value {
  flex: 1;
  min-width: 0;
  color: #1f2329;
  word-break: break-word;
  white-space: pre-wrap;
}
.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.member-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
}
.member-chip i {
  font-style: normal;
  color: #9ca3af;
}
</style>
