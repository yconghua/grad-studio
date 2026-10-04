<template>
  <div class="login-page">
    <!-- 无边框窗口自绘标题栏（拖拽 + 最小化/关闭） -->
    <AppTitleBar />

    <!-- 中：系统介绍（左） + 登录表单（右） -->
    <main class="login-main">
      <!-- 左：品牌区（同源浅色分栏） -->
      <section class="brand-panel">
        <div class="brand-rings" aria-hidden="true">
          <span class="ring ring-1"></span>
          <span class="ring ring-2"></span>
        </div>
        <ParticleBackground />
        <div class="brand-inner">
          <div class="brand-head">
            <img :src="logoUrl" class="brand-logo" alt="平台" />
            <h1 class="brand-name">{{ appName }}</h1>
          </div>
          <div class="brand-copy">
            <p class="brand-slogan">愿每一次投入，都有记录；<br />愿每一段成长，都有回响。</p>
          </div>
        </div>
      </section>

      <!-- 右：登录卡 -->
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

            <template v-if="needCaptcha">
              <label class="field-label" for="captcha">验证码</label>
              <div class="captcha-row">
                <input
                  id="captcha"
                  v-model="captchaCode"
                  class="field-input captcha-input"
                  type="text"
                  maxlength="4"
                  placeholder="请输入验证码"
                  autocomplete="off"
                  @keyup.enter="onSubmit"
                />
                <button
                  type="button"
                  class="captcha-img"
                  title="看不清？点击刷新"
                  @click="loadCaptcha"
                >
                  <img v-if="captchaSvg" :src="captchaSvg" alt="验证码，点击刷新" />
                  <span v-else>点击获取</span>
                </button>
              </div>
            </template>

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button class="submit-btn" type="submit" :disabled="loading">
              {{ loading ? '登录中…' : '登 录' }}
            </button>

            <label class="agree-row">
              <input v-model="agreed" type="checkbox" class="agree-check" />
              <span class="agree-text">
                我已阅读并同意<a href="#" @click.prevent="openAgreement('user')">《用户协议》</a>和<a href="#" @click.prevent="openAgreement('privacy')">《隐私政策》</a>
              </span>
            </label>
          </form>

          <div class="card-foot">
            <button type="button" class="forgot-link" @click="showAdminContact = true">忘记密码</button>
          </div>

        </div>
      </section>
    </main>

    <!-- 下：页脚（版本号 + 版权） -->
    <footer class="login-footer">
      <div class="footer-inner">
        <span class="footer-copy">
          <span v-if="version">v{{ version }} · </span>Copyright © 2025–{{ copyrightYear }} {{ appName }} 版权所有
        </span>
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

    <!-- 协议弹窗（用户协议 / 隐私政策共用一套结构） -->
    <div v-if="agreementType" class="privacy-overlay">
      <div class="privacy-backdrop" @click="agreementType = ''"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>{{ agreementType === 'user' ? '用户协议' : '隐私政策' }}</h3>
          <button type="button" class="privacy-close" @click="agreementType = ''" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body agreement-body">
          {{ agreementType === 'user' ? USER_AGREEMENT : PRIVACY_POLICY }}
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
import { useRoute, useRouter } from 'vue-router'
import { login, getCaptcha, deleteDb, getDbInfo, getPublicInfo } from '../../api'
import { useSession } from '../../composables/useSession'
import { useAccountHistory } from '../../composables/useAccountHistory'
import { useAppName } from '../../composables/useAppName'
import { ROLE_HOME } from '../../router'
import { USER_AGREEMENT, PRIVACY_POLICY } from './agreements'
import { BaseConfig, DbSwitch, DbAdd, DbDeleteConfirm } from '../../components/dialogs'
import ParticleBackground from '../../components/particles/ParticleBackground.vue'
import AppTitleBar from '../../components/layout/AppTitleBar.vue'
import logoUrl from '../../assets/logo.ico'

const { setSession } = useSession()
const { recordLogin } = useAccountHistory()
const { appName } = useAppName()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

// 图形验证码（连续登录失败后强制显示）：captchaId + SVG 由主进程下发，答案不落前端
const needCaptcha = ref(false)
const captchaId = ref('')
const captchaCode = ref('')
const captchaSvg = ref('')
// 协议确认：默认不勾选，未勾选时拦截登录
const agreed = ref(false)
const agreementType = ref('')

// 获取/刷新验证码：主进程返回 captchaId + SVG，以 data URL 展示
async function loadCaptcha() {
  try {
    const res = await getCaptcha()
    if (res && res.success && res.data) {
      captchaId.value = res.data.captchaId
      captchaSvg.value = 'data:image/svg+xml;utf8,' + encodeURIComponent(res.data.svg)
      captchaCode.value = ''
    }
  } catch (e) {
    // 获取失败不阻塞登录（验证码为增强防线，非必选通道）
  }
}

// 打开协议弹窗（'user' 用户协议 / 'privacy' 隐私政策）
function openAgreement(type) {
  agreementType.value = type
}

// 登录：成功后按角色跳转对应工作台；首次登录（mustChangePassword）先强制改密
async function onSubmit() {
  if (loading.value) return
  errorMsg.value = ''
  if (!agreed.value) {
    errorMsg.value = '请先阅读并同意用户协议与隐私政策'
    return
  }
  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }
  if (needCaptcha.value && !captchaCode.value) {
    errorMsg.value = '请输入验证码'
    return
  }
  loading.value = true
  try {
    const res = await login({
      username: username.value,
      password: password.value,
      captchaId: captchaId.value,
      captchaCode: captchaCode.value
    })
    if (res && res.success) {
      const user = res.data && res.data.user
      if (!user) {
        errorMsg.value = '登录响应异常，请重试'
        loading.value = false
        return
      }
      setSession(user)
      recordLogin(user)
      if (user.mustChangePassword) {
        router.replace('/force-password')
      } else {
        router.replace(ROLE_HOME[user.role] || '/login')
      }
      // 登录成功：保持 loading，防止页面跳转完成前重复提交
      return
    }
    // 失败：主进程要求验证码时显示区域并自动刷新
    if (res && res.data && res.data.needCaptcha) {
      needCaptcha.value = true
      await loadCaptcha()
    }
    errorMsg.value = (res && res.message) || '登录失败，请重试'
  } catch (e) {
    errorMsg.value = '登录过程出现异常，请重试'
  }
  loading.value = false
}

// 页脚版本号：公开应用信息接口（无需登录）取版本号
const version = ref('')

async function loadVersion() {
  try {
    const res = await getPublicInfo()
    if (res && res.success) {
      version.value = res.version || ''
    }
  } catch (e) {
    // 获取失败时保持空版本号
  }
}

// 登录卡片底部数据库状态：挂载时 + 切换数据库后刷新
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
onMounted(() => {
  loadVersion()
  refreshDbStatus()
  // 从「切换账号」跳转而来：?pre=账号名 → 预填该账号输密码；?new=1 → 清空账号框输新账号
  const q = route.query
  if (q.pre && typeof q.pre === 'string' && q.pre) {
    username.value = q.pre
    errorMsg.value = '已退出原账号，请输入该账号密码登录'
    router.replace({ path: '/login', query: {} })
  } else if (q.new) {
    username.value = ''
    errorMsg.value = '请输入新账号和密码'
    router.replace({ path: '/login', query: {} })
  }
})

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
  background-color: var(--bg-page);
  overflow: auto;
}
.login-main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

/* ===== 左：品牌区 ===== */
.brand-panel {
  flex: 1.4 1 0;
  position: relative;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-page) 0%, var(--primary-soft) 100%);
  min-width: 0;
}
.brand-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  width: 100%;
  padding: 48px 56px 36px;
  box-sizing: border-box;
  min-width: 0;
}
.brand-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-logo {
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.brand-name {
  margin: 0;
  max-width: 60%;
  min-width: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-copy {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}
.brand-slogan {
  margin: 0;
  max-width: 520px;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.6;
  letter-spacing: 1px;
  color: var(--text);
}
/* 背景装饰：极淡圆环（primary 低透明度，仅增加层次） */
.brand-rings {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.ring {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--primary) 12%, transparent);
  border-radius: 50%;
}
.ring-1 {
  top: -110px;
  right: -70px;
  width: 340px;
  height: 340px;
}
.ring-2 {
  top: 80px;
  right: 50px;
  width: 130px;
  height: 130px;
}

/* ===== 右：登录卡 ===== */
.form-panel {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  min-width: 0;
}
.login-card {
  width: 360px;
  max-width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 32px 30px 20px;
  box-shadow: var(--shadow-lg);
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
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}
/* 数据库状态：登录卡右上角胶囊，点击进入数据库配置 */
.db-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 9px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.2s;
}
.db-status .db-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: currentColor;
}
.db-status.is-connected {
  color: var(--success);
  background: var(--success-soft);
  border-color: color-mix(in srgb, var(--success) 25%, var(--bg-card));
}
.db-status.is-disconnected {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: var(--danger-border);
}
.db-status.is-loading,
.db-status.is-unavailable {
  color: var(--muted);
  background: var(--gray-soft);
  border-color: var(--border);
}

/* ===== 页脚：版本号 + 版权 ===== */
.login-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 16px 16px 18px;
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
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-sub {
  margin: 6px 0 4px;
  font-size: 13px;
  color: var(--muted);
}
.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin: 14px 0 6px;
}
.field-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.field-input:focus {
  border-color: var(--primary);
}
.error-msg {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--danger);
}
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 14px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: var(--on-accent);
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
/* ===== 验证码区域（连续失败后显示） ===== */
.captcha-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.captcha-input {
  flex: 1;
  min-width: 0;
}
.captcha-img {
  flex: none;
  width: 112px;
  height: 42px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--gray-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted);
  transition: border-color 0.2s;
}
.captcha-img img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.captcha-img:hover {
  border-color: var(--primary);
}
/* ===== 协议确认行（默认不勾选，未勾选拦截登录） ===== */
.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;
}
.agree-check {
  appearance: none;
  -webkit-appearance: none;
  flex: none;
  width: 16px;
  height: 16px;
  margin: 1px 0 0;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--bg-card);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
  position: relative;
}
.agree-check:checked {
  background: var(--primary);
  border-color: var(--primary);
}
.agree-check:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid var(--on-accent);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.agree-text {
  min-width: 0;
}
.agree-text a {
  color: var(--primary);
  text-decoration: underline;
}
.agree-text a:hover {
  opacity: 0.85;
}
/* 协议全文按换行分段展示 */
.agreement-body {
  white-space: pre-line;
}
/* 卡片底部：忘记密码入口 */
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
}
.forgot-link {
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.2s;
}
.forgot-link:hover {
  color: var(--primary);
}/* ===== 管理员联系方式弹窗 ===== */
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
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  background: var(--bg-card);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
}
.privacy-head h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text);
}
.privacy-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--gray-soft);
  color: var(--text-2);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.privacy-body {
  padding: 16px 18px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
}
</style>
