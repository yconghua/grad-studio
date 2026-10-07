// 学生科研成果模块接口（achievement:*）
// 分页列表（每页 8 条，与其他列表统一）：范围由登录角色 + groupId 决定
export function getAchievementStats({ groupId, type, status, keyword, page, sortField, sortOrder } = {}) {
  return window.api.achievement.stats({
    groupId: groupId || null,
    type: type || '',
    status: status || '',
    keyword: keyword || '',
    page: page || 1,
    sortField: sortField || '',
    sortOrder: sortOrder || ''
  })
}
// 统计摘要（顶部统计卡：总数 / 待确认 / 已确认 / 按类型分布）
export function getAchievementStatsSummary({ groupId, type, status, keyword } = {}) {
  return window.api.achievement.statsSummary({ groupId: groupId || null, type: type || '', status: status || '', keyword: keyword || '' })
}
export function saveAchievement(payload) {
  return window.api.achievement.save(payload)
}
export function submitAchievement(id) {
  return window.api.achievement.submit({ id })
}
export function confirmAchievement(id) {
  return window.api.achievement.confirm({ id })
}
export function returnAchievement(id, reason) {
  return window.api.achievement.return({ id, reason })
}
export function batchConfirmAchievement(userId, ids) {
  return window.api.achievement.batchConfirm({ userId, ids })
}
export function batchConfirmAllAchievement() {
  return window.api.achievement.batchConfirmAll()
}
export function removeAchievement(id) {
  return window.api.achievement.remove({ id })
}
export function exportAchievementDocx(userId) {
  return window.api.achievement.exportDocx(userId ? { userId } : {})
}
export function exportAchievementXlsx({ groupId, type, status, keyword } = {}) {
  return window.api.achievement.exportXlsx({ groupId: groupId || null, type: type || '', status: status || '', keyword: keyword || '' })
}
// ===== 附件（LONGBLOB 入库，与周报附件同模式） =====
export function uploadAchievementAttachment({ achievementId, fileName, mimeType, data }) {
  return window.api.achievement.attachmentUpload({ achievementId, fileName, mimeType, data })
}
export function listAchievementAttachments(achievementId) {
  return window.api.achievement.attachmentList({ achievementId })
}
export function removeAchievementAttachment(id) {
  return window.api.achievement.attachmentRemove({ id })
}
export function downloadAchievementAttachment(id) {
  return window.api.achievement.attachmentDownload({ id })
}
// ===== 时间进度（节点模板 + 节点时间记录） =====
export function listAchievementStageTemplates(type) {
  return window.api.achievement.stageTemplates({ type })
}
export function saveAchievementStageTemplate(payload) {
  return window.api.achievement.stageTemplateSave(payload)
}
export function toggleAchievementStageTemplate(id, enabled) {
  return window.api.achievement.stageTemplateToggle({ id, enabled })
}
export function removeAchievementStageTemplate(id) {
  return window.api.achievement.stageTemplateRemove({ id })
}
export function getAchievementStageRecords(achievementId) {
  return window.api.achievement.stageRecords({ achievementId })
}
export function saveAchievementStageRecord(payload) {
  return window.api.achievement.stageRecordSave(payload)
}
export function submitAchievementStageRecord(recordId) {
  return window.api.achievement.stageRecordSubmit({ recordId })
}
export function reviewAchievementStageRecord({ recordId, action, reason }) {
  return window.api.achievement.stageRecordReview({ recordId, action, reason })
}
