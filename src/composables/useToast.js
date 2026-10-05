// 全局轻量提示（Toast）——替代阻塞式 dialogAlert 的操作结果提示
//
// 设计：模块级单例 reactive 列表 + 定时自动移除。
// 任意组件 import 后调用 showToast(message)，由全局唯一的 <AppToast />（挂载于 App.vue）渲染。
// 相比 dialogAlert：非阻塞、3.2 秒自动消失、可同时存在多条；仅用于"操作成功"等轻提示。
import { reactive } from 'vue'

// toast 列表（单例；AppToast 读取渲染，定时器到期自动移除）
export const toastState = reactive({ list: [] })

let seq = 0

// 弹出提示，type: 'success' | 'error' | 'info'，默认 success
export function showToast(message, type = 'success') {
  const id = ++seq
  toastState.list.push({ id, message, type })
  setTimeout(() => {
    const idx = toastState.list.findIndex((t) => t.id === id)
    if (idx !== -1) toastState.list.splice(idx, 1)
  }, 3200)
}
