<template>
  <div class="page">
    <h3 class="title">版本更新</h3>

    <div class="card">
      <div class="row"><span class="k">系统名称</span><span class="v">{{ info.name || '-' }}</span></div>
      <div class="row"><span class="k">当前版本</span><span class="v">{{ info.version || '-' }}</span></div>
      <div class="row"><span class="k">发布日期</span><span class="v">{{ info.releaseDate || '-' }}</span></div>
      <div class="row"><span class="k">运行环境</span><span class="v">{{ info.platform || '-' }}</span></div>
    </div>

    <button class="btn btn-primary check-btn" @click="check" :disabled="checking">
      {{ checking ? '检查中…' : '检查更新' }}
    </button>

    <p v-if="msg" class="msg" :class="msgOk ? 'ok' : 'err'">{{ msg }}</p>

    <div v-if="result && result.hasUpdate" class="update-box">
      <p class="update-title">发现新版本 v{{ result.latest }}</p>
      <p class="update-notes">{{ result.notes }}</p>
      <a class="btn btn-primary link" :href="result.url" target="_blank" rel="noopener noreferrer">前往下载</a>
    </div>
    <p v-else-if="result && result.success" class="msg ok">当前已是最新版本。</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSysInfo, checkForUpdates } from '../../api'

const info = ref({})
const checking = ref(false)
const msg = ref('')
const msgOk = ref(true)
const result = ref(null)

onMounted(async () => {
  try {
    const res = await getSysInfo()
    if (res && res.success) info.value = res
  } catch (e) {
    // 忽略
  }
})

async function check() {
  checking.value = true
  msg.value = ''
  result.value = null
  try {
    const res = await checkForUpdates()
    if (res && res.success) {
      result.value = res
      msgOk.value = true
    } else {
      msgOk.value = false
      msg.value = (res && res.message) || '检查失败'
    }
  } catch (e) {
    msgOk.value = false
    msg.value = '检查过程出现异常，请重试'
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
.card {
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 8px 16px;
  margin-bottom: 16px;
}
.row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
}
.row:last-child {
  border-bottom: none;
}
.k {
  width: 90px;
  color: #8a9099;
}
.v {
  color: #1f2329;
}
.check-btn {
  height: 36px;
}
.btn {
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  height: 34px;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.link {
  margin-top: 12px;
}
.msg {
  margin: 12px 0 0;
  font-size: 13px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}
.update-box {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #19a558;
  border-radius: 10px;
  background: #f4fbf7;
}
.update-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #19a558;
}
.update-notes {
  margin: 0 0 8px;
  font-size: 13px;
  color: #4e5969;
  white-space: pre-wrap;
}
</style>
