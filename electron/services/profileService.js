/**
 * 个人档案服务（Service Layer）—— 模块 profile
 *
 * 本人操作自己的档案：按 currentUserId 定位 user_profile.user_id，
 * 记录不存在时首次写入自动创建。
 */
const permission = require('./permission')
const userProfileRepository = require('../db/repositories/userProfileRepository')

// 读取当前登录用户自己的档案
async function get() {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const profile = await userProfileRepository.findByUserId(userId)
    return { success: true, profile: profile || null }
  } catch (err) {
    console.error('[profileService.get] 数据库异常:', err)
    return { success: false, message: '读取档案失败，请稍后重试' }
  }
}

// 更新当前登录用户自己的档案；不存在则创建
async function update(payload) {
  if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
  const userId = permission.currentUserId()
  try {
    const data = userProfileRepository.pick(payload || {})
    delete data.user_id // user_id 固定取当前登录用户，禁止前端伪造
    const exist = await userProfileRepository.findByUserId(userId)
    if (exist) {
      if (Object.keys(data).length) {
        await userProfileRepository.update(exist.id, data)
      }
      const updated = await userProfileRepository.findByUserId(userId)
      return { success: true, message: '档案已保存', profile: updated }
    }
    const id = await userProfileRepository.create({ user_id: userId, ...data })
    const created = await userProfileRepository.findById(id)
    return { success: true, message: '档案已创建', profile: created }
  } catch (err) {
    console.error('[profileService.update] 数据库异常:', err)
    return { success: false, message: '保存失败，请稍后重试' }
  }
}

module.exports = { get, update }
