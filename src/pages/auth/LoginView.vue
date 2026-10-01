<template>
  <div class="login-page">
    <!-- 上：系统标题 -->
    <header class="login-header">
      <img :src="logoUrl" class="brand-mark" alt="平台" />
      <h1 class="brand-title">{{ appName }}</h1>
    </header>

    <!-- 中：系统介绍（左） + 登录表单（右） -->
    <main class="login-main">
      <section class="intro-panel">
        <div class="intro-inner">
          <div class="intro-quote">
            <p class="quote-text">愿每一次投入，都有记录；<br />愿每一段成长，都有回响。</p>
          </div>
        </div>
      </section>

      <section class="form-panel">
        <div class="login-card">
          <div class="card-head">
            <h2 class="card-title">账号登录</h2>
            <span
              class="db-status"
              :class="dbStatusClass"
              :title="dbMetaTitle"
              role="button"
              tabindex="0"
              @click="showBaseConfig = true"
              @keydown.enter="showBaseConfig = true"
            >
              <i class="db-dot"></i>{{ dbStatusText }}
            </span>
          </div>
          <p class="card-sub">请输入账号密码以进入系统</p>

          <!-- 默认密码提示：不同角色默认密码不同，首次登录需修改密码 -->
          <div class="default-tip">
            <b>默认密码提示</b>：超级管理员 <b>SuperAdmin123</b> · 课题组管理员 <b>GroupAdmin123</b> ·
            导师 <b>Mentor123</b> · 学生 <b>Student123</b>（首次登录需修改密码）
          </div>

          <form @submit.prevent="onSubmit">
            <label class="field-label" for="username">账号</label>
            <input
              id="username"
              v-model="username"
              class="field-input"
              type="text"
              placeholder="请输入账号（区分大小写）"
              autocomplete="username"
              @keyup.enter="onSubmit"
            />

            <label class="field-label" for="password">密码</label>
            <input
              id="password"
              v-model="password"
              class="field-input"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="onSubmit"
            />

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button class="submit-btn" type="submit" :disabled="loading">
              {{ loading ? '登录中…' : '登 录' }}
            </button>

            <p class="forgot-tip">忘记密码请联系<span class="admin-link" @click="showAdminContact = true">管理员</span>重置</p>
          </form>
        </div>
      </section>
    </main>

    <!-- 下：页脚 -->
    <footer class="login-footer">
      <div class="footer-inner">
        <span class="footer-copy">Copyright © 2025–{{ copyrightYear }} {{ appName }} 版权所有</span>
      </div>
    </footer>

    <!-- 管理员联系方式弹窗 -->
    <div v-if="showAdminContact" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showAdminContact = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>联系管理员</h3>
          <button type="button" class="privacy-close" @click="showAdminContact = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p>管理员联系方式：1509054114@qq.com</p>
        </div>
      </div>
    </div>

    <!-- 数据库管理相关弹窗（组件位于 components/db/） -->
    <BaseConfig
      :visible="showBaseConfig"
      :refresh-key="settingsRefreshKey"
      @close="showBaseConfig = false"
      @switch-db="openSwitchDb"
    />
    <DbSwitch
      :visible="showSwitchDb"
      :refresh-key="switchRefreshKey"
      :ext-msg="extMsg"
      :ext-msg-ok="extMsgOk"
      @close="showSwitchDb = false"
      @add-db="showAddDb = true"
      @db-changed="onDbChanged"
      @request-delete="onRequestDelete"
    />
    <DbAdd :visible="showAddDb" @close="showAddDb = false" @added="onDbAdded" />
    <DbDeleteConfirm
      :visible="showDeleteConfirm"
      :target-id="pendingDeleteId"
      @close="showDeleteConfirm = false"
      @confirmed="onDeleteConfirmed"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, deleteDb, getDbInfo } from '../../api'
import { useSession } from '../../composables/useSession'
import { useAppName } from '../../composables/useAppName'
import { ROLE_HOME } from '../../router'
import { BaseConfig, DbSwitch, DbAdd, DbDeleteConfirm } from '../../components/dialogs'
import logoUrl from '../../assets/logo.ico'

const { setSession } = useSession()
const { appName } = useAppName()
const router = useRouter()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

// 登录：成功后按角色跳转对应工作台；首次登录（mustChangePassword）先强制改密
async function onSubmit() {
  if (loading.value) return
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }
  loading.value = true
  try {
    const res = await login(username.value, password.value)
    if (res && res.success) {
      const user = res.data && res.data.user
      if (!user) {
        errorMsg.value = '登录响应异常，请重试'
        loading.value = false
        return
      }
      setSession(user)
      if (user.mustChangePassword) {
        router.replace('/force-password')
      } else {
        router.replace(ROLE_HOME[user.role] || '/login')
      }
      // 登录成功：保持 loading，防止页面跳转完成前重复提交
      return
    }
    errorMsg.value = (res && res.message) || '登录失败，请重试'
  } catch (e) {
    errorMsg.value = '登录过程出现异常，请重试'
  }
  loading.value = false
}

// 登录卡片右上角数据库状态：挂载时 + 切换数据库后刷新
const dbState = ref('loading')
const dbMeta = ref({ host: '', port: '', database: '' })
const dbStatusText = computed(() => {
  switch (dbState.value) {
    case 'connected': return '数据库已连接'
    case 'disconnected': return '数据库未连接'
    case 'unavailable': return '数据库状态不可用'
    default: return '数据库检测中…'
  }
})
const dbStatusClass = computed(() => 'is-' + dbState.value)
const dbMetaTitle = computed(() => {
  const m = dbMeta.value
  return m.host && m.database ? `${m.database} · ${m.host}:${m.port}` : ''
})

async function refreshDbStatus() {
  if (!window.api || !window.api.sys || !window.api.sys.dbInfo) {
    dbState.value = 'unavailable'
    return
  }
  try {
    const res = await getDbInfo()
    if (res && res.status === 'connected') {
      dbState.value = 'connected'
      dbMeta.value = { host: res.host, port: res.port, database: res.database }
    } else if (res && res.status === 'disconnected') {
      dbState.value = 'disconnected'
      dbMeta.value = { host: res.host, port: res.port, database: res.database }
    } else {
      dbState.value = 'unavailable'
    }
  } catch (e) {
    dbState.value = 'disconnected'
  }
}
onMounted(refreshDbStatus)

const copyrightYear = new Date().getFullYear()
const showAdminContact = ref(false)

// 数据库管理弹窗（协调层，逻辑在各弹窗组件内）
const showBaseConfig = ref(false)
const showSwitchDb = ref(false)
const showAddDb = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref('')
const settingsRefreshKey = ref(0)
const switchRefreshKey = ref(0)
const extMsg = ref('')
const extMsgOk = ref(false)

function openSwitchDb() {
  extMsg.value = ''
  extMsgOk.value = false
  showSwitchDb.value = true
}

function onDbChanged() {
  settingsRefreshKey.value++
  refreshDbStatus()
}

function onDbAdded() {
  switchRefreshKey.value++
  refreshDbStatus()
}

function onRequestDelete(id) {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

// 确认删除：执行删除并把结果消息注入切换弹窗
async function onDeleteConfirmed(id) {
  showDeleteConfirm.value = false
  pendingDeleteId.value = ''
  try {
    const res = await deleteDb(id)
    if (res && res.success) {
      extMsgOk.value = true
      extMsg.value = res.message || '删除成功'
    } else {
      extMsgOk.value = false
      extMsg.value = (res && res.message) || '删除失败'
    }
  } catch (e) {
    extMsgOk.value = false
    extMsg.value = '删除过程出现异常，请重试'
  }
  switchRefreshKey.value++
  refreshDbStatus()
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  overflow: auto;
}
.login-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px 12px;
}
.brand-mark {
  width: 34px;
  height: 34px;
  object-fit: contain;
}
.brand-title {
  margin: 0;
  max-width: 60vw;
  min-width: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.login-main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  padding: 32px 0;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.intro-panel {
  flex: 1 1 auto;
  position: relative;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  margin-right: 12px;
  margin-left: 30px;
  display: flex;
  max-width: 720px;
}
.intro-inner {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 44px 46px;
  min-width: 0;
}
.intro-quote {
  max-width: 420px;
  text-align: center;
}
.quote-text {
  margin: 0;
  font-size: 17px;
  line-height: 2;
  color: #4e5969;
}
.form-panel {
  flex: 0 0 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.login-card {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 34px 30px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 6px;
}
.card-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}
.db-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 9px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.2s;
}
.db-status .db-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.db-status.is-connected {
  color: #19a558;
  background: rgba(25, 165, 88, 0.1);
  border-color: rgba(25, 165, 88, 0.25);
}
.db-status.is-disconnected {
  color: #ea4335;
  background: rgba(234, 67, 53, 0.1);
  border-color: rgba(234, 67, 53, 0.25);
}
.db-status.is-loading,
.db-status.is-unavailable {
  color: #8a9099;
  background: #f2f3f5;
  border-color: #e5e6eb;
}
.card-sub {
  font-size: 13px;
  color: #8a9099;
  margin: 0 0 20px;
}
.default-tip {
  margin: 0 0 14px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: #4b5563;
  background: #f0f6ff;
  border: 1px dashed #bcd0ff;
  border-radius: 8px;
}
.default-tip b {
  color: #4f6ef7;
}
.field-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin: 14px 0 6px;
}
.field-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.field-input:focus {
  border-color: #4f6ef7;
}
.error-msg {
  margin: 14px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 14px;
  border: none;
  border-radius: 8px;
  background: #4f6ef7;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.submit-btn:hover {
  opacity: 0.92;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.forgot-tip {
  margin: 16px 0 0;
  font-size: 12px;
  color: #8a9099;
  text-align: center;
}
.admin-link {
  color: #4f6ef7;
  cursor: pointer;
}
.login-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 18px 16px 20px;
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}
.footer-copy {
  max-width: 80vw;
  min-width: 0;
  font-size: 12px;
  color: #8a9099;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
  background: rgba(0, 0, 0, 0.45);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #eceff3;
}
.privacy-head h3 {
  margin: 0;
  font-size: 15px;
  color: #1f2329;
}
.privacy-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.privacy-body {
  padding: 16px 18px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
}
</style>
