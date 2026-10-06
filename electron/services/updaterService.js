/**
 * 应用更新服务（Service Layer）—— 基于 electron-updater 的自动更新
 *
 * 职责：
 *   - 封装 electron-updater：检查更新 / 下载 / 安装；
 *   - 维护更新状态机：idle → checking → available/not-available → downloading → downloaded → installing；
 *   - 把 autoUpdater 事件统一转成 update:event 推送给渲染层（前端更新弹窗跟随状态）；
 *   - 未打包（开发模式）时按 electron-updater 规则读取 dev-app-update.yml，缺失则给出中文提示。
 *
 * 与渲染层约定的事件负载（webContents.send('update:event', { type, data })）：
 *   { type: 'checking',      data: {} }
 *   { type: 'available',     data: { version } }
 *   { type: 'not-available', data: { version } }
 *   { type: 'downloading',   data: { percent, transferred, total, bytesPerSecond } }
 *   { type: 'downloaded',    data: { version, downloadedFile } }
 *   { type: 'installing',    data: {} }
 *   { type: 'error',         data: { message } }
 */
const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')

// 当前状态快照（getState 返回给前端，重开弹窗时恢复 UI）
const state = {
  stage: 'idle',        // idle | checking | available | not-available | downloading | downloaded | installing | error
  version: '',          // 最新可用版本（available/downloaded 时有值）
  percent: 0,           // 下载进度 0-100
  downloadedFile: '',   // 下载完成的安装包路径
  message: '',          // 错误 / 提示文案
  upToDate: false       // 是否已是最新（not-available 时为 true）
}

// 事件推送：转发到全部窗口（本应用为单窗口，通常只有一个）
function pushEvent(type, data = {}) {
  const payload = { type, data }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:event', payload)
  }
}

function setStage(stage, patch = {}) {
  Object.assign(state, { stage }, patch)
  return state
}

// autoUpdater 配置：下载由用户在前端触发，不静默自动下载
autoUpdater.autoDownload = false

// 发现新版
autoUpdater.on('update-available', (info) => {
  setStage('available', { version: info && info.version ? info.version : '', upToDate: false })
  pushEvent('available', { version: state.version })
})

// 已是最新
autoUpdater.on('update-not-available', (info) => {
  setStage('not-available', { version: info && info.version ? info.version : '', upToDate: true, message: '' })
  pushEvent('not-available', { version: state.version })
})

// 下载进度
autoUpdater.on('download-progress', (p) => {
  const percent = p && Number.isFinite(p.percent) ? Math.round(p.percent) : 0
  setStage('downloading', { percent })
  pushEvent('downloading', {
    percent,
    transferred: p ? p.transferred : 0,
    total: p ? p.total : 0,
    bytesPerSecond: p ? p.bytesPerSecond : 0
  })
})

// 下载完成
autoUpdater.on('update-downloaded', (info) => {
  setStage('downloaded', {
    version: info && info.version ? info.version : state.version,
    downloadedFile: info && info.downloadedFile ? info.downloadedFile : ''
  })
  pushEvent('downloaded', { version: state.version, downloadedFile: state.downloadedFile })
})

// 更新过程错误（未打包缺 dev-app-update.yml / 网络失败 / 更新源 404 等）
autoUpdater.on('error', (err) => {
  const message = friendlyError(err)
  setStage('error', { message })
  pushEvent('error', { message })
})

// 把 electron-updater 原始错误转成用户可读的中文文案
function friendlyError(err) {
  const raw = (err && err.message) || String(err || '')
  if (!app.isPackaged && /not packed|dev-app-update\.yml/i.test(raw)) {
    return '开发模式未配置 dev-app-update.yml，无法检查更新；打包后应用会自动读取内置更新配置'
  }
  if (/Cannot find latest\.yml/i.test(raw)) {
    return '更新源未找到版本信息（latest.yml），请确认 GitHub Release 已上传更新文件'
  }
  if (/404/i.test(raw)) {
    return '更新源不可用（404），请检查镜像地址或网络'
  }
  if (raw) return '检查更新失败：' + raw
  return '检查更新失败，请稍后重试'
}

/**
 * 检查更新：立即返回当前状态，结果经 update:event 推送
 */
async function check() {
  if (state.stage === 'downloading' || state.stage === 'installing') {
    return { stage: state.stage }
  }
  setStage('checking', { message: '', upToDate: false })
  pushEvent('checking')
  try {
    await autoUpdater.checkForUpdates()
    return { stage: state.stage }
  } catch (err) {
    // checkForUpdates 抛错时兜底（部分场景只 reject 不触发 error 事件）
    const message = friendlyError(err)
    setStage('error', { message })
    pushEvent('error', { message })
    return { stage: 'error', message }
  }
}

/**
 * 下载更新：仅在有可用版本时触发，进度经 update:event 推送
 */
async function download() {
  if (state.stage === 'downloading') return { stage: 'downloading' }
  if (state.stage === 'downloaded') return { stage: 'downloaded', message: '更新包已就绪，可直接安装' }
  if (state.stage !== 'available') return { stage: state.stage, message: '当前没有可下载的更新' }
  try {
    await autoUpdater.downloadUpdate()
    return { stage: state.stage }
  } catch (err) {
    const message = '下载更新失败：' + ((err && err.message) || String(err || ''))
    setStage('error', { message })
    pushEvent('error', { message })
    return { stage: 'error', message }
  }
}

/**
 * 安装更新：退出当前应用并运行安装器。
 * 无代码签名时可能被 Windows SmartScreen 拦截，前端需提示手动运行安装包路径。
 */
function install() {
  if (state.stage !== 'downloaded') {
    return { stage: state.stage, message: '更新包尚未下载完成' }
  }
  setStage('installing')
  pushEvent('installing')
  autoUpdater.quitAndInstall()
  return { stage: 'installing' }
}

// 当前状态快照（前端重开弹窗恢复 UI 用）
function getState() {
  return { ...state }
}

module.exports = { check, download, install, getState }
