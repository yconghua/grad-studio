// 学生学业记录档案模块接口（academic:*）
export function getAcademicRecords(userId) {
  return window.api.academic.records(userId ? { userId } : {})
}
export function saveAcademicRecord(payload) {
  return window.api.academic.saveRecord(payload)
}
export function submitAcademicRecord(id) {
  return window.api.academic.submitRecord({ id })
}
export function confirmAcademicRecord(id) {
  return window.api.academic.confirmRecord({ id })
}
export function returnAcademicRecord(id, reason) {
  return window.api.academic.returnRecord({ id, reason })
}
export function batchConfirmAcademic(userId, nodeKeys) {
  return window.api.academic.batchConfirm({ userId, nodeKeys })
}
export function getAcademicTemplates(stageType) {
  return window.api.academic.templates({ stageType })
}
export function saveAcademicTemplate(payload) {
  return window.api.academic.templateSave(payload)
}
export function toggleAcademicTemplate(id, enabled) {
  return window.api.academic.templateToggle({ id, enabled })
}
export function removeAcademicTemplate(id) {
  return window.api.academic.templateRemove({ id })
}
// 学生分页列表（每页 8 条，与其他列表统一）：group 为空 = 全部课题组；支持 keyword/degree 筛选
export function getAcademicStats(groupId, page, sortField, sortOrder, keyword, degree) {
  return window.api.academic.stats({
    groupId: groupId || null,
    page: page || 1,
    sortField: sortField || '',
    sortOrder: sortOrder || '',
    keyword: keyword || '',
    degree: degree || ''
  })
}
// 统计摘要（顶部统计卡：范围学生数 / 平均完成率 / 逾期节点总数）；与列表同一筛选口径
export function getAcademicStatsSummary(groupId, keyword, degree) {
  const payload = {}
  if (groupId) payload.groupId = groupId
  if (keyword) payload.keyword = keyword
  if (degree) payload.degree = degree
  return window.api.academic.statsSummary(payload)
}
export function exportAcademic(userId) {
  return window.api.academic.export(userId ? { userId } : {})
}
export function exportAllAcademic(groupId) {
  return window.api.academic.exportAll(groupId ? { groupId } : {})
}
