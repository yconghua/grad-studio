// 学生私人笔记模块接口（note:*）
export function listNotes(params = {}) {
  return window.api.note.list(params)
}
export function getNote(id) {
  return window.api.note.get({ id })
}
export function createNote(data = {}) {
  return window.api.note.create(data)
}
export function updateNote(id, data = {}) {
  return window.api.note.update({ id, data })
}
export function deleteNote(id) {
  return window.api.note.remove({ id })
}
export function restoreNote(id) {
  return window.api.note.restore({ id })
}
export function purgeNote(id) {
  return window.api.note.purge({ id })
}
export function exportNote(id) {
  return window.api.note.export({ id })
}
