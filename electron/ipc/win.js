/**
 * 窗口控制路由（win:*）
 *
 * 无边框窗口的标题栏按钮（最小化 / 关闭）通过本模块操作主窗口。
 * 关闭走 BrowserWindow.close()，会触发 main.js 中注册的 close 事件：
 *   登录页（#/login）直接放行退出应用；登录后隐藏到系统托盘驻留。
 */
const { BrowserWindow } = require('electron')

function register(ipc) {
  // 最小化窗口
  ipc.handle('win:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
    return { success: true }
  })

  // 关闭窗口（实际行为由 main.js 的 close 事件决定：登录页退出 / 登录后隐藏到托盘）
  ipc.handle('win:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
    return { success: true }
  })
}

module.exports = { register }
