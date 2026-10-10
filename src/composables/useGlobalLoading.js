/**
 * 全局加载状态（组合式函数）—— 全屏"数据加载中"遮罩的开关
 *
 * 引用计数语义：begin() +1、finish() −1、归零才隐藏，兼容页面并行发起多个数据请求；
 * 只在本页/本流程主动 begin 过的场景生效，其余页面误调 finish 不会产生副作用。
 * 模块级单例：多个组件共享同一份状态（遮罩组件读取、业务流程写入）。
 */
import { ref } from 'vue'

const isLoading = ref(false)
let count = 0

function begin() {
  count += 1
  isLoading.value = count > 0
}

function finish() {
  count = Math.max(0, count - 1)
  isLoading.value = count > 0
}

// 强制清零（超时兜底：某接口失败时避免遮罩永久卡死）
function reset() {
  count = 0
  isLoading.value = false
}

export function useGlobalLoading() {
  return { isLoading, begin, finish, reset }
}
