/**
 * 科研管理服务（Service Layer）—— 项目 / 论文 / 专利 / 科研日志 / 成果 / 经费
 *
 * 六类资源均为「标准 CRUD + 统一权限」，直接用 crudService 工厂生成：
 *   - 项目 / 经费：写操作仅导师 / 管理员（对应导航 roles 限制）；
 *   - 论文 / 专利 / 日志 / 成果：所有登录成员可登记（creatorField 由后端回填，防伪造）。
 * 上层（ipc/research.js）只调用这里暴露的方法。
 */
const {
  projectRepo,
  paperRepo,
  patentRepo,
  researchLogRepo,
  achievementRepo,
  fundRecordRepo
} = require('../db/repositories/researchRepository')
const { createCrudService } = require('./crudService')

module.exports = {
  // 项目 / 课题：管理类写操作（导师 / 管理员）
  project: createCrudService(projectRepo, { label: '项目', write: 'manager', creatorField: 'created_by' }),
  // 论文著作：成员可登记
  paper: createCrudService(paperRepo, { label: '论文', write: 'member', creatorField: 'created_by' }),
  // 专利软著：成员可登记
  patent: createCrudService(patentRepo, { label: '专利软著', write: 'member', creatorField: 'created_by' }),
  // 科研日志：成员可记，作者=当前用户
  researchLog: createCrudService(researchLogRepo, { label: '科研日志', write: 'member', creatorField: 'author_id' }),
  // 成果登记：成员可登记
  achievement: createCrudService(achievementRepo, { label: '成果', write: 'member', creatorField: 'created_by' }),
  // 经费流水：管理类写操作（导师 / 管理员）
  fundRecord: createCrudService(fundRecordRepo, { label: '经费', write: 'manager', creatorField: 'created_by' })
}
