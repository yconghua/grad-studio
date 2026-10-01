// 数据写操作成功后的全局刷新
//
// 页面在新增 / 修改 / 删除成功后调用 refreshAfterWrite：
// 先弹出操作结果提示，用户确认后重新加载整个应用（window.location.reload），
// 保证之后打开的任一页面都从数据库拉到最新数据，不做任何页面级缓存假设。
import { dialogAlert } from './useDialog'

export async function refreshAfterWrite(message = '操作成功') {
  await dialogAlert(message)
  window.location.reload()
}
