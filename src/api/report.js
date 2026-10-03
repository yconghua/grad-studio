// 周报模块接口（report:*）
export function reportMyWeek() {
  return window.api.report.myWeek()
}
export function reportCreate(weekKey) {
  return window.api.report.create({ weekKey })
}
export function reportSaveDraft(id, data = {}) {
  return window.api.report.saveDraft({ id, data })
}
export function reportSubmit(id, data = {}) {
  return window.api.report.submit({ id, data })
}
export function reportWithdrawSubmit(id, data = {}) {
  return window.api.report.withdrawSubmit({ id, data })
}
export function reportListMine(page = 1) {
  return window.api.report.listMine({ page })
}
export function reportListToReview(page = 1) {
  return window.api.report.listToReview({ page })
}
export function reportReview(id, data = {}) {
  return window.api.report.review({ id, data })
}
export function reportUnreview(id, data = {}) {
  return window.api.report.unreview({ id, data })
}
export function reportGet(id) {
  return window.api.report.get({ id })
}
export function reportListGroup(params = {}) {
  return window.api.report.listGroup(params)
}
export function reportAddAttachment({ reportId, fileName, mimeType, data }) {
  return window.api.report.addAttachment({ reportId, fileName, mimeType, data })
}
export function reportListAttachments(reportId) {
  return window.api.report.listAttachments({ reportId })
}
export function reportDeleteAttachment(id) {
  return window.api.report.deleteAttachment({ id })
}
export function reportDownloadAttachment(id) {
  return window.api.report.downloadAttachment({ id })
}
export function reportAttachmentQuota() {
  return window.api.report.attachmentQuota()
}
export function reportListTemplates() {
  return window.api.report.listTemplates()
}
export function reportSaveTemplate(data = {}) {
  return window.api.report.saveTemplate(data)
}
export function reportListHolidays() {
  return window.api.report.listHolidays()
}
export function reportUpsertHoliday(data = {}) {
  return window.api.report.upsertHoliday(data)
}
export function reportRemoveHoliday(weekKey) {
  return window.api.report.removeHoliday({ weekKey })
}
export function reportStats(params = {}) {
  return window.api.report.stats(params)
}
export function reportRemind(params = {}) {
  return window.api.report.remind(params)
}
export function reportPurge(id, reason) {
  return window.api.report.purge({ id, reason })
}
export function reportListMeta(params = {}) {
  return window.api.report.listMeta(params)
}
