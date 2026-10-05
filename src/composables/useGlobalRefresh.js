// 数据写操作成功后的无感刷新
//
// 写操作成功后调用 refreshAfterWrite：
// 弹出非阻塞 toast 提示，并广播 data:changed 事件；所有在线页面（含本页）监听到后
// 后台静默重拉自己的数据，不再整页 reload —— 页面不跳转、不闪白，
// 筛选 / 分页 / 排序 / 弹窗状态全部保留。
// 兜底：主进程 dataVersionService 每 15 秒比对业务表指纹，变化时广播 db:changed，
// 保证外部改动（其他窗口 / 直接改库）也能被页面无感同步。
import { showToast } from './useToast'

// 广播全局数据变更事件（各页面 useAutoRefresh 监听）
export function emitDataChanged() {
  window.dispatchEvent(new CustomEvent('data:changed'))
}

export async function refreshAfterWrite(message = '操作成功') {
  showToast(message)
  emitDataChanged()
}
