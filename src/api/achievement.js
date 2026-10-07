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
