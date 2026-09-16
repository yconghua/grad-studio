/**
 * 资源中心服务（Service Layer）—— 统一资源（文档/数据集/代码/工具/模板/网盘）+ 常用链接
 *
 * resource 表按 category 区分六类资源，前端各页面传 category 过滤；
 * 上传人 uploader_id 由后端回填，下载量用原子自增。
 */
const { resourceRepo, linkRepo } = require('../db/repositories/resourceRepository')
const { createCrudService } = require('./crudService')
const permission = require('./permission')

const resourceService = {
  // 统一资源：成员可上传（上传人回填当前用户）
  resource: createCrudService(resourceRepo, { label: '资源', write: 'member', creatorField: 'uploader_id' }),
  // 常用链接：成员可添加
  link: createCrudService(linkRepo, { label: '链接', write: 'member', creatorField: 'creator_id' }),

  /**
   * 资源下载计数（原子自增）。
   * @param {number} id 资源 id
   */
  async download(id) {
    if (!permission.isLoggedIn()) return { success: false, message: '未登录，请重新登录' }
    if (id === null || id === undefined) return { success: false, message: '缺少资源标识' }
    try {
      const exist = await resourceRepo.get(id)
      if (!exist) return { success: false, message: '资源不存在' }
      await resourceRepo.increment(id, 'download_count', 1)
      return { success: true }
    } catch (err) {
      console.error('[resource.download] 数据库异常:', err)
      return { success: false, message: '下载计数失败' }
    }
  }
}

module.exports = resourceService
