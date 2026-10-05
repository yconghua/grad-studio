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
            <div class="login-tabs" role="tablist">
              <button
                type="button"
                class="login-tab"
                :class="{ active: loginMode === 'account' }"
                @click="switchMode('account')"
              >账号登录</button>
              <button
                type="button"
                class="login-tab"
                :class="{ active: loginMode === 'scan' }"
                @click="switchMode('scan')"
              >扫码登录</button>
            </div>
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
          <p class="card-sub">{{ loginMode === 'account' ? '请输入账号密码以进入系统' : '请使用手机扫描二维码登录' }}</p>

          <!-- 数据库未连接横幅：禁用下方全部登录入口，主进程探测恢复后自动解锁 -->
          <p v-if="!dbConnected" class="db-banner">
            数据库连接失败，正在自动重试…<span v-if="dbBannerMsg" class="db-banner-msg">{{ dbBannerMsg }}</span>
          </p>

          <form v-if="loginMode === 'account'" @submit.prevent="onSubmit">
            <label class="field-label" for="username">账号</label>
            <input
              id="username"
              v-model="username"
              class="field-input"
              type="text"
              placeholder="请输入账号（区分大小写）"
              autocomplete="username"
              :disabled="!dbConnected"
              @keyup.enter="onSubmit"
            />

            <label class="field-label" for="password">密码</label>
            <div class="field-input-wrap">
              <input
                id="password"
                v-model="password"
                class="field-input"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
                :disabled="!dbConnected"
                @keyup.enter="onSubmit"
              />
              <button
                type="button"
                class="pwd-toggle"
                :title="showPassword ? '隐藏密码' : '显示密码'"
                aria-label="显示或隐藏密码"
                :disabled="!dbConnected"
                @mousedown.prevent="showPassword = !showPassword"
              >
                <EyeOutlined v-if="!showPassword" />
                <EyeInvisibleOutlined v-else />
              </button>
            </div>

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
                  :disabled="!dbConnected"
                  @keyup.enter="onSubmit"
                />
                <button
                  type="button"
                  class="captcha-img"
                  title="看不清？点击刷新"
                  :disabled="!dbConnected"
                  @click="loadCaptcha"
                >
                  <img v-if="captchaSvg" :src="captchaSvg" alt="验证码，点击刷新" />
                  <span v-else>点击获取</span>
                </button>
              </div>
            </template>

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button class="submit-btn" type="submit" :disabled="loading || !dbConnected">
              {{ loading ? '登录中…' : '登 录' }}
            </button>

            <label class="agree-row">
              <input v-model="agreed" type="checkbox" class="agree-check" />
              <span class="agree-text">
                我已阅读并同意<a href="#" @click.prevent="openAgreement('user')">《用户协议》</a>和<a href="#" @click.prevent="openAgreement('privacy')">《隐私政策》</a>
              </span>
            </label>
          </form>

          <!-- 扫码登录面板（协议确认与账号 Tab 共用同一勾选状态） -->
          <div v-else class="scan-panel">
            <div class="scan-qr-wrap">
              <img v-if="scanQrDataUrl" :src="scanQrDataUrl" class="scan-qr" alt="扫码登录二维码" />
              <span v-else class="scan-qr-loading">{{ scanQrPlaceholder }}</span>
              <div v-if="!agreed" class="scan-qr-mask">请先阅读并同意<br />用户协议与隐私政策</div>
              <div v-if="!dbConnected" class="scan-qr-mask">数据库未连接，无法扫码登录</div>
            </div>
            <p class="scan-status" :class="scanStatusClass">{{ scanStatusText }}</p>
            <!-- 多网卡（含手机热点/电脑热点）时显示地址切换：手机连不上时切换为当前所在网络的地址 -->
            <div v-if="scanCandidates.length > 1" class="scan-addr-row">
              <span class="scan-addr-label">二维码地址</span>
              <button
                v-for="c in scanCandidates"
                :key="c.ip"
                type="button"
                class="scan-addr-btn"
                :class="{ active: scanBaseUrl === c.baseUrl }"
                :disabled="scanLoading || !dbConnected"
                @click="switchScanAddr(c.baseUrl)"
              >{{ c.name }}<em>{{ c.ip }}</em></button>
            </div>
            <button type="button" class="scan-refresh" :disabled="scanLoading || !dbConnected" @click="startScanLogin">
              {{ scanLoading ? '加载中…' : '刷新二维码' }}
            </button>
            <label class="agree-row">
              <input v-model="agreed" type="checkbox" class="agree-check" />
              <span class="agree-text">
                我已阅读并同意<a href="#" @click.prevent="openAgreement('user')">《用户协议》</a>和<a href="#" @click.prevent="openAgreement('privacy')">《隐私政策》</a>
              </span>
            </label>
            <p class="scan-hint">请使用微信 / 支付宝 / 手机浏览器扫码</p>
          </div>

          <!-- 卡片底部：忘记密码 + 使用帮助（账号 / 扫码两个模式共用） -->
          <div class="card-foot">
            <button type="button" class="forgot-link" @click="showAdminContact = true">忘记密码</button>
            <span class="foot-divider" aria-hidden="true"></span>
            <button type="button" class="forgot-link" @click="showHelp = true">使用帮助</button>
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

    <!-- 使用帮助弹窗（内置手册：快速上手 / 登录方式 / 快捷键 / 常见问题） -->
    <div v-if="showHelp" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showHelp = false"></div>
      <div class="privacy-dialog help-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>使用帮助</h3>
          <button type="button" class="privacy-close" @click="showHelp = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body help-body">{{ HELP_CONTENT }}</div>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import QRCode from 'qrcode'
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { login, getCaptcha, getScanQr, scanStatus, scanCancel, deleteDb, getDbInfo, getDbStatus, onDbStatusChanged, getPublicInfo } from '../../api'
import { useSession } from '../../composables/useSession'
import { useAccountHistory } from '../../composables/useAccountHistory'
import { useAppName } from '../../composables/useAppName'
import { ROLE_HOME } from '../../router'
import { USER_AGREEMENT, PRIVACY_POLICY } from './agreements'
import { BaseConfig, DbSwitch, DbAdd, DbDeleteConfirm } from '../../components/dialogs'
import ParticleBackground from '../../components/particles/ParticleBackground.vue'
import AppTitleBar from '../../components/layout/AppTitleBar.vue'
import logoUrl from '../../assets/logo.ico'

// 使用帮助手册（内置文本，随版本更新）
const HELP_CONTENT = `【快速上手】
1. 首次使用：先配置数据库连接。点击登录卡片右上角的数据库状态指示（圆点+文字），在「数据库配置」中填写主机、端口、库名与账号密码；连接成功后即可登录。
2. 默认账号由管理员创建；首次登录后按提示修改初始密码。

【登录方式】
· 账号登录：输入账号与密码（区分大小写），连续失败 3 次后需输入图形验证码；连续失败 5 次该账号锁定 5 分钟。
· 扫码登录：需要手机与电脑处于同一网络（同一 WiFi，或电脑连手机热点后用另一台手机扫码）。如手机打不开二维码，可在二维码下方切换网络地址。

【常用快捷键】
· 回车：在账号/密码/验证码输入框内按回车可直接登录。

【常见问题】
· 数据库连不上：检查 MySQL 是否已启动、账号密码与库名是否正确，点击数据库状态指示查看连接信息。
· 扫码手机打不开二维码：确认手机与电脑同一网络。
· 忘记密码：点击登录卡片下方「忘记密码」查看管理员联系方式，由管理员重置。
· 账号被锁定：连续失败 5 次触发锁定，5 分钟后自动解锁，无需联系管理员。`

const { setSession } = useSession()
const { recordLogin } = useAccountHistory()
const { appName } = useAppName()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
// 数据库连接状态：未连接时禁用登录表单（横幅提示 + 输入/按钮灰置），主进程探测恢复后自动解锁
const dbConnected = ref(true)
const dbBannerMsg = ref('')
// 数据库状态变化订阅句柄（onUnmounted 退订）
let unsubscribeDbStatus = null
// 密码显示/隐藏（眼睛图标切换，不改变输入内容）
const showPassword = ref(false)
// 账号锁定倒计时（毫秒）：>0 时锁定登录按钮并每秒刷新剩余时间
const lockRemainMs = ref(0)
let lockTimer = null
// 使用帮助弹窗
const showHelp = ref(false)

// 图形验证码（连续登录失败后强制显示）：captchaId + SVG 由主进程下发，答案不落前端
const needCaptcha = ref(false)
const captchaId = ref('')
const captchaCode = ref('')
const captchaSvg = ref('')
// 协议确认：默认不勾选，未勾选时拦截登录（账号 / 扫码两个 Tab 共用）
const agreed = ref(false)
const agreementType = ref('')

// 登录方式：account 账号登录 / scan 扫码登录
const loginMode = ref('account')
// 扫码登录：二维码 data URL、状态文案、ticket、轮询句柄
const scanQrDataUrl = ref('')
const scanTicket = ref('')
const scanStatusText = ref('')
const scanStatusClass = ref('')
const scanLoading = ref(false)
// 扫码地址候选与当前选择（多网卡时在二维码下方切换，默认自动探测的首选地址）
const scanCandidates = ref([])
const scanBaseUrl = ref('')
// 二维码占位：未勾选协议时不生成二维码（遮罩提示），勾选后显示加载中
const scanQrPlaceholder = computed(() => (agreed.value ? '二维码加载中…' : ''))
let scanTimer = null
let scanStartAt = 0
// 扫码登录成功标志：成功后跳转不再作废 ticket（否则手机确认页会被误标"已取消登录"）
let scanSucceeded = false
const SCAN_POLL_MS = 1500
const SCAN_TIMEOUT_MS = 120 * 1000
// 轮询连续失败达到该次数时自动重新取码（网络切换后自动换新地址）
const SCAN_FAIL_AUTO_REFRESH = 3
let scanFailCount = 0

// 协议勾选联动：勾选后（扫码 Tab 且无二维码）自动加载；取消勾选立即作废已生成二维码
watch(agreed, (val) => {
  if (loginMode.value !== 'scan') return
  if (val) {
    if (!scanTicket.value && !scanLoading.value) startScanLogin()
  } else {
    stopScanPolling()
    if (scanTicket.value) {
      const t = scanTicket.value
      const base = scanBaseUrl.value
      scanTicket.value = ''
      scanCancel(t, base).catch(() => {})
    }
    scanQrDataUrl.value = ''
    scanStatusText.value = ''
    scanStatusClass.value = ''
  }
})

// 切换登录方式：离开扫码 Tab 时停止轮询并作废二维码
function switchMode(mode) {
  if (loginMode.value === mode) return
  stopScanPolling()
  if (scanTicket.value) {
    const t = scanTicket.value
    const base = scanBaseUrl.value
    scanTicket.value = ''
    scanCancel(t, base).catch(() => {})
  }
  loginMode.value = mode
  if (mode === 'scan') startScanLogin()
}

// 获取二维码并启动轮询（进入扫码 Tab / 点击刷新时调用）；
// reprobe=true 表示网络变化自动重取：不携带旧地址，由后端每次实时探测当前局域网 IP
async function startScanLogin(reprobe = false) {
  stopScanPolling()
  scanFailCount = 0
  // 数据库未连接时不取码（扫码登录最终仍需查库校验身份）
  if (!dbConnected.value) {
    scanQrDataUrl.value = ''
    scanStatusText.value = '数据库未连接，无法扫码登录'
    scanStatusClass.value = 'is-error'
    return
  }
  // 未勾选协议时不生成二维码，真正阻止扫码（非仅视觉遮挡）
  if (!agreed.value) {
    scanQrDataUrl.value = ''
    scanStatusText.value = '请先阅读并同意用户协议与隐私政策'
    scanStatusClass.value = 'is-error'
    return
  }
  scanLoading.value = true
  scanStatusText.value = ''
  scanStatusClass.value = ''
  // 先作废旧二维码：刷新后旧 ticket 立即失效（旧码在 TTL 内再扫会提示"二维码已失效"）
  if (scanTicket.value) {
    const t = scanTicket.value
    const base = scanBaseUrl.value
    scanTicket.value = ''
    scanCancel(t, base).catch(() => {})
  }
  try {
    const res = await getScanQr(reprobe ? undefined : { baseUrl: scanBaseUrl.value || undefined })
    if (!res || !res.success || !res.data) {
      scanStatusText.value = '二维码获取失败，请重试'
      scanStatusClass.value = 'is-error'
      return
    }
    scanTicket.value = res.data.ticket
    scanQrDataUrl.value = await QRCode.toDataURL(res.data.qrUrl, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
    scanBaseUrl.value = res.data.baseUrl || scanBaseUrl.value
    scanCandidates.value = Array.isArray(res.data.candidates) ? res.data.candidates : []
    scanStartAt = Date.now()
    scanStatusText.value = '等待扫码…'
    scanStatusClass.value = 'is-waiting'
    scanTimer = setInterval(pollScanStatus, SCAN_POLL_MS)
  } catch (e) {
    scanStatusText.value = '二维码获取失败，请重试'
    scanStatusClass.value = 'is-error'
  } finally {
    scanLoading.value = false
  }
}

// 切换二维码地址（多网卡时）：先作废旧 ticket，再按新地址重新签发
async function switchScanAddr(baseUrl) {
  if (scanLoading.value || scanBaseUrl.value === baseUrl) return
  if (scanTicket.value) {
    const t = scanTicket.value
    const oldBase = scanBaseUrl.value
    scanTicket.value = ''
    scanCancel(t, oldBase).catch(() => {})
  }
  scanBaseUrl.value = baseUrl
  await startScanLogin()
}

// 轮询二维码状态：按后端契约推进 pending → scanned → approved / denied / expired
async function pollScanStatus() {
  if (!scanTicket.value) return
  if (Date.now() - scanStartAt > SCAN_TIMEOUT_MS) {
    stopScanPolling()
    scanStatusText.value = '二维码已失效，请刷新'
    scanStatusClass.value = 'is-error'
    return
  }
  let res
  try {
    res = await scanStatus(scanTicket.value, scanBaseUrl.value)
  } catch (e) {
    // 网络切换等导致当前地址不可达：连续失败达到阈值时自动重新取码（后端实时重探测 IP）
    scanFailCount++
    if (scanFailCount >= SCAN_FAIL_AUTO_REFRESH) {
      stopScanPolling()
      scanStatusText.value = '网络已变化，正在自动刷新二维码…'
      scanStatusClass.value = 'is-error'
      startScanLogin(true)
    }
    return
  }
  scanFailCount = 0
  if (!res || !res.success) return
  const status = res.data && res.data.status
  if (status === 'pending') {
    scanStatusText.value = '等待扫码…'
    scanStatusClass.value = 'is-waiting'
  } else if (status === 'scanned') {
    scanStatusText.value = '已扫码，请在手机上确认'
    scanStatusClass.value = 'is-waiting'
  } else if (status === 'approved') {
    stopScanPolling()
    const user = res.data && res.data.user
    if (!user) {
      scanStatusText.value = '登录响应异常，请刷新重试'
      scanStatusClass.value = 'is-error'
      return
    }
    if (!agreed.value) {
      scanStatusText.value = '请先阅读并同意用户协议与隐私政策'
      scanStatusClass.value = 'is-error'
      return
    }
    scanSucceeded = true
    setSession(user)
    recordLogin(user)
    if (user.mustChangePassword) {
      router.replace('/force-password')
    } else {
      router.replace(ROLE_HOME[user.role] || '/login')
    }
  } else if (status === 'denied') {
    stopScanPolling()
    scanStatusText.value = '已拒绝，请刷新二维码重试'
    scanStatusClass.value = 'is-error'
  } else if (status === 'verify-failed') {
    // 手机端提交的账号密码校验失败：提示并继续轮询（等待手机端重试，或过期/刷新）
    scanStatusText.value = (res.data && res.data.message) || '验证失败，请在手机上重试'
    scanStatusClass.value = 'is-error'
  } else if (status === 'expired') {
    stopScanPolling()
    scanStatusText.value = '二维码已过期，正在刷新…'
    scanStatusClass.value = 'is-error'
    startScanLogin()
  }
}

// 停止轮询（成功 / 失败 / 切 Tab / 离开页面共用）
function stopScanPolling() {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

// 网络断开：二维码地址必然不可达，直接提示
function onNetworkOffline() {
  if (loginMode.value !== 'scan') return
  scanStatusText.value = '网络已断开，请检查网络连接'
  scanStatusClass.value = 'is-error'
}

// 网络恢复：自动重新取码（后端实时重探测 IP，换新地址继续）
function onNetworkOnline() {
  if (loginMode.value !== 'scan' || scanLoading.value) return
  if (scanTicket.value || scanQrDataUrl.value) {
    stopScanPolling()
    scanStatusText.value = '网络已恢复，正在刷新二维码…'
    scanStatusClass.value = 'is-error'
    startScanLogin(true)
  }
}

// 离开登录页：清理轮询并作废二维码（登录成功跳转时不作废，保留 approved 终态）
onUnmounted(() => {
  stopScanPolling()
  stopLockCountdown()
  if (unsubscribeDbStatus) unsubscribeDbStatus()
  window.removeEventListener('online', onNetworkOnline)
  window.removeEventListener('offline', onNetworkOffline)
  if (scanTicket.value && !scanSucceeded) {
    scanCancel(scanTicket.value, scanBaseUrl.value).catch(() => {})
  }
})

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

// 锁定剩余时长文案：'X 分 Y 秒' / 'Y 秒'
function formatLockRemain(ms) {
  const totalSec = Math.max(1, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  return min > 0 ? `账号已锁定，请 ${min} 分 ${totalSec % 60} 秒后重试` : `账号已锁定，请 ${totalSec} 秒后重试`
}

// 账号锁定倒计时：每秒刷新提示，归零后清除
function startLockCountdown(remainMs) {
  stopLockCountdown()
  lockRemainMs.value = remainMs
  errorMsg.value = formatLockRemain(remainMs)
  lockTimer = setInterval(() => {
    lockRemainMs.value -= 1000
    if (lockRemainMs.value <= 0) {
      stopLockCountdown()
      errorMsg.value = ''
      return
    }
    errorMsg.value = formatLockRemain(lockRemainMs.value)
  }, 1000)
}

function stopLockCountdown() {
  if (lockTimer) {
    clearInterval(lockTimer)
    lockTimer = null
  }
}

// 登录：成功后按角色跳转对应工作台；首次登录（mustChangePassword）先强制改密
async function onSubmit() {
  if (loading.value) return
  if (lockRemainMs.value > 0) return // 锁定期间禁止提交
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
    // 失败：主进程要求验证码时显示区域并自动刷新；账号锁定时启动倒计时
    if (res && res.data) {
      if (res.data.needCaptcha) {
        needCaptcha.value = true
        await loadCaptcha()
      }
      if (res.data.lock && res.data.lock.locked) {
        startLockCountdown(res.data.lock.remainMs)
        loading.value = false
        return
      }
      if (res.data.lock && res.data.lock.failures > 0) {
        const left = 5 - res.data.lock.failures
        errorMsg.value = `${res.message || '账号或密码错误'}（连续失败 5 次账号将锁定 5 分钟，还可尝试 ${left} 次）`
        loading.value = false
        return
      }
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
// 数据库连接状态（dbStatusService 持续探测的快照）：驱动登录表单禁用/解锁
async function refreshDbConnected() {
  if (!window.api || !window.api.sys || !window.api.sys.dbStatus) return
  try {
    const res = await getDbStatus()
    if (res && res.success) {
      dbConnected.value = !!res.connected
      dbBannerMsg.value = res.connected ? '' : (res.message || '')
    }
  } catch (e) {
    // 接口异常按未连接处理（保守禁用登录入口）
    dbConnected.value = false
  }
}

onMounted(() => {
  loadVersion()
  refreshDbStatus()
  refreshDbConnected()
  // 数据库连接状态变化订阅：恢复后表单原地解锁，无需刷新
  unsubscribeDbStatus = onDbStatusChanged(({ connected, message }) => {
    dbConnected.value = !!connected
    dbBannerMsg.value = connected ? '' : (message || '')
  })
  // 网络切换感知：离线提示，恢复后自动刷新二维码
  window.addEventListener('online', onNetworkOnline)
  window.addEventListener('offline', onNetworkOffline)
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
  refreshDbConnected()
}

function onDbAdded() {
  switchRefreshKey.value++
  refreshDbStatus()
  refreshDbConnected()
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
  refreshDbConnected()
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
/* 登录方式 Tab（账号登录 / 扫码登录） */
.login-tabs {
  display: flex;
  gap: 16px;
}
.login-tab {
  border: none;
  background: none;
  padding: 4px 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.login-tab.active {
  color: var(--text);
  border-bottom-color: var(--primary);
}
.login-tab:hover {
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
  gap: 10px;
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
/* 页脚「使用帮助」入口 */
.card-sub {
  margin: 6px 0 4px;
  font-size: 13px;
  color: var(--muted);
}
/* 数据库未连接横幅：登录卡内醒目提示，禁用期间常驻 */
.db-banner {
  margin: 10px 0 0;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-md);
  word-break: break-all;
}
.db-banner-msg {
  opacity: 0.85;
  margin-left: 6px;
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
/* 数据库未连接时输入框灰置 */
.field-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--gray-soft);
}
/* 密码输入框容器与显示/隐藏眼睛按钮 */
.field-input-wrap {
  position: relative;
}
.field-input-wrap .field-input {
  padding-right: 38px;
}
.pwd-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}
.pwd-toggle:hover {
  color: var(--primary);
}
/* 使用帮助弹窗：内容可滚动 */
.help-dialog .privacy-body {
  max-height: 46vh;
  overflow-y: auto;
}
.help-body {
  white-space: pre-line;
  line-height: 1.8;
  font-size: 13px;
  color: var(--text-2);
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
.captcha-img:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  text-decoration: none;
}
.agree-text a:hover {
  opacity: 0.85;
}
/* 协议全文按换行分段展示 */
.agreement-body {
  white-space: pre-line;
}
/* ===== 扫码登录面板 ===== */
.scan-panel {
  margin-top: 8px;
}
.scan-qr-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 8px auto 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
}
.scan-qr {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: var(--radius-md);
}
.scan-qr-loading {
  font-size: 13px;
  color: var(--muted);
}
/* 未勾选协议时的覆盖提示：阻止扫码流程 */
.scan-qr-mask {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg-card) 62%, transparent);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-2);
  text-align: center;
  line-height: 1.8;
}
.scan-status {
  margin: 12px 0 0;
  text-align: center;
  font-size: 13px;
  min-height: 18px;
  color: var(--text-2);
}
.scan-status.is-error {
  color: var(--danger);
}
.scan-refresh {
  display: block;
  width: 100%;
  height: 40px;
  margin-top: 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.scan-refresh:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.scan-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
/* 多网卡地址切换行（手机热点/电脑热点/虚拟机多网卡时显示） */
.scan-addr-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}
.scan-addr-label {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.scan-addr-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.scan-addr-btn em {
  font-style: normal;
  opacity: 0.75;
  margin-left: 4px;
}
.scan-addr-btn.active {
  border-color: var(--primary);
  color: var(--primary);
}
.scan-addr-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.scan-hint {
  margin: 12px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
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
}
/* 忘记密码 / 使用帮助 之间的分隔线 */
.foot-divider {
  width: 1px;
  height: 12px;
  background: var(--border-strong);
  opacity: 0.7;
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
