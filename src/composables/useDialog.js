// 全局代码内弹窗（替代 window.alert / window.confirm / window.prompt）
//
// 设计：模块级单例 reactive 状态 + 三个返回 Promise 的方法。
//   - dialogAlert(message, title)    → Promise<true>       提示（单按钮「确定」）
//   - dialogConfirm(message, title)  → Promise<boolean>     确认（取消=false / 确定=true）
//   - dialogPrompt(message, def, title) → Promise<string|null> 输入（取消=null / 确定=输入值）
//
// 任意组件 import 后调用，由全局唯一的 <AppDialog />（挂载于 App.vue）负责渲染。
// 相比 Electron 系统弹窗：样式可控、不阻塞渲染进程、可统一换肤。
import { reactive } from 'vue'

// 弹窗状态（单例，AppDialog 读取它渲染；resolve 存回调，关闭时调用）
export const dialogState = reactive({
  visible: false,
  type: 'alert', // 'alert' | 'confirm' | 'prompt'
  title: '提示',
  message: '',
  inputValue: '',
  placeholder: '',
  resolve: null
})

// 打开弹窗并返回 Promise：关闭时以结果 resolve
function open({ type, title, message, inputValue, placeholder }) {
  return new Promise((resolve) => {
    dialogState.type = type
    dialogState.title = title || '提示'
    dialogState.message = message || ''
    dialogState.inputValue = inputValue ?? ''
    dialogState.placeholder = placeholder || ''
    dialogState.resolve = resolve
    dialogState.visible = true
  })
}

// 提示弹窗（单按钮）
export function dialogAlert(message, title = '提示') {
  return open({ type: 'alert', title, message })
}

// 确认弹窗（确定/取消），resolve true/false
export function dialogConfirm(message, title = '确认操作') {
  return open({ type: 'confirm', title, message })
}

// 输入弹窗（确定/取消），resolve 输入值 / null
export function dialogPrompt(message, defaultValue = '', title = '请输入') {
  return open({ type: 'prompt', title, message, inputValue: defaultValue })
}

// 关闭弹窗并 resolve（由 AppDialog 调用）
export function dialogClose(result) {
  if (!dialogState.visible) return
  dialogState.visible = false
  const r = dialogState.resolve
  dialogState.resolve = null
  if (r) r(result)
}
