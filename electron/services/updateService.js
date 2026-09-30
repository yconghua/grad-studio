/**
 * 自动更新服务 —— 基于 electron-updater 的应用内更新闭环
 *
 * 职责：
 *   - 打包环境下驱动 autoUpdater:检查新版本、自动下载、下载完成后安装并重启;
 *   - 检查前先并行探测各更新通道可达性(GitHub 主源 + 国内镜像源),按优先级选源;失败自动换源重试(最多 2 轮);
 *   - 把状态机与下载进度广播给渲染进程(update:state 通道),前端据此展示进度、更新源与确认弹窗;
 *   - 把 electron-updater 的英文原始错误分类为中文提示(见 updateChannels.classifyError);
 *   - 开发模式(未打包)直接返回不可用,避免 electron-updater 因缺少 app-update.yml 报错。
 *
 * 状态机:idle → checking → available → downloading → downloaded → installing
 * 任一环节出错 → error(携带中文 message)。
 *
 * 更新通道配置与探测见 ./updateChannels(镜像地址的唯一配置点也在那里)。
 * 更新源来自 package.json build.publish(GitHub provider:yconghua/grad-studio),
 * 打包时 electron-builder 会据此生成 resources/app-update.yml;
 * 安装器为 NSIS,静默安装时会从注册表恢复首次安装目录(含用户自定义目录),装完自动拉起新版本。
 */
const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')
const { probeChannels, classifyError, isAllowedExternalUrl } = require('./updateChannels')

// 当前更新状态快照:主进程维护,随事件变更后整体广播给渲染进程
const state = {
  status: 'idle', // idle | checking | available | downloading | downloaded | installing | error
  latest: '',
  progress: 0, // 0-100,保留一位小数
  message: '',
  speed: 0, // 下载速度 bytes/s(download-progress 实时值,非下载态为 0)
  eta: null, // 剩余秒数(按当前速度推算,速度未知时为 null)
  transferred: 0, // 已下载字节
  total: 0, // 总字节
  source: '' // 当前更新源名称(官方源/镜像源),供前端展示
}

let initialized = false
// 换源重试进行中:此时 autoUpdater 的 error 事件先记录、不广播,等整轮结束统一汇报
let fallbackInProgress = false
let lastSuppressedError = null
// 每个通道最多尝试的总轮数(探测一次 + 尝试一轮 = 一轮;网络抖动时给第二轮机会)
const MAX_ATTEMPT_ROUNDS = 2

// 把状态快照广播给当前窗口(单窗口应用,取第一个窗口)
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

// 初始化并注册事件监听(防重复注册)
function init() {
  if (initialized) return
  initialized = true
  // 发现新版本即自动下载;安装动作由用户在应用内确认后触发
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  // 检查事件:清空上一次下载的速度与进度,保留 message(source 切换提示)与 source(当前通道)不覆盖
  autoUpdater.on('checking-for-update', () =>
    setState({ status: 'checking', progress: 0, speed: 0, eta: null, transferred: 0, total: 0 })
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
  // 换源重试期间只记录,不打断 UI;重试结束后由 checkForUpdates 统一分类并广播一次
  autoUpdater.on('error', (err) => {
    lastSuppressedError = err
    if (fallbackInProgress) return
    const classified = classifyError(err)
    setState({ status: 'error', message: classified.message, speed: 0, eta: null })
  })
}

// 检查更新(自动下载:autoDownload=true 时,有新版会一路自动下载,Promise 在下载完成后 resolve)。
// 流程:并行探测各通道 → 按优先级依次尝试(失败换下一个源)→ 全失败再整体重试一轮 → 仍失败才报错。
async function checkForUpdates() {
  if (!app.isPackaged) {
    // 开发模式同样推进状态机,前端实时状态窗可正常展示失败原因
    setState({ status: 'error', message: '开发模式下不支持自动更新,请使用打包安装后的版本', speed: 0, eta: null })
    return { success: false, message: '开发模式下不支持自动更新,请使用打包安装后的版本' }
  }
  init()
  fallbackInProgress = true
  lastSuppressedError = null
  setState({
    status: 'checking',
    message: '',
    progress: 0,
    speed: 0,
    eta: null,
    transferred: 0,
    total: 0,
    source: ''
  })
  try {
    for (let round = 0; round < MAX_ATTEMPT_ROUNDS; round++) {
      // 每轮重新探测(网络可能恢复);并行探测,整体耗时≈单通道超时
      const { reachable } = await probeChannels()
      for (let i = 0; i < reachable.length; i++) {
        const channel = reachable[i]
        autoUpdater.setFeedURL(channel.feed)
        setState({
          status: 'checking',
          source: channel.label,
          message: i > 0 ? `主更新源不可用,已自动切换${channel.label}` : ''
        })
        try {
          const result = await autoUpdater.checkForUpdates()
          const info = result && result.updateInfo
          const latest = String((info && info.version) || '')
          const hasUpdate = Boolean(result && result.isUpdateAvailable)
          if (hasUpdate) setState({ status: 'downloaded', latest, source: channel.label })
          else setState({ status: 'idle', latest: '', source: channel.label })
          return { success: true, hasUpdate, current: app.getVersion(), latest, source: channel.label }
        } catch (err) {
          lastSuppressedError = err
          // 换下一个可达源,或进入下一轮重试
        }
      }
    }
    // 全部通道/全部轮次均失败:统一分类,广播一次错误状态
    const classified = classifyError(lastSuppressedError)
    const message = lastSuppressedError
      ? classified.message
      : '更新服务器均不可达,请检查网络后重试,或到下载页手动更新'
    setState({ status: 'error', message, speed: 0, eta: null })
    return { success: false, message: lastSuppressedError ? `检查更新失败:${classified.message}` : message }
  } finally {
    fallbackInProgress = false
  }
}

// 下载完成后静默安装并重启:
//   isSilent=true 走 NSIS 静默安装,无界面打扰,安装器自动恢复到首次安装目录;
//   isForceRunAfter=true 保证装完自动拉起新版本。
function quitAndInstall() {
  if (!app.isPackaged) return { success: false, message: '开发模式下不支持自动更新' }
  if (state.status !== 'downloaded') {
    return { success: false, message: '更新尚未下载完成,无法安装' }
  }
  setState({ status: 'installing' })
  // 延迟一拍再退出安装,确保 IPC 响应与状态广播先送达渲染进程
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 300)
  return { success: true, message: '正在重启并安装更新…' }
}

module.exports = { checkForUpdates, quitAndInstall, isAllowedExternalUrl }
