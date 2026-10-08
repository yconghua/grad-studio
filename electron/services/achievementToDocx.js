/**
 * 科研成果导出 Word 转换（achievementToDocx）—— 纯函数模块，供 ipc/achievement.js 调用
 *
 * 结构：标题（学生姓名 · 科研成果）→ 元信息（学号 / 所属课题组 / 导出时间）
 * → 各条成果：名称 + 类型/状态，载体、级别、作者、日期、说明、退回意见。
 * 复用项目已装的 docx 依赖。
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} = require('docx')

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

// 成果正文段落
function infoLine(label, value) {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 240 },
    children: [new TextRun({ text: `${label}：`, bold: true }), new TextRun({ text: fmt(value) })]
  })
}

/**
 * 构建科研成果 Word 文档 buffer
 * @param {Object} param
 * @param {Object} param.user 学生用户行（含 real_name / username / user_no / group_name）
 * @param {string} param.groupName 所属课题组名称
 * @param {Array} param.list 成果 DTO 列表（toDto 输出，含 typeLabel/status/rejectReason/timeline）
 * @returns {Promise<Buffer>} .docx 文件内容
 */
async function buildAchievementDocx({ user, groupName, list }) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: `${user.real_name || user.username} · 科研成果` })]
    }),
    metaLine(`学号/工号：${fmt(user.user_no)}　课题组：${fmt(groupName || user.group_name)}`),
    metaLine(`导出时间：${new Date().toLocaleString('zh-CN')}`),
    new Paragraph({ spacing: { after: 120 }, children: [] })
  ]

  for (const item of list || []) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({ text: `${item.title}` }),
          new TextRun({ text: `　（${item.typeLabel} / ${STATUS_LABELS[item.status] || item.status}）`, color: '888888', size: 20 })
        ]
      })
    )
    children.push(infoLine('发表载体', item.venue))
    children.push(infoLine('级别', item.level))
    children.push(infoLine('作者', item.isFirst ? `${item.authors || '-'}（第一作者/第一完成人）` : item.authors))
    children.push(infoLine('发表/授权日期', item.publishDate))
    // 时间进度节点：已填写的节点按模板顺序列出（未填不显示）
    const filled = (item.timeline || []).filter((t) => t.record && t.record.happenDate)
    if (filled.length) {
      children.push(new Paragraph({ spacing: { before: 60, after: 40 }, indent: { left: 240 }, children: [new TextRun({ text: '时间进度：', bold: true })] }))
      for (const t of filled) {
        children.push(infoLine(t.nodeName, t.record.happenDate))
      }
    }
    children.push(infoLine('说明', item.description))
    if (item.rejectReason) children.push(infoLine('退回意见', item.rejectReason))
  }

  if (!list || !list.length) {
    children.push(new Paragraph({ text: '暂无科研成果记录', spacing: { before: 60 } }))
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

module.exports = { buildAchievementDocx }
