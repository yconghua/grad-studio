<template>
  <div v-if="visible" class="privacy-overlay">
    <div class="privacy-backdrop" @click="emit('close')"></div>
    <div class="privacy-dialog" role="dialog" aria-modal="true">
      <div class="privacy-head">
        <h3>切换账号</h3>
        <button type="button" class="privacy-close" @click="emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="privacy-body">
        <p class="privacy-lead">选择账号后将退出当前账号并切换登录；带「免密」标记的账号可直接进入，其余需输密码。</p>

        <div v-if="loading" class="privacy-lead">加载中…</div>

        <!-- 账号列表 -->
        <div v-else-if="accounts.length" class="acc-list">
          <div
            v-for="acc in accounts"
            :key="acc.username"
            class="acc-item"
            :class="{ active: acc.username === currentUsername, disabled: acc.username === currentUsername }"
            @click="onPick(acc)"
          >
            <img v-if="acc.avatar && avatarUrl(acc.avatar)" :src="avatarUrl(acc.avatar)" class="acc-avatar" alt="头像" />
            <span v-else class="acc-avatar acc-avatar-empty">{{ (acc.realName || acc.username).slice(0, 1).toUpperCase() }}</span>
            <div class="acc-main">
              <div class="acc-name">
                {{ acc.realName || acc.username }}
                <span v-if="acc.username === currentUsername" class="acc-tag tag-current">当前</span>
                <span v-else-if="fastSet.has(acc.username)" class="acc-tag tag-fast">免密</span>
              </div>
              <div class="acc-meta">{{ roleText(acc.role) }} · {{ timeText(acc.lastLoginAt) }}</div>
            </div>
            <button
              v-if="acc.username !== currentUsername"
              type="button"
              class="acc-del"
              title="删除记录"
              @click.stop="onRemove(acc.username)"
            >×</button>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else class="acc-empty">
          <p class="privacy-lead">暂无历史账号，可添加新账号登录。</p>
        </div>

        <p v-if="msg" class="msg" :class="msgOk ? 'ok' : 'err'">{{ msg }}</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="save-btn ghost" @click="emit('close')">取消</button>
        <button type="button" class="save-btn" @click="emit('add-new')">+ 新增账号</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAccountHistory } from '../../composables/useAccountHistory'
import { ticketStatus, getUserByUsername } from '../../api'
import { avatarUrl } from '../../utils/avatar'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../../config/constants'

// 切换账号弹窗：展示 7 天内登录过的历史账号
// - 点击非当前账号 → emit('switch', username) 由父组件执行「先退出旧账号再登录」
// - 点「+ 新增账号」→ emit('add-new') 由父组件退出并跳登录页新增
// - 打开弹窗不退出当前账号；关闭弹窗不执行任何切换
const props = defineProps({
  visible: { type: Boolean, default: false },
  currentUser: { type: Object, default: null }
})
const emit = defineEmits(['close', 'switch', 'add-new'])

const { listAccounts, removeAccount } = useAccountHistory()

const loading = ref(false)
const accounts = ref([])
const fastSet = ref(new Set())
const msg = ref('')
const msgOk = ref(false)

const currentUsername = computed(() => (props.currentUser && props.currentUser.username) || '')

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超级管理员',
  [ROLE_GROUP_ADMIN]: '课题组管理员',
  [ROLE_MENTOR]: '导师',
  [ROLE_STUDENT]: '学生'
}
function roleText(role) {
  return ROLE_TEXT[role] || role || ''
}
function timeText(ts) {
  if (!ts) return ''
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return '今天登录'
  return days + ' 天前登录'
}

// 打开时：加载历史账号 + 查询可免密账号集合 + 静默刷新各账号最新资料
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    loading.value = true
    msg.value = ''
    accounts.value = listAccounts()
    fastSet.value = new Set()
    try {
      const res = await ticketStatus()
      if (res && res.success && res.data && Array.isArray(res.data.names)) {
        fastSet.value = new Set(res.data.names)
      }
    } catch (e) {
      // 查询失败仅不显示免密标记，不影响列表展示
    }
    loading.value = false
    // 并行静默刷新每个历史账号的资料（姓名/角色/头像），失败保留本地快照
    const usernames = accounts.value.map((a) => a.username)
    await Promise.allSettled(
      usernames.map(async (uname) => {
        const res = await getUserByUsername(uname)
        if (!res || !res.success || !res.data) return
        const d = res.data
        const idx = accounts.value.findIndex((x) => x.username === uname)
        if (idx < 0) return
        accounts.value[idx] = {
          ...accounts.value[idx],
          realName: d.realName || d.username,
          role: d.role || accounts.value[idx].role,
          avatar: d.avatar || accounts.value[idx].avatar
        }
      })
    )
  }
)

function onPick(acc) {
  if (acc.username === currentUsername.value) return
  emit('switch', acc.username)
}

// 删除历史记录：仅移除本地记录，不退出当前账号
function onRemove(username) {
  removeAccount(username)
  accounts.value = listAccounts()
  msgOk.value = true
  msg.value = '已删除该账号记录'
}
</script>

<style scoped>
.privacy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-backdrop {
  position: absolute;
  inset: 0;
  background: var(--mask);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 480px;
  max-width: calc(92vw / var(--app-font-zoom, 1));
  max-height: calc(80vh / var(--app-font-zoom, 1));
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: var(--border);
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
  margin: 0 0 10px;
}

/* 账号列表 */
.acc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.acc-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.acc-item:hover:not(.disabled) {
  border-color: var(--primary);
  background: var(--primary-soft);
}
.acc-item.disabled {
  cursor: default;
}
.acc-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 36px;
}
.acc-avatar-empty {
  background: var(--primary);
  color: var(--on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
}
.acc-main {
  flex: 1 1 auto;
  min-width: 0;
}
.acc-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}
.acc-meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.acc-tag {
  font-size: 11px;
  font-weight: 400;
  padding: 1px 8px;
  border-radius: var(--radius-full);
}
.tag-current {
  color: var(--muted);
  background: var(--gray-soft);
}
.tag-fast {
  color: var(--success);
  background: var(--success-soft);
}
.acc-del {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  flex: 0 0 26px;
}
.acc-del:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
.acc-empty {
  padding: 24px 0;
  text-align: center;
}

/* 通用 */
.msg {
  font-size: 13px;
  margin: 12px 0 0;
}
.msg.ok {
  color: var(--success);
}
.msg.err {
  color: var(--danger);
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 18px 18px 10px 0;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: var(--on-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn.ghost {
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--primary);
}
</style>
