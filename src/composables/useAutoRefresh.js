// 页面数据无感刷新（AutoRefresh）
//
// 用法：页面在 script setup 里调用 useAutoRefresh(loadFn)；
// 收到「写后广播（data:changed）」或「主进程版本轮询（db:changed）」时，
// 防抖合并后后台静默调用 loadFn 重拉本页数据 —— 页面不跳转、状态不丢。
// 组件卸载时自动退订两个监听，避免泄漏。
import { onMounted, onUnmounted } from 'vue'

// 防抖窗口（毫秒）：合并短时间内多次触发
const DEFAULT_DEBOUNCE_MS = 800

export function useAutoRefresh(loadFn, debounceMs = DEFAULT_DEBOUNCE_MS) {
  // 每个实例独立防抖定时器与退订函数
  let timer = null
  let unsubDb = null

  // 防抖后触发重拉（后台静默）
  function scheduleReload() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (typeof loadFn === 'function') loadFn()
    }, debounceMs)
  }

  function onDataChanged() {
    scheduleReload()
  }

  onMounted(() => {
    window.addEventListener('data:changed', onDataChanged)
    if (window.api && window.api.sys && typeof window.api.sys.onDbChanged === 'function') {
      unsubDb = window.api.sys.onDbChanged(onDataChanged)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('data:changed', onDataChanged)
    if (timer) clearTimeout(timer)
    if (unsubDb) unsubDb()
    unsubDb = null
  })
}
