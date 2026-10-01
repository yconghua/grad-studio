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
