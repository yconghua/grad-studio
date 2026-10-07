/**
 * 学业档案导出 Word 转换（academicToDocx）—— 纯函数模块，供 ipc/academic.js 调用
 *
 * 结构：标题（学生姓名 · 学业档案）→ 元信息（培养类型 / 所属课题组 / 导出时间）
 * → 各阶段节点（按模板顺序）：节点名 + 状态，计划/发生/结束时间、内容、退回意见。
 * 复用项目已装的 docx 依赖，不依赖 Markdown（content 为纯文本段落）。
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} = require('docx')

const STAGE_TYPE_LABELS = { master: '硕士', doctor: '博士', bachelor: '本科' }

const STATUS_LABELS = {
  pending: '待填写',
  submitted: '已提交待确认',
  confirmed: '已确认'
}

function fmt(v) {
  if (v == null || v === '') return '-'
  return String(v)
}

// 元信息行（灰色小字）
function metaLine(text) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, color: '888888', size: 18 })]
  })
}

// 节点正文段落
function infoLine(label, value) {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 240 },
    children: [new TextRun({ text: `${label}：`, bold: true }), new TextRun({ text: fmt(value) })]
  })
}

/**
 * 构建学业档案 Word 文档 buffer
 * @param {Object} param
 * @param {Object} param.user 学生用户行（含 real_name / username / user_no / degree / group_name）
 * @param {string} param.stageType 培养类型 master/doctor/bachelor
 * @param {string} param.groupName 所属课题组名称
 * @param {Array} param.nodes 时间线节点（含模板字段 + record 记录）
 * @returns {Promise<Buffer>} .docx 文件内容
 */
async function buildAcademicDocx({ user, stageType, groupName, nodes }) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: `${user.real_name || user.username} · 学业档案` })]
    }),
    metaLine(`学号/工号：${fmt(user.user_no)}　培养类型：${STAGE_TYPE_LABELS[stageType] || stageType}　课题组：${fmt(groupName)}`),
    metaLine(`导出时间：${new Date().toLocaleString('zh-CN')}`),
    new Paragraph({ spacing: { after: 120 }, children: [] })
  ]

  for (const node of nodes || []) {
    const rec = node.record
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({ text: `${node.nodeName}` }),
          new TextRun({ text: `　（${STATUS_LABELS[rec ? rec.status : 'pending'] || '待填写'}）`, color: '888888', size: 20 })
        ]
      })
    )
    children.push(infoLine('计划时间', node.planDate))
    children.push(infoLine('发生时间', rec && rec.happen_date))
    children.push(infoLine('结束时间', rec && rec.end_date))
    children.push(infoLine('内容', rec && rec.content))
    if (rec && rec.reject_reason) children.push(infoLine('退回意见', rec.reject_reason))
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

module.exports = { buildAcademicDocx }
