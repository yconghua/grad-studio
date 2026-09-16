/**
 * IPC 路由注册辅助（IPC Layer 共用）
 *
 * 把「单个通道注册 + 统一异常兜底」与「标准 CRUD 五件套注册」抽成两个函数，
 * 各模块路由文件（research / studio / ...）据此一行注册一个资源，避免手写大量重复 handler。
 *
 * 约定：
 *   - Service 层方法已自行 try-catch 并返回 { success, message }，本层兜底只拦截
 *     Service 未捕获的意外异常（如参数解构错误），保证渲染层永远拿到结构化结果；
 *   - 通道命名统一 `<模块>:<资源>:<动作>`，preload 用 createInvoke 固化同名通道。
 */
// 注册单个通道：包一层统一兜底，避免 Service 意外抛错导致 invoke 被 reject
function handle(ipcMain, channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await fn(payload)
    } catch (err) {
      console.error(`[${channel}] 未预期异常:`, err)
      return { success: false, message: '操作失败，请稍后重试' }
    }
  })
}

// 注册某资源的「标准 CRUD 五件套」：list / get / create / update / remove
function registerCrud(ipcMain, prefix, service) {
  handle(ipcMain, `${prefix}:list`, (p) => service.list(p || {}))
  handle(ipcMain, `${prefix}:get`, (p) => service.get(p && p.id))
  handle(ipcMain, `${prefix}:create`, (p) => service.create(p))
  handle(ipcMain, `${prefix}:update`, (p) => service.update(p && p.id, p))
  handle(ipcMain, `${prefix}:remove`, (p) => service.remove(p && p.id))
}

module.exports = { handle, registerCrud }
