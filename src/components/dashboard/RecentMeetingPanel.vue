<template>
  <div class="panel">
    <p class="panel-title">最近会议</p>
    <template v-if="meeting">
      <div class="desc-list">
        <div class="row"><span class="k">主题</span><span class="v">{{ meeting.title }}</span></div>
        <div class="row"><span class="k">会议时间</span><span class="v">{{ meeting.meetingTime }}</span></div>
        <div class="row"><span class="k">地点</span><span class="v">{{ meeting.location || '-' }}</span></div>
        <div class="row"><span class="k">参与人数</span><span class="v">{{ meeting.participantCount }} 人</span></div>
      </div>
      <div class="panel-more">
        <router-link :to="meetingsPath" class="btn btn-sm">进入会议记录</router-link>
      </div>
    </template>
    <div v-else class="empty">暂无已发布会议</div>
  </div>
</template>

<script setup>
// 工作台「最近会议」共享面板：四个角色工作台复用，路由前缀由页面传入
defineProps({
  meeting: { type: Object, default: null },
  meetingsPath: { type: String, default: '' }
})
</script>
