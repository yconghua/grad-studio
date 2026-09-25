<template>
  <div class="login-page" :style="{ backgroundImage: `url(${loginBg})` }">
    <!-- 上：系统标题 -->
    <header class="login-header">
      <img :src="logoUrl" class="brand-mark" alt="研究生工作室管理平台" />
      <h1 class="brand-title">研究生工作室管理平台</h1>
    </header>

    <!-- 中：简介（左） + 登录表单（右） -->
    <main class="login-main">
      <section class="intro-panel">
        <img :src="jianjieUrl" class="intro-image" alt="研究生工作室管理平台" />
        <div class="intro-overlay">
          <h2 class="intro-title">系统简介</h2>
          <p class="intro-foot">记录 · 管理 · 成长</p>
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

          <!-- 默认账号提示：仅提示默认密码，首次登录需修改密码 -->
          <div class="default-tip">
            <b>默认密码提示</b>：管理员 <b>admin123456</b> · 导师 <b>ds123456@</b> · 学生 <b>xs123456@</b>（首次登录需修改密码）
          </div>

          <form @submit.prevent="onSubmit">
            <label class="field-label" for="username">账号</label>
            <input
              id="username"
              v-model="username"
              class="field-input"
              type="text"
              placeholder="请输入账号"
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

            <!-- 同意并接受隐私协议与服务条款（未勾选不可登录） -->
            <label class="agree-row">
              <input type="checkbox" v-model="agreePolicy" />
              <span class="agree-text">
                我已阅读并同意
                <span class="agree-link" @click.prevent="showPrivacy = true">《隐私协议》</span>
                和
                <span class="agree-link" @click.prevent="showTerms = true">《服务条款》</span>
              </span>
            </label>

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
        <span class="footer-copy">Copyright © 2025–{{ copyrightYear }} Gra Studio. All Rights Reserved. 研究生工作室管理平台 版权所有</span>
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

    <!-- 隐私协议弹窗 -->
    <div v-if="showPrivacy" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showPrivacy = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>隐私协议</h3>
          <button type="button" class="privacy-close" @click="showPrivacy = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p class="privacy-lead">
            更新时间：2026年8月25日
          </p>
          <p class="privacy-lead">
            研究生工作室管理平台（以下简称"本系统"）重视您的隐私。本隐私协议说明本系统在本地运行过程中如何收集、存储与使用您的信息。
          </p>
          <section v-for="(sec, i) in privacySections" :key="i" class="privacy-sec">
            <h4>{{ sec.title }}</h4>
            <p>{{ sec.body }}</p>
          </section>
        </div>
      </div>
    </div>

    <!-- 服务条款弹窗 -->
    <div v-if="showTerms" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showTerms = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>服务条款</h3>
          <button type="button" class="privacy-close" @click="showTerms = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p class="privacy-lead">
            更新时间：2026年8月25日
          </p>
          <p class="privacy-lead">
            研究生工作室管理平台（以下简称"本系统"）的账号由管理员统一分配与管理，使用前请仔细阅读以下服务条款。
          </p>
          <section v-for="(sec, i) in termsSections" :key="i" class="privacy-sec">
            <h4>{{ sec.title }}</h4>
            <p>{{ sec.body }}</p>
          </section>
        </div>
      </div>
    </div>

    <!-- 数据库管理相关弹窗（已抽离为 components/db/ 组件） -->
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

    <!-- 登录成功初始化弹窗：转圈动画 + 「数据正在初始化中…」，2 秒后自动进入首页 -->
    <div v-if="showInit" class="init-overlay">
      <div class="init-dialog">
        <div class="init-spinner"></div>
        <p class="init-text">数据正在初始化中…</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, deleteDb, getDbInfo } from '../../api'
import { useSession } from '../../composables/useSession'
import { BaseConfig, DbSwitch, DbAdd, DbDeleteConfirm } from '../../components/db'
import logoUrl from '../../assets/logo.ico'
import loginBg from '../../assets/login_bg.png'
import jianjieUrl from '../../assets/login_jianjie.png'

const { setSession } = useSession()
const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
// 登录成功后的初始化弹窗：显示 1 秒（转圈 + 「数据正在初始化中…」）后自动进入首页
const showInit = ref(false)
// 是否同意隐私协议与服务条款（未勾选不可登录）
const agreePolicy = ref(false)

// 登录卡片右上角的数据库状态：挂载时 + 切换数据库后刷新
// 状态值：loading（检测中）/ connected（已连接）/ disconnected（未连接）/ unavailable（环境不可用）
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
// 悬停提示当前连接的主机 / 库名
const dbMetaTitle = computed(() => {
  const m = dbMeta.value
  return m.host && m.database ? `${m.database} · ${m.host}:${m.port}` : ''
})
async function refreshDbStatus() {
  // 非 Electron 环境（纯网页端）无 window.api，直接标记不可用，避免报错
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

// 页脚版权年：固定起始 2025，结束取当前动态年份
const copyrightYear = new Date().getFullYear()

// 服务条款 / 隐私协议 / 联系管理员弹窗（保留在登录页）
const showTerms = ref(false)
const showPrivacy = ref(false)
const showAdminContact = ref(false)

// -------------------- 数据库管理弹窗（协调层，逻辑在各弹窗组件内） --------------------
const showBaseConfig = ref(false)
const showSwitchDb = ref(false)
const showAddDb = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref('')
// 刷新信号：切换数据库后刷新基础配置；添加/删除后刷新切换弹窗清单
const settingsRefreshKey = ref(0)
const switchRefreshKey = ref(0)
// 删除结果消息：注入切换弹窗的消息行展示
const extMsg = ref('')
const extMsgOk = ref(false)

// 打开切换弹窗：清空上次外部消息，避免残留
function openSwitchDb() {
  extMsg.value = ''
  extMsgOk.value = false
  showSwitchDb.value = true
}

// 切换数据库成功：刷新基础配置里的当前数据库显示 + 右上角状态药丸
function onDbChanged() {
  settingsRefreshKey.value++
  refreshDbStatus()
}

// 添加成功：刷新切换弹窗的连接清单（若其仍打开）+ 右上角数据库状态药丸
// （首个连接添加后后端已自动生效，必须重新查询才能让状态显示「已连接」）
function onDbAdded() {
  switchRefreshKey.value++
  refreshDbStatus()
}

// 删除请求（来自切换弹窗，校验已通过）：打开确认框
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
}

const termsSections = [
  {
    title: '一、账号使用',
    body: '本系统账号由管理员统一分配，仅限本人使用，严禁转借、共享或泄露给任何第三方。'
  },
  {
    title: '二、账号安全',
    body: '请妥善保管账号密码，如发现账号异常使用或密码泄露，请及时联系管理员重置密码。'
  },
  {
    title: '三、使用规范',
    body: '您在使用本系统过程中需遵守法律法规，不得利用本系统从事违法或损害他人权益的行为。'
  },
  {
    title: '四、行为监督',
    body: '管理员有权对账号使用行为进行监督，如发现违规使用，可暂停或终止账号权限。'
  },
  {
    title: '五、责任承担',
    body: '通过本账号进行的所有操作均视为您本人行为，需承担相应责任。'
  },
  {
    title: '六、条款更新',
    body: '本条款可根据实际需求更新，更新后继续使用本系统即视为接受新条款。'
  }
]

const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '本系统仅收集您在使用时主动上传的数据。我们不会收集与系统运行无关的个人敏感信息。'
  },
  {
    title: '二、密码与凭证安全',
    body: '您的密码在服务器端经算法加密后存储，系统中任何位置均不保存明文密码；登录校验为本地比对，凭证不会离开本机。'
  },
  {
    title: '三、数据存储位置',
    body: '所有业务数据保存在您本机部署的数据库中。本系统为纯本地桌面应用，默认不联网、不上传任何数据至外部服务器。'
  },
  {
    title: '四、登录会话',
    body: '登录态保存在本机浏览器本地存储，有一定的有效期；超过有效期后需重新输入账号密码。您也可随时点击"退出登录"立即结束当前会话。'
  },
  {
    title: '五、信息共享',
    body: '我们不会将您的任何个人信息或业务数据出售、出租或共享给任何第三方。'
  },
  {
    title: '六、您的权利',
    body: '您有权查看与修改本人资料；账号删除将在数据库中全部删除您的数据，请谨慎操作。如对个人信息处理有疑问，可联系系统管理员，1509054114@qq.com。'
  }
]

async function onSubmit() {
  errorMsg.value = ''

  // 未勾选同意协议则禁止登录
  if (!agreePolicy.value) {
    errorMsg.value = '请先阅读并同意隐私协议和服务条款'
    return
  }

  // 基础空值校验
  if (!username.value.trim()) {
    errorMsg.value = '请输入账号'
    return
  }
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }

  loading.value = true
  try {
    const res = await login(username.value.trim(), password.value)
    if (res.success && res.user) {
      // 登录成功：弹「数据正在初始化中…」2 秒后进入首页；
      // 首次登录（mustChangePassword=true）则进入强制改密页
      showInit.value = true
      const mustChange = !!res.user.mustChangePassword
      setTimeout(() => {
        showInit.value = false
        setSession(res.user)
        router.push(mustChange ? '/force-password' : '/')
      }, 2000)
    } else {
      errorMsg.value = res.message || '登录失败，请重试'
    }
  } catch (e) {
    errorMsg.value = '登录过程出现异常，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #eef2ff;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 上：系统标题（居中、字体稍大） */
.login-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 22px 16px 18px;
  background: transparent;
}
.brand-mark {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.brand-title {
  margin: 0;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1d2129;
}

/* 中：简介（左） + 表单（右） */
.login-main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  padding: 40px 0;
}
.intro-panel {
  flex: 1 1 auto;
  position: relative;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  margin-right: 12px;
  margin-left: 30px;
}
.intro-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.intro-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 22px 26px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
  color: #fff;
}
.intro-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
  margin: 0 0 6px;
  color: #fff;
}
.intro-foot {
  margin: 0;
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.92);
}

/* 右：登录表单（固定较窄宽度，左右紧凑） */
.form-panel {
  flex: 0 0 380px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.login-card {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 34px 30px;
  box-shadow: 0 8px 30px rgba(13, 128, 224, 0.12);
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
/* 右上角数据库状态药丸：绿=已连接 / 红=未连接 / 灰=检测中或不可用 */
.db-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
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
.db-status:hover {
  filter: brightness(0.96);
}
.db-status .db-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}
.db-status.is-connected {
  color: #19a558;
  background: rgba(25, 165, 88, 0.10);
  border-color: rgba(25, 165, 88, 0.25);
}
.db-status.is-disconnected {
  color: #ea4335;
  background: rgba(234, 67, 53, 0.10);
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
/* 默认账号密码提示条 */
.default-tip {
  margin: 0 0 14px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #7a5b00;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
}
.default-tip b {
  color: #d48806;
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
  transition: border-color 0.2s;
}
.field-input:focus {
  border-color: #0d80e0;
}
/* 同意隐私协议与服务条款（密码框下方） */
.agree-row {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 14px;
  font-size: 12px;
  color: #8a9099;
  cursor: pointer;
  user-select: none;
}
.agree-row input[type='checkbox'] {
  cursor: pointer;
}
.agree-text {
  line-height: 1.6;
}
.agree-link {
  color: #0d80e0;
  cursor: pointer;
  text-decoration: none;
}
.agree-link:hover {
  opacity: 0.8;
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
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
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
  color: #42b883;
  cursor: pointer;
  text-decoration: none;
}
.admin-link:hover {
  opacity: 0.8;
}

/* 下：页脚（版权与基础配置同一行，居中） */
.login-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 18px 16px 20px;
  background: transparent;
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.footer-link {
  background: none;
  border: none;
  padding: 0;
  color: #8a9099;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.footer-link:hover {
  text-decoration: underline;
}
.footer-copy {
  font-size: 12px;
  color: #8a9099;
}

/* 通用弹窗（联系管理员 / 隐私协议 / 服务条款） */
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
  width: 560px;
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
  padding: 18px 22px;
  border-bottom: 1px solid #eceff3;
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1d2129;
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: #e5e6eb;
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 8px;
}
.privacy-sec h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  margin: 16px 0 6px;
}
.privacy-sec p {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 8px;
}

/* 登录成功初始化弹窗：半透明遮罩 + 白卡片 + 转圈圆环 */
.init-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
}
.init-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 44px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.init-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e6eb;
  border-top-color: #0d80e0;
  border-radius: 50%;
  animation: init-spin 0.8s linear infinite;
}
@keyframes init-spin {
  to {
    transform: rotate(360deg);
  }
}
.init-text {
  margin: 0;
  font-size: 14px;
  color: #4e5969;
}
</style>
