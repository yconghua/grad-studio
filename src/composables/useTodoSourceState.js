// 来源转待办状态（组合式函数）
//
// 用途：任务 / 组会 / 周报 / 公告 详情页的「转为待办」入口需要区分三种状态，
// 避免用户点击后才被后端拒绝：
//   none      —— 未转换，按钮可用
//   converted —— 已转换且待办存在，点击会跳转到该待办
//   deleted   —— 已转换但待办已被删除，来源被唯一约束锁定，按钮禁用
//
// 调用时机：详情打开 / 切换当前周报时 refresh 一次；
// 转换成功后 markConverted，避免再次探测。
import { ref } from 'vue'
import { checkTodoSource } from '../api/todo'

export function useTodoSourceState() {
  const state = ref('none')
  const todoId = ref(null)
  // 请求序号：快速切换详情时丢弃过期响应，避免状态串台
  let seq = 0

  // 探测当前来源的转换状态；接口异常按未转换处理（创建时后端仍会兜底）
  async function refresh(sourceType, sourceId) {
    const mySeq = ++seq
    state.value = 'none'
    todoId.value = null
    if (!sourceType || sourceId == null) return
    try {
      const res = await checkTodoSource(sourceType, sourceId)
      if (mySeq !== seq) return
      if (res && res.success && res.data && res.data.already) {
        state.value = res.data.deleted ? 'deleted' : 'converted'
        todoId.value = Number(res.data.id) || null
      }
    } catch (e) {
      if (mySeq !== seq) return
      state.value = 'none'
    }
  }

  // 转换成功后本地置为已转换，省一次探测
  function markConverted(id) {
    state.value = 'converted'
    todoId.value = Number(id) || null
  }

  return { state, todoId, refresh, markConverted }
}
