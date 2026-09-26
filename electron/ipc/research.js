/**
 * 路由层（IPC Layer）—— 科研管理相关路由（research:* 前缀）
 *
 * 只做转发：把渲染层发来的 research:* 调用转交给 researchService，
 * 不写 SQL、不做业务；标准 CRUD 用 crudRouter.registerCrud 一行注册。
 */
const researchService = require('../services/researchService')
const { registerCrud, handle } = require('./crudRouter')

function register(ipcMain) {
  registerCrud(ipcMain, 'research:project', researchService.project)
  registerCrud(ipcMain, 'research:paper', researchService.paper)
  registerCrud(ipcMain, 'research:patent', researchService.patent)
  registerCrud(ipcMain, 'research:log', researchService.researchLog)
  registerCrud(ipcMain, 'research:achievement', researchService.achievement)
  registerCrud(ipcMain, 'research:fund', researchService.fundRecord)
  registerCrud(ipcMain, 'research:milestone', researchService.graduationMilestone)

  // 毕业进度总览（仪表盘数据源）
  handle(ipcMain, 'research:milestone-overview', () => researchService.graduationOverview())
}

module.exports = { register }
