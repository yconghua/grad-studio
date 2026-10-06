<template>
  <!-- 会议统计弹窗（超管 / 组管会议页共用，纯只读展示） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>会议统计</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <p class="panel-sub" style="margin-bottom: 10px">统计范围：{{ scopeText }}（仅统计已发布会议）</p>
        <div class="desc-list">
          <div class="row"><span class="k">会议总数</span><span class="v">{{ stats.total }}</span></div>
          <div class="row"><span class="k">本月会议数</span><span class="v">{{ stats.monthTotal }}</span></div>
          <div class="row"><span class="k">最近一次会议</span><span class="v">{{ stats.latestTitle ? `${stats.latestTitle}（${stats.latestTime}）` : '-' }}</span></div>
          <div class="row"><span class="k">应参与人数</span><span class="v">{{ stats.audience }} 人（{{ audienceHint }}）</span></div>
          <div class="row"><span class="k">参与率</span><span class="v">{{ (stats.participationRate * 100).toFixed(2) }}%</span></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getMeetingStats } from '../../api'
import { useAutoRefresh } from '../../composables/useAutoRefresh'

// 会议统计弹窗（超管 / 组管会议页共用，纯只读展示）：
// 打开后由本组件按 groupId 自拉数据，并订阅全局刷新，弹窗打开期间统计实时更新
const props = defineProps({
  visible: { type: Boolean, default: false },
  groupId: { type: [Number, String], default: '' },
  scopeText: { type: String, default: '全平台' },
  audienceHint: { type: String, default: '本组启用导师+学生' }
})
const emit = defineEmits(['update:visible'])

const stats = ref({ total: 0, monthTotal: 0, latestTime: null, latestTitle: null, audience: 0, participationRate: 0 })

async function load() {
  const res = await getMeetingStats(props.groupId)
  if (res && res.success) stats.value = res.data || {}
}

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)
useAutoRefresh(load)

function close() {
  emit('update:visible', false)
}
</script>
