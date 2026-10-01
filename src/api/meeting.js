// 课题组组会接口（meeting:*）：列表 / 草稿 / 详情 / 创建 / 编辑 / 发布 / 发布为公告 / 删除 / 归档 / 统计 / 参与人候选
export function listMeetings(params = {}) {
  return window.api.meeting.list(params)
}
export function listMyDrafts(params = {}) {
  return window.api.meeting.myDrafts(params)
}
export function listGroupDrafts(params = {}) {
  return window.api.meeting.groupDrafts(params)
}
export function getMeetingDetail(id) {
  return window.api.meeting.detail({ id })
}
export function createMeeting(data = {}) {
  return window.api.meeting.create(data)
}
export function updateMeeting(id, data = {}) {
  return window.api.meeting.update({ id, data })
}
export function publishMeeting(id) {
  return window.api.meeting.publish({ id })
}
export function publishMeetingAsNotice(id) {
  return window.api.meeting.publishAsNotice({ id })
}
export function deleteMeeting(id) {
  return window.api.meeting.remove({ id })
}
export function toggleMeetingArchive(id) {
  return window.api.meeting.archive({ id })
}
export function getMeetingStats(groupId = '') {
  return window.api.meeting.stats({ groupId })
}
export function getMeetingMemberOptions(groupId) {
  return window.api.meeting.memberOptions({ groupId })
}
export function getRecentMeeting() {
  return window.api.meeting.recent()
}
