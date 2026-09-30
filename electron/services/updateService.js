/**
 * 自动更新服务 —— 基于 electron-updater 的应用内更新闭环
 *
 * 职责：
 *   - 打包环境下驱动 autoUpdater：检查新版本、自动下载、下载完成后安装并重启；
 *   - 把状态机与下载进度广播给渲染进程（update:state 通道），前端据此展示进度与确认弹窗；
 *   - 开发模式（未打包）直接返回不可用，避免 electron-updater 因缺少 app-update.yml 报错。
 *
 * 状态机：idle → checking → available → downloading → downloaded → installing
 * 任一环节出错 → error（携带 message）。
 *
 * 更新源来自 package.json build.publish（GitHub provider：yconghua/grad-studio），
 * 打包时 electron-builder 会据此生成 resources/app-update.yml，electron-updater 自动读取；
 * 安装器为 NSIS，静默安装时会从注册表恢复首次安装目录（含用户自定义目录），装完自动拉起新版本。
 */
const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')

// 当前更新状态快照：主进程维护，随事件变更后整体广播给渲染进程
const state = {
  status: 'idle', // idle | checking | available | downloading | downloaded | installing | error
  latest: '',
  progress: 0, // 0-100，保留一位小数
  message: '',
  speed: 0, // 下载速度 bytes/s（download-progress 实时值，非下载态为 0）
  eta: null, // 剩余秒数（按当前速度推算，速度未知时为 null）
  transferred: 0, // 已下载字节
  total: 0 // 总字节
}

let initialized = false

// 把状态快照广播给当前窗口（单窗口应用，取第一个窗口）
function broadcast() {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:state', { ...state })
  }
}

function setState(patch) {
  Object.assign(state, patch)
  broadcast()
}

// 初始化并注册事件监听（防重复注册）
function init() {
  if (initialized) return
  initialized = true
  // 发现新版本即自动下载；安装动作由用户在应用内确认后触发
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  // 检查 / 错误等非下载态：清空上一次下载的速度与进度信息，避免界面残留旧值
  autoUpdater.on('checking-for-update', () =>
    setState({ status: 'checking', message: '', progress: 0, speed: 0, eta: null, transferred: 0, total: 0 })
  )
  autoUpdater.on('update-available', (info) =>
    setState({ status: 'available', latest: String((info && info.version) || '') })
  )
  autoUpdater.on('update-not-available', () =>
    setState({ status: 'idle', latest: '', progress: 0, speed: 0, eta: null, transferred: 0, total: 0 })
  )
  autoUpdater.on('download-progress', (p) => {
    const speed = Number((p && p.bytesPerSecond) || 0)
    const total = Number((p && p.total) || 0)
    const transferred = Number((p && p.transferred) || 0)
    const remain = Math.max(0, total - transferred)
    const eta = speed > 0 ? Math.ceil(remain / speed) : null
    setState({
      status: 'downloading',
      progress: Math.round(((p && p.percent) || 0) * 10) / 10,
      speed,
      eta,
      transferred,
      total
    })
  })
  autoUpdater.on('update-downloaded', (info) =>
    setState({
      status: 'downloaded',
      latest: String((info && info.version) || state.latest),
      progress: 100,
      speed: 0,
      eta: 0
    })
  )
  autoUpdater.on('error', (err) =>
    setState({
      status: 'error',
      message: (err && err.message) || String(err),
      speed: 0,
      eta: null
    })
  )
}

// 检查更新（autoDownload=true 时，有新版会一路自动下载，Promise 在下载完成后 resolve）
async function checkForUpdates() {
  if (!app.isPackaged) {
    // 开发模式同样推进状态机，前端实时状态窗可正常展示失败原因
    setState({ status: 'error', message: '开发模式下不支持自动更新，请使用打包安装后的版本', speed: 0, eta: null })
    return { success: false, message: '开发模式下不支持自动更新，请使用打包安装后的版本' }
  }
  init()
  try {
    const result = await autoUpdater.checkForUpdates()
    const info = result && result.updateInfo
    const latest = String((info && info.version) || '')
    const hasUpdate = Boolean(result && result.isUpdateAvailable)
    if (hasUpdate) setState({ status: 'downloaded', latest })
    else setState({ status: 'idle', latest: '' })
    return { success: true, hasUpdate, current: app.getVersion(), latest }
  } catch (err) {
    const reason = (err && err.message) || '请检查网络后重试'
    setState({ status: 'error', message: reason })
    return { success: false, message: `检查更新失败：${reason}` }
  }
}

// 下载完成后静默安装并重启：
//   isSilent=true 走 NSIS 静默安装，无界面打扰，安装器自动恢复到首次安装目录；
//   isForceRunAfter=true 保证装完自动拉起新版本。
function quitAndInstall() {
  if (!app.isPackaged) return { success: false, message: '开发模式下不支持自动更新' }
  if (state.status !== 'downloaded') {
    return { success: false, message: '更新尚未下载完成，无法安装' }
  }
  setState({ status: 'installing' })
  // 延迟一拍再退出安装，确保 IPC 响应与状态广播先送达渲染进程
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 300)
  return { success: true, message: '正在重启并安装更新…' }
}

module.exports = { checkForUpdates, quitAndInstall }
