/**
 * 学业档案导出 Excel 转换（academicToXlsx）—— 纯函数模块，供 ipc/academic.js 调用
 *
 * 表头：序号 / 节点名称 / 是否必填 / 计划时间 / 发生时间 / 结束时间 / 状态 / 内容 / 退回意见；
 * 每个模板节点一行，与学生档案时间线页面保持一致。依赖 exceljs（package.json dependencies）。
 */
const ExcelJS = require('exceljs')

const STAGE_TYPE_LABELS = { master: '硕士', doctor: '博士', bachelor: '本科' }

const STATUS_LABELS = {
  pending: '待填写',
  submitted: '已提交待确认',
  confirmed: '已确认'
}

const HEADERS = ['序号', '节点名称', '是否必填', '计划时间', '发生时间', '结束时间', '状态', '内容', '退回意见']

function fmt(v) {
  if (v == null || v === '') return ''
  return String(v)
}

// 向工作表填充一个学生的档案：第 1 行信息（姓名/学号/培养类型/课题组/导出时间），
// 第 2 行表头，之后每个节点一行。供单学生导出与批量导出（每学生一个 sheet）复用。
function fillStudentSheet(ws, { user, stageType, groupName, nodes, exportTime }) {
  const info = `${fmt(user.real_name || user.username)}　学号/工号：${fmt(user.user_no)}　培养类型：${STAGE_TYPE_LABELS[stageType] || stageType}　所属课题组：${fmt(groupName)}　导出时间：${exportTime}`
  ws.mergeCells(1, 1, 1, HEADERS.length)
  ws.getCell(1, 1).value = info
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).height = 20

  ws.columns = HEADERS.map((h, i) => ({ header: h, width: i === 4 || i === 5 ? 14 : i === 7 ? 48 : i === 8 ? 24 : 14 }))
  ws.getRow(2).font = { bold: true }
  ws.getRow(2).height = 20

  ;(nodes || []).forEach((node, idx) => {
    const rec = node.record
    ws.addRow([
      idx + 1,
      node.nodeName,
      node.required ? '是' : '否',
      fmt(node.planDate),
      fmt(rec && rec.happenDate),
      fmt(rec && rec.endDate),
      STATUS_LABELS[rec ? rec.status : 'pending'] || '待填写',
      fmt(rec && rec.content),
      fmt(rec && rec.rejectReason)
    ])
  })

  // 内容/意见列自动换行；冻结表头（信息行 + 表头行共 2 行）
  ws.getColumn(8).alignment = { wrapText: true, vertical: 'top' }
  ws.getColumn(9).alignment = { wrapText: true, vertical: 'top' }
  ws.views = [{ state: 'frozen', ySplit: 2 }]
}

/**
 * 构建学业档案 Excel 文档 buffer（单学生）
 * @param {Object} param
 * @param {Object} param.user 学生用户行（含 real_name / username / user_no）
 * @param {string} param.stageType 培养类型 master/doctor/bachelor
 * @param {string} param.groupName 所属课题组名称
 * @param {Array} param.nodes 时间线节点（含模板字段 + record 记录）
 * @returns {Promise<Buffer>} .xlsx 文件内容
 */
async function buildAcademicXlsx({ user, stageType, groupName, nodes }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GradStudio'
  const ws = wb.addWorksheet('学业档案')
  fillStudentSheet(ws, {
    user,
    stageType,
    groupName,
    nodes,
    exportTime: new Date().toLocaleString('zh-CN')
  })
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

/**
 * 构建多学生学业档案 Excel 文档 buffer（一键导出全部）
 * @param {Array} students 学生档案数据列表（recordsOf 结果）
 * @returns {Promise<Buffer>} .xlsx 文件内容
 */
async function buildAcademicAllXlsx(students) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'GradStudio'
  const exportTime = new Date().toLocaleString('zh-CN')
  ;(students || []).forEach((data, idx) => {
    const name = (data.user && (data.user.realName || data.user.username)) || `学生${idx + 1}`
    // sheet 名不能重复：同名追加序号
    let sheetName = name
    let seq = 2
    while (wb.getWorksheet(sheetName)) {
      sheetName = `${name}(${seq})`
      seq++
    }
    const ws = wb.addWorksheet(sheetName)
    fillStudentSheet(ws, {
      user: data.user,
      stageType: data.stageType,
      groupName: data.groupName,
      nodes: data.nodes,
      exportTime
    })
  })
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

module.exports = { buildAcademicXlsx, buildAcademicAllXlsx }
