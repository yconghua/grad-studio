/**
 * 开机自动启动（Service Layer）—— 基于 Electron 系统级能力
 *
 * 覆盖：
 *   - 查询当前自启状态（app.getLoginItemSettings）；
 *   - 设置 / 关闭自启（app.setLoginItemSettings，Windows 下对打包安装版生效）。
 * 状态由操作系统保存，天然跨重启持久；不写入 localStorage，清除缓存不影响。
 * 开发模式（npm run dev）下 exe 指向 electron.exe，自启不真正生效，仅返回状态供提示。
 */
const { app } = require('electron')

function getStatus() {
  const s = app.getLoginItemSettings()
  return { enabled: !!(s && s.openAtLogin), packaged: app.isPackaged }
}

function setEnabled(enabled) {
  app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath })
  return getStatus()
}

module.exports = { getStatus, setEnabled }
