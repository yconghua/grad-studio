<template>
  <div v-if="visible" class="modal-mask" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h3>发起聊天</h3>
        <button type="button" class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <!-- 搜索框：按昵称/用户名搜索全平台启用用户（服务端已排除自己与禁用用户） -->
        <div class="toolbar" style="margin-bottom: 10px">
          <input
            v-model="keyword"
            type="text"
            class="input"
            placeholder="搜索昵称 / 用户名"
            style="flex: 1"
            @keydown.enter="search(1)"
          />
          <button type="button" class="btn btn-primary" @click="search(1)">搜索</button>
        </div>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="!users.length" class="empty">没有可发起聊天的用户</div>
        <ul v-else class="user-options">
          <li
            v-for="u in users"
            :key="u.id"
            class="user-option"
            @click="start(u)"
          >
            <span class="uo-avatar">{{ (u.real_name || u.username || '').slice(0, 1).toUpperCase() }}</span>
            <span class="uo-main">
              <span class="uo-name">{{ u.real_name || u.username }}</span>
              <span class="uo-sub">@{{ u.username }} · {{ roleText(u.role) }}</span>
            </span>
          </li>
        </ul>

        <div v-if="totalPages > 1" class="pager">
          <span>第 {{ page }} / {{ totalPages }} 页</span>
          <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="search(page - 1)">上一页</button>
          <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="search(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { openOrCreateChat, getChatUserOptions } from '../../api/chat'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR } from '../../config/constants'
import { dialogAlert } from '../../composables/useDialog'

// 发起会话弹窗：全平台启用用户（含未入组），排除自己；点击用户即发起/打开会话
const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'select'])
const keyword = ref('')
const users = ref([])
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)

const ROLE_TEXT = {
  [ROLE_SUPER_ADMIN]: '超管',
  [ROLE_GROUP_ADMIN]: '组管',
  [ROLE_MENTOR]: '导师'
}

function roleText(role) {
  return ROLE_TEXT[role] || '学生'
}

async function search(p = 1) {
  loading.value = true
  try {
    const res = await getChatUserOptions(keyword.value.trim(), p)
    if (res && res.success) {
      const d = res.data || {}
      users.value = d.list || []
      page.value = Number(d.page) || 1
      totalPages.value = Number(d.totalPages) || 1
    } else {
      dialogAlert((res && res.message) || '加载用户失败')
    }
  } catch (e) {
    dialogAlert('加载用户失败')
  } finally {
    loading.value = false
  }
}

// 打开弹窗时重置并加载第一页
watch(
  () => props.visible,
  (v) => {
    if (v) {
      keyword.value = ''
      search(1)
    }
  }
)

// 发起会话：服务端保证同一用户对只存在一个会话；成功后将会话交给聊天页打开
async function start(u) {
  const res = await openOrCreateChat(u.id)
  if (res && res.success) {
    emit('select', res.data)
  } else {
    dialogAlert((res && res.message) || '发起聊天失败')
  }
}
</script>

<style scoped>
.user-options {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}
.user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
}
.user-option:hover {
  background: var(--bg-hover);
}
.uo-avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--primary-soft);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.uo-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.uo-name {
  font-size: 14px;
  color: var(--text);
}
.uo-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
</style>
