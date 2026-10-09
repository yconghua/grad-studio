// 个人待办模块接口（todo:*）：学生/导师个人轻量待办
// 我的待办分页列表（学生/导师只看自己的）
export function getMyTodos({ status, priority, sourceType, keyword, page, sortField, sortOrder } = {}) {
  return window.api.todo.listMine({
    status: status || '',
    priority: priority || '',
    sourceType: sourceType || '',
    keyword: keyword || '',
    page: page || 1,
    sortField: sortField || '',
    sortOrder: sortOrder || ''
  })
}
// 我的待办统计（总数 / 未完成 / 已完成 / 逾期）
export function getMyTodoSummary() {
  return window.api.todo.summaryMine()
}
// 日历取数：某时间范围内我的待办（start/end 为 YYYY-MM-DD 00:00:00 / 次日）
export function getMyTodoCalendar(start, end) {
  return window.api.todo.calendarMine({ start, end })
}
// 新建/编辑待办（仅本人；已完成不可编辑）
export function saveTodo(payload) {
  return window.api.todo.save(payload)
}
// 来源判重（转换弹窗打开时探测，不创建）：返回 { already, id, todo }
export function checkTodoSource(sourceType, sourceId) {
  return window.api.todo.checkSource({ sourceType, sourceId })
}
// 来源转待办：校验可见性 + 判重 + 预填创建（已转过则返回 { already, id, todo }）
export function createTodoFromSource(payload) {
  return window.api.todo.createFromSource(payload)
}
// 完成 / 取消完成（仅本人）
export function toggleTodoDone(id) {
  return window.api.todo.toggleDone({ id })
}
// 删除待办（仅本人）：软删
export function removeTodo(id) {
  return window.api.todo.remove({ id })
}
// ===== 超管 / 组管只读总览 =====
// 总览分页列表：超管=全平台或按组；组管=本组；只读
export function getTodoOverview({ groupId, ownerId, status, priority, sourceType, keyword, dueFrom, dueTo, page, sortField, sortOrder } = {}) {
  return window.api.todo.overview({
    groupId: groupId || null,
    ownerId: ownerId || null,
    status: status || '',
    priority: priority || '',
    sourceType: sourceType || '',
    keyword: keyword || '',
    dueFrom: dueFrom || '',
    dueTo: dueTo || '',
    page: page || 1,
    sortField: sortField || '',
    sortOrder: sortOrder || ''
  })
}
// 总览统计卡（总数 / 未完成 / 已完成 / 逾期）
export function getTodoOverviewSummary({ groupId } = {}) {
  return window.api.todo.overviewSummary({ groupId: groupId || null })
}
