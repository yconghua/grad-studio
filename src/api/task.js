// 任务模块接口（task:* / task-overview:*）
export function createTask(data = {}) {
  return window.api.task.create(data)
}
export function listTasks(params = {}) {
  return window.api.task.list(params)
}
export function getTaskDetail(id) {
  return window.api.task.detail({ id })
}
export function updateTask(id, data = {}) {
  return window.api.task.update({ id, data })
}
export function deleteTask(id) {
  return window.api.task.remove({ id })
}
export function restoreTask(id) {
  return window.api.task.restore({ id })
}
export function addTaskParticipants(id, participantIds = []) {
  return window.api.task.addParticipants({ id, data: { participantIds } })
}
export function removeTaskParticipant(id, userId) {
  return window.api.task.removeParticipant({ id, data: { userId } })
}
export function getTaskParticipantOptions() {
  return window.api.task.participantOptions()
}
export function submitTaskProgress(id, progress, note = '') {
  return window.api.task.submitProgress({ id, data: { progress, note } })
}
export function completeTask(id) {
  return window.api.task.complete({ id })
}
export function verifyTask(id, pass, note = '') {
  return window.api.task.verify({ id, data: { pass, note } })
}
export function cancelTask(id) {
  return window.api.task.cancel({ id })
}
export function reopenTask(id) {
  return window.api.task.reopen({ id })
}
export function listTaskDynamics(id, page = 1) {
  return window.api.task.dynamics({ id, page })
}
export function getTaskStats() {
  return window.api.task.stats()
}
export function getTaskSummary() {
  return window.api.task.summary()
}

// 超管任务总览
export function getTaskOverviewList(params = {}) {
  return window.api.taskOverview.list(params)
}
export function getTaskOverviewDetail(id) {
  return window.api.taskOverview.detail({ id })
}
export function getTaskOverviewStats() {
  return window.api.taskOverview.stats()
}
