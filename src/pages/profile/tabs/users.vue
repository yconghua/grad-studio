<template>
  <div class="users-tab">
    <section class="card card-wide">
      <div class="card-head">
        <h3 class="card-title">用户管理（{{ users.length }}个用户）</h3>
        <button class="save-btn" @click="openAdd">+ 新增用户</button>
      </div>

      <div class="search-row">
        <input
          v-model="searchKeyword"
          class="field-input search-input"
          type="text"
          placeholder="按账号搜索"
        />
        <select v-model="roleFilter" class="field-input role-select" title="按角色筛选">
          <option value="">全部</option>
          <option value="user">普通用户</option>
          <option :value="ROLE_ADMIN">管理员</option>
        </select>
        <button
          class="reset-btn"
          title="清空搜索词并恢复全部角色"
          :disabled="!searchKeyword && !roleFilter"
          @click="resetFilter"
        >
          重置
        </button>
      </div>

      <div class="table-scroll" v-if="pagedUsers.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>账号</th>
              <th>权限</th>
              <th>创建时间</th>
              <th class="col-act">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in pagedUsers" :key="u.id">
              <td>{{ u.id }}</td>
              <td>{{ u.username }}</td>
              <td>
                <span class="badge" :class="u.role === ROLE_ADMIN ? 'on' : 'off'">{{ roleLabel(u.role) }}</span>
              </td>
              <td>{{ disp(u.created_at) }}</td>
              <td class="col-act">
                <button class="link-btn" @click="openEdit(u)">编辑</button>
                <button class="link-btn danger" @click="openDel(u)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-tip">暂无用户数据</p>

      <!-- 分页：上一页 / 第几页/共几页 / 下一页 -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">上一页</button>
        <span class="page-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页</button>
      </div>
    </section>

    <!-- 新增用户弹窗：填账号 + 选角色 -->
    <div class="modal-mask" v-if="showAdd" @click.self="showAdd = false">
      <div class="modal">
        <h3 class="modal-title">新增用户</h3>
        <div class="form-row">
          <label class="field-label">账号 *</label>
          <input v-model="addForm.username" class="field-input" type="text" placeholder="登录账号（唯一）" />
        </div>
        <div class="form-row">
          <label class="field-label">角色 *</label>
          <select v-model="addForm.role" class="field-input">
            <option value="user">普通用户</option>
            <option :value="ROLE_ADMIN">管理员</option>
          </select>
        </div>
        <p v-if="addMsg" class="msg" :class="addPlain ? 'ok' : 'err'">{{ addMsg }}</p>
        <div class="pwd-box" v-if="addPlain">
          初始密码：<b class="pwd-text">{{ addPlain }}</b>
          <span class="pwd-hint">（请复制给该用户，登录后自行修改）</span>
        </div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showAdd = false">关闭</button>
          <button class="save-btn" @click="onSubmitAdd" :disabled="addLoading">创建</button>
        </div>
      </div>
    </div>

    <!-- 编辑用户弹窗 -->
    <div class="modal-mask" v-if="showEdit" @click.self="showEdit = false">
      <div class="modal">
        <h3 class="modal-title">编辑用户</h3>
        <div class="form-row">
          <label class="field-label">账号</label>
          <input class="field-input" type="text" :value="editForm.username" disabled />
        </div>
        <div class="form-row">
          <label class="field-label">角色</label>
          <select v-model="editForm.role" class="field-input" :disabled="isSelf">
            <option value="user">普通用户</option>
            <option :value="ROLE_ADMIN">管理员</option>
          </select>
          <p v-if="isSelf" class="role-tip">当前登录账号的角色不可修改</p>
        </div>
        <div class="form-row check-row">
          <label class="check-label">
            <input type="checkbox" v-model="editForm.resetPassword" /> 重置密码（生成新的 6 位密码）
          </label>
        </div>
        <p v-if="editMsg" class="msg" :class="editPlain ? 'ok' : 'err'">{{ editMsg }}</p>
        <div class="pwd-box" v-if="editPlain">
          新密码：<b class="pwd-text">{{ editPlain }}</b>
        </div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showEdit = false">{{ editPlain ? '关闭' : '取消' }}</button>
          <button v-if="!editPlain" class="save-btn" @click="onSubmitEdit" :disabled="editLoading">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div class="modal-mask" v-if="showDel" @click.self="showDel = false">
      <div class="modal modal-sm modal-tip">
        <h3 class="modal-title">确认删除</h3>
        <p class="modal-text">
          确定要删除用户 <b>{{ delTarget?.username }}</b> 吗？此操作不可恢复。
        </p>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showDel = false">取消</button>
          <button class="save-btn danger" @click="onConfirmDel" :disabled="delLoading">删除</button>
        </div>
      </div>
    </div>

    <!-- 操作提示弹窗（不能删除自己 / 删除失败等） -->
    <div class="modal-mask" v-if="showTip" @click.self="showTip = false">
      <div class="modal modal-sm">
        <h3 class="modal-title">提示</h3>
        <p class="modal-text">{{ tipMsg }}</p>
        <div class="modal-foot">
          <button class="save-btn" @click="showTip = false">知道了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  getCurrentUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser
} from '../../../api'
import { ROLE_ADMIN } from '../../../config/constants'
import { useSession } from '../../../composables/useSession'

const { getSessionUser, USER_KEY } = useSession()
// 当前登录用户（用于禁止删除自己 / 禁止修改自己的角色；挂载时从后端刷新）
const user = ref(getSessionUser())

// 角色中文名
function roleLabel(r) {
  return r === ROLE_ADMIN ? '管理员' : '普通用户'
}

// 编辑目标是否为当前登录用户（自己的角色不可修改，仅角色受保护）
const isSelf = computed(() => editForm.value.id !== null && editForm.value.id === user.value?.id)

// 空值占位
function disp(v) {
  return v === null || v === undefined || v === '' ? '—' : v
}

// 用户列表 + 搜索（关键词按账号） + 角色筛选
const users = ref([])
const searchKeyword = ref('')
const roleFilter = ref('')
const filteredUsers = computed(() => {
  const k = searchKeyword.value.trim().toLowerCase()
  return users.value.filter((u) => {
    const matchKw = !k || u.username.toLowerCase().includes(k)
    const matchRole = !roleFilter.value || u.role === roleFilter.value
    return matchKw && matchRole
  })
})

// 分页：每页 5 条
const PAGE_SIZE = 5
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / PAGE_SIZE)))
const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredUsers.value.slice(start, start + PAGE_SIZE)
})
function goPage(p) {
  const max = totalPages.value
  currentPage.value = Math.min(Math.max(1, p), max)
}
// 搜索关键词 / 角色筛选变化时回到第一页
watch([searchKeyword, roleFilter], () => {
  currentPage.value = 1
})
// 重置筛选：清空搜索关键词并恢复角色为「全部」（页码由上面的 watch 自动回到第 1 页）
function resetFilter() {
  searchKeyword.value = ''
  roleFilter.value = ''
}
// 数据变化导致页数减少时，纠正越界的当前页
watch(totalPages, (t) => {
  if (currentPage.value > t) currentPage.value = t
})

async function loadUsers() {
  try {
    const res = await listUsers()
    if (res.success) users.value = res.users || []
  } catch (e) {
    // 忽略读取异常
  }
}

// 新增用户（填账号 + 选角色）
const showAdd = ref(false)
const addForm = ref({ username: '', role: 'user' })
const addMsg = ref('')
const addPlain = ref('')
const addLoading = ref(false)
function openAdd() {
  addForm.value = { username: '', role: 'user' }
  addMsg.value = ''
  addPlain.value = ''
  showAdd.value = true
}
async function onSubmitAdd() {
  addMsg.value = ''
  addPlain.value = ''
  if (!addForm.value.username.trim()) {
    addMsg.value = '账号不能为空'
    return
  }
  addLoading.value = true
  try {
    const res = await createUser({
      username: addForm.value.username.trim(),
      role: addForm.value.role
    })
    if (res.success) {
      addPlain.value = res.plainPassword
      addMsg.value = '创建成功！初始密码已生成（见下方），请复制给该用户。'
      loadUsers()
    } else {
      addMsg.value = res.message || '创建失败'
    }
  } catch (e) {
    addMsg.value = '创建过程出现异常，请重试'
  } finally {
    addLoading.value = false
  }
}

// 编辑用户（改角色 + 可选重置密码）
const showEdit = ref(false)
const editForm = ref({ id: null, username: '', role: 'user', resetPassword: false })
const editMsg = ref('')
const editPlain = ref('')
const editLoading = ref(false)
function openEdit(u) {
  editForm.value = {
    id: u.id,
    username: u.username,
    role: u.role,
    resetPassword: false
  }
  editMsg.value = ''
  editPlain.value = ''
  showEdit.value = true
}
async function onSubmitEdit() {
  editMsg.value = ''
  editPlain.value = ''
  editLoading.value = true
  try {
    const res = await updateUser({
      id: editForm.value.id,
      role: editForm.value.role,
      resetPassword: editForm.value.resetPassword
    })
    if (res.success) {
      if (res.plainPassword) {
        // 重置了密码：保留弹窗显示新密码，让用户复制后再手动关闭
        editMsg.value = '保存成功！新密码已生成（见下方），请复制给该用户。'
        editPlain.value = res.plainPassword
      } else {
        editMsg.value = '保存成功'
        editPlain.value = ''
        showEdit.value = false
      }
      loadUsers()
    } else {
      editMsg.value = res.message || '保存失败'
    }
  } catch (e) {
    editMsg.value = '保存过程出现异常，请重试'
  } finally {
    editLoading.value = false
  }
}

// 删除用户
const showDel = ref(false)
const delTarget = ref(null)
const delLoading = ref(false)

// 禁止删除当前用户的操作提示弹窗
const showTip = ref(false)
const tipMsg = ref('')
function openTip(msg) {
  tipMsg.value = msg
  showTip.value = true
}

function openDel(u) {
  // 禁止删除当前登录用户
  if (u.id === user.value?.id) {
    openTip('不能删除当前登录账号')
    return
  }
  // 禁止删除账号为 admin 的用户
  if (u.username.toLowerCase() === 'admin') {
    openTip('不能删除管理员账号 "admin"')
    return
  }
  delTarget.value = u
  showDel.value = true
}
async function onConfirmDel() {
  delLoading.value = true
  try {
    const res = await deleteUser(delTarget.value.id)
    showDel.value = false
    if (res.success) {
      loadUsers()
    } else {
      openTip(res.message || '删除失败')
    }
  } catch (e) {
    openTip('删除过程出现异常，请重试')
  } finally {
    delLoading.value = false
  }
}

onMounted(async () => {
  // 重新拉取当前登录用户（删除自己判断用），并加载用户列表
  try {
    const u = await getCurrentUser()
    if (u) {
      user.value = u
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    }
  } catch (e) {}
  loadUsers()
})
</script>

<style scoped>
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin: 0 auto;
}
.card-wide {
  max-width: 100%;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #1f2329;
}
.form-row {
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: #fff;
}
.field-input:focus {
  border-color: #0d80e0;
}
.field-input:disabled {
  background: #f5f6f8;
  color: #8a9099;
}
.role-tip {
  font-size: 12px;
  color: #8a9099;
  margin: 6px 0 0;
}
.check-row {
  margin-bottom: 6px;
}
.check-label {
  font-size: 13px;
  color: #4e5969;
  display: flex;
  align-items: center;
  gap: 6px;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.save-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
.save-btn.danger {
  background: linear-gradient(135deg, #ea4335 0%, #d93025 100%);
}
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}

/* 搜索 + 筛选 */
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.search-input {
  max-width: 280px;
  flex: 0 1 280px;
}
.role-select {
  width: 140px;
  flex: 0 0 auto;
}
.reset-btn {
  height: 40px;
  padding: 0 16px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  cursor: pointer;
  flex: 0 0 auto;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.reset-btn:hover:not(:disabled) {
  border-color: #0d80e0;
  color: #0d80e0;
}
.reset-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.link-btn {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  margin-right: 10px;
  padding: 0;
}
.link-btn.danger {
  color: #ea4335;
}
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  font-size: 12px;
}
.badge.on {
  background: #e8f7ee;
  color: #19a558;
}
.badge.off {
  background: #eef0f3;
  color: #6b7280;
}
.empty-tip {
  font-size: 14px;
  color: #8a9099;
  margin: 8px 0 0;
}

/* 用户管理：数据表格 + 分页 */
.table-scroll {
  width: 100%;
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table th,
.data-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #f0f2f5;
}
.data-table th {
  color: #8a9099;
  font-weight: 600;
  background: #fafbfc;
  white-space: nowrap;
}
.data-table tbody tr:hover {
  background: #e8f0fe;
}
.col-act {
  width: 130px;
  white-space: nowrap;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: #0d80e0;
  color: #0d80e0;
}
.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.page-info {
  font-size: 13px;
  color: #4e5969;
  padding: 0 4px;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 22px 24px;
  width: auto;
  min-width: 380px;
  max-width: 90vw;
  max-height: 84vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-sm {
  width: 320px;
}
.modal-tip {
  width: auto;
  min-width: 400px;
  max-width: 600px;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
}
.modal-text {
  font-size: 14px;
  color: #4e5969;
  margin: 0 0 18px;
  line-height: 1.6;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.pwd-box {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f3f8ff;
  border-radius: 8px;
  font-size: 13px;
  color: #4e5969;
}
.pwd-text {
  color: #0d80e0;
  font-size: 15px;
  letter-spacing: 1px;
}
.pwd-hint {
  color: #8a9099;
}
</style>
