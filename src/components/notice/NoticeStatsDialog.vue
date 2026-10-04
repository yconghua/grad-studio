<template>
  <!-- 公告已读统计弹窗（超管 / 组管公告页共用，纯只读展示） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>已读统计</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <p class="panel-sub" style="margin-bottom: 10px">公告：{{ stats.title }}</p>
        <p style="font-size: 13px; color: var(--text-2-strong); margin-bottom: 10px">
          应读 <b>{{ stats.totalMembers }}</b> 人（本组启用状态的导师 + 学生）／已读 <b>{{ stats.readCount }}</b> 人
        </p>
        <div class="tbl-wrap" v-if="stats.list && stats.list.length">
          <table v-resizable-columns class="tbl">
            <thead>
              <tr><th>姓名</th><th>用户名</th><th>已读时间</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in stats.list" :key="r.userId">
                <td>{{ r.realName || '-' }}</td>
                <td>{{ r.username }}</td>
                <td>{{ r.readAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty">暂无已读记录</div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  stats: { type: Object, default: () => ({ title: '', totalMembers: 0, readCount: 0, list: [] }) }
})
const emit = defineEmits(['update:visible'])

function close() {
  emit('update:visible', false)
}
</script>
