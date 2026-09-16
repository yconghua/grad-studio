/**
 * 资源中心模块仓库（Repository Layer）—— 对应资源中心导航下 2 张业务表
 *
 * resource 表承载文档 / 数据集 / 代码 / 工具 / 模板 / 网盘六类资源（category 区分），
 * link 表承载常用链接。安全约定见 crudFactory。
 */
const { createCrudRepo } = require('./crudFactory')

// 统一资源（六类合一，category 区分）
const resourceRepo = createCrudRepo('resource', {
  writable: [
    'title', 'category', 'description', 'file_path', 'url', 'tags',
    'project_id', 'uploader_id', 'download_count'
  ]
})

// 常用链接
const linkRepo = createCrudRepo('link', {
  writable: ['title', 'url', 'category', 'description', 'creator_id']
})

module.exports = { resourceRepo, linkRepo }
