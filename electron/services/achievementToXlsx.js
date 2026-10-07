/**
 * 科研成果导出 Excel 转换（achievementToXlsx）—— 纯函数模块，供 ipc/achievement.js 调用
 *
 * 依赖 exceljs（package.json dependencies）。表头：学号 / 姓名 / 类型 / 名称 / 载体 / 级别 /
 * 作者 / 第一作者 / 日期 / 状态 / 备注；管理端（导师 / 组管 / 超管）范围导出。
 */
const ExcelJS = require('exceljs')

const TYPE_LABELS = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }
const STATUS_LABELS = { pending: '待填写', submitted: '已提交待确认', confirmed: '已确认' }

const HEADERS = [
  '学号',
  '姓名',
  '成果类型',
  '成果名称',
  '发表载体',
  '级别',
  '作者',
  '第一作者/第一完成人',
  '发表/授权日期',
  '状态',
  '退回意见',
  '备注'
]

/**
 * 构建科研成果 Excel 文档 buffer
 * @param {Object} param
 * @param {string} param.label 范围名称（全部课题组 / 组名 / 名下学生）
 * @param {Array} param.list 成果 DTO 列表
 * @returns {Promise<Buffer>} .xlsx 文件内容
 */
async function buildAchievementXlsx({ label, list }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GradStudio'
  const ws = wb.addWorksheet('科研成果')

  ws.columns = HEADERS.map((h) => ({ header: h, width: 18 }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).height = 20

  for (const item of list || []) {
    ws.addRow([
      item.user ? item.user.userNo : '',
      item.user ? item.user.realName || item.user.username : '',
      item.typeLabel || TYPE_LABELS[item.type] || item.type,
      item.title,
      item.venue,
      item.level,
      item.authors,
      item.isFirst ? '是' : '否',
      item.publishDate,
      STATUS_LABELS[item.status] || item.status,
      item.rejectReason,
      item.description
    ])
  }

  // 内容超过一屏时冻结表头
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

module.exports = { buildAchievementXlsx }
