// 课题组成员相关接口：课题组管理员操作本组成员，以及导师查看自己名下学生
export function getOwnGroup() {
  return window.api.groupAdmin.getOwn()
}
export function updateOwnGroup(data = {}) {
  return window.api.groupAdmin.updateOwn({ data })
}
export function listMembers(params = {}) {
  return window.api.groupAdmin.membersList(params)
}
export function addMembers(data = {}) {
  return window.api.groupAdmin.membersAdd(data)
}
export function removeMember(userId) {
  return window.api.groupAdmin.memberRemove({ userId })
}
// 批量移除成员 / 批量指定导师（课题组管理员）
export function batchRemoveMembers(ids) {
  return window.api.groupAdmin.membersBatchRemove({ ids })
}
export function batchAssignMentor(ids, mentorId) {
  return window.api.groupAdmin.membersBatchAssignMentor({ ids, mentorId })
}
export function listGroupStudents(params = {}) {
  return window.api.groupAdmin.studentsList(params)
}
export function setStudentMentor(studentId, data = {}) {
  return window.api.groupAdmin.setStudentMentor({ studentId, data })
}
export function listMyStudents(params = {}) {
  return window.api.mentor.studentsList(params)
}

// 超级管理员：任意课题组详情页成员管理（group:*，groupId 必传）
export function superListMembers(params = {}) {
  return window.api.group.membersList(params)
}
export function superAddMembers(data = {}) {
  return window.api.group.membersAdd(data)
}
export function superRemoveMember(groupId, userId) {
  return window.api.group.memberRemove({ groupId, userId })
}
export function superBatchRemoveMembers(groupId, ids) {
  return window.api.group.membersBatchRemove({ groupId, ids })
}
export function superBatchAssignMentor(groupId, ids, mentorId) {
  return window.api.group.membersBatchAssignMentor({ groupId, ids, mentorId })
}
export function superSetStudentMentor(groupId, studentId, data = {}) {
  return window.api.group.setStudentMentor({ groupId, studentId, data })
}
export function superGetMemberStats(groupId) {
  return window.api.group.memberStats({ groupId })
}
