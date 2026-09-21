/**
 * 科研管理模块仓库（Repository Layer）—— 对应科研管理导航下 6 张业务表
 *
 * 每张表通过 crudFactory 生成带「字段白名单」的通用 CRUD 实例：
 *   - writable 白名单只放可写字段，id / created_at / updated_at（数据库自动维护）不在此列，
 *     前端夹带的越权列名会被自动丢弃，杜绝注入与越权写；
 *   - created_by / author_id 等「谁创建 / 谁所属」字段由 Service 层用当前登录用户回填，前端不可伪造。
 *
 * 说明：论文 / 专利 / 成果登记三张表独立存在（字段差异大），
 * 课题申报与科研项目共用 project 表（type 字段区分），不重复建表。
 */
const { createCrudRepo } = require('./crudFactory')

// 项目 / 课题（type：project 科研项目 / subject 课题申报）
const projectRepo = createCrudRepo('project', {
  writable: [
    'name', 'code', 'type', 'status', 'level', 'source', 'budget',
    'leader_id', 'description', 'start_date', 'end_date', 'created_by'
  ]
})

// 论文著作
const paperRepo = createCrudRepo('paper', {
  writable: [
    'title', 'authors', 'first_author_id', 'corresponding_id', 'journal',
    'volume', 'pages', 'doi', 'index_type', 'status', 'publish_date',
    'project_id', 'attachment', 'description', 'created_by'
  ]
})

// 专利软著
const patentRepo = createCrudRepo('patent', {
  writable: [
    'title', 'type', 'patent_no', 'application_no', 'inventors', 'owner_id',
    'applicant', 'status', 'apply_date', 'grant_date', 'project_id',
    'attachment', 'description', 'created_by'
  ]
})

// 科研日志
const researchLogRepo = createCrudRepo('research_log', {
  writable: ['title', 'content', 'project_id', 'author_id', 'log_date', 'attachment']
})

// 成果登记
const achievementRepo = createCrudRepo('achievement', {
  writable: [
    'title', 'type', 'level', 'authors', 'owner_id', 'project_id',
    'achieve_date', 'source', 'attachment', 'description', 'created_by'
  ]
})

// 经费流水
const fundRecordRepo = createCrudRepo('fund_record', {
  writable: [
    'project_id', 'type', 'amount', 'category', 'title', 'record_date',
    'handler_id', 'remark', 'created_by'
  ]
})

// 毕业里程碑
const graduationMilestoneRepo = createCrudRepo('graduation_milestone', {
  writable: [
    'user_id', 'type', 'deadline', 'materials', 'status',
    'completed_at', 'remark'
  ]
})

module.exports = {
  projectRepo,
  paperRepo,
  patentRepo,
  researchLogRepo,
  achievementRepo,
  fundRecordRepo,
  graduationMilestoneRepo
}
