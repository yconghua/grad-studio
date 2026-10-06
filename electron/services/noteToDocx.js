/**
 * 笔记导出 Word 转换（noteToDocx）—— 纯函数模块，供 ipc/note.js 调用
 *
 * 链路：remark-parse 将 Markdown 解析为标准 AST（mdast），再按节点类型
 * 映射为 docx 元素（Paragraph / TextRun / Table）。
 * 支持：标题、段落、有序/无序列表、粗体、斜体、删除线、行内代码、代码块、
 *       引用、分隔线、表格；图片降级为文字标注（保留内容，不嵌入图片）。
 * 注意：unified / remark-parse 均为 ESM-only 包，CommonJS 下用动态 import 惰性加载。
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType
} = require('docx')
const { NOTE_CATEGORIES } = require('../../shared/constants')

// ESM 依赖惰性加载（首次导出时初始化一次）
let unifiedFn = null
let remarkParseFn = null
async function ensureMarkdown() {
  if (unifiedFn && remarkParseFn) return
  const u = await import('unified')
  const r = await import('remark-parse')
  unifiedFn = u.unified || u.default
  remarkParseFn = r.default
}

const HEADING_LEVELS = [
  null,
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6
]

function categoryLabel(value) {
  const item = NOTE_CATEGORIES.find((c) => c.value === value)
  return item ? item.label : String(value)
}

// 行内节点 → 轻量 span 数组（合并嵌套样式），最后统一转 TextRun
function inlineSpans(nodes = [], base = {}) {
  const spans = []
  for (const n of nodes) {
    if (n.type === 'text') {
      if (n.value) spans.push({ ...base, text: n.value })
    } else if (n.type === 'strong') {
      spans.push(...inlineSpans(n.children, { ...base, bold: true }))
    } else if (n.type === 'emphasis') {
      spans.push(...inlineSpans(n.children, { ...base, italics: true }))
    } else if (n.type === 'delete') {
      spans.push(...inlineSpans(n.children, { ...base, strike: true }))
    } else if (n.type === 'inlineCode') {
      spans.push({ ...base, text: n.value, font: 'Consolas', size: 20 })
    } else if (n.type === 'link') {
      // 链接保留文字（docx 超链接需额外对象，降级为纯文字 + 链接地址）
      spans.push(...inlineSpans(n.children, base))
      if (n.url) spans.push({ ...base, text: ` (${n.url})`, color: '888888', size: 18 })
    } else if (n.type === 'image') {
      spans.push({ ...base, text: `[图片：${n.alt || n.url || ''}]`, color: '888888' })
    } else if (n.value != null) {
      spans.push({ ...base, text: String(n.value) })
    }
  }
  return spans
}

function toRuns(spans) {
  return spans.filter((s) => s.text != null && s.text !== '').map((s) => new TextRun(s))
}

function headingLevel(depth) {
  return HEADING_LEVELS[Math.min(Number(depth) || 1, 6)] || HeadingLevel.HEADING_6
}

// 代码块：等宽字体 + 浅灰底，按行拆分 TextRun（docx 不自动处理 \n）
function codeBlock(code) {
  const lines = String(code == null ? '' : code).split('\n')
  const runs = lines.map((line, i) =>
    new TextRun({ text: line, font: 'Consolas', size: 20, break: i < lines.length - 1 ? 1 : 0 })
  )
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: 'F4F4F4' },
    spacing: { before: 80, after: 80 },
    children: runs
  })
}

// 列表：有序/无序，前缀文本实现（不启用 docx 编号体系，简单稳定）
function listToDocx(node) {
  const out = []
  let index = 1
  for (const item of node.children || []) {
    const prefix = node.ordered ? `${index++}. ` : '•  '
    for (const child of item.children || []) {
      if (child.type === 'paragraph') {
        out.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: 40 },
            children: [new TextRun({ text: prefix }), ...toRuns(inlineSpans(child.children))]
          })
        )
      } else if (child.type === 'list') {
        out.push(...listToDocx(child))
      } else if (child.type === 'code') {
        out.push(codeBlock(child.value))
      } else if (child.type === 'blockquote') {
        out.push(blockquoteToDocx(child))
      }
    }
  }
  return out
}

function blockquoteToDocx(node) {
  // 引用内通常为 paragraph 节点，拼成一段灰字缩进
  const spans = []
  for (const child of node.children || []) {
    spans.push(...inlineSpans(child.children))
  }
  return new Paragraph({
    indent: { left: 400 },
    spacing: { after: 80 },
    children: [new TextRun({ text: '｜ ', color: '999999' }), ...toRuns(spans.map((s) => ({ ...s, color: '555555' })))]
  })
}

function tableToDocx(node) {
  const rows = (node.children || []).map((row) => {
    const cells = row.children
      ? row.children.map((cell) => new TableCell({
        width: { size: 100 / Math.max(row.children.length, 1), type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: toRuns(inlineSpans(cell.children)) })]
      }))
      : (row.cells || []).map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(cell) })] })] }))
    return new TableRow({ children: cells })
  })
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

// 块级节点 → docx 元素数组
function blocksToDocx(tree) {
  const out = []
  for (const n of tree.children || []) {
    switch (n.type) {
      case 'heading':
        out.push(new Paragraph({ heading: headingLevel(n.depth), spacing: { before: 160, after: 80 }, children: toRuns(inlineSpans(n.children)) }))
        break
      case 'paragraph':
        out.push(new Paragraph({ spacing: { after: 80 }, children: toRuns(inlineSpans(n.children)) }))
        break
      case 'list':
        out.push(...listToDocx(n))
        break
      case 'blockquote':
        out.push(blockquoteToDocx(n))
        break
      case 'code':
        out.push(codeBlock(n.value))
        break
      case 'thematicBreak':
        out.push(new Paragraph({ children: [new TextRun({ text: '────────────', color: 'CCCCCC' })] }))
        break
      case 'table':
        out.push(tableToDocx(n))
        break
      case 'html':
        // 内联 HTML 降级为纯文本展示，不丢内容
        if (n.value) out.push(new Paragraph({ children: [new TextRun({ text: String(n.value), color: '888888' })] }))
        break
      default:
        break
    }
  }
  return out
}

/**
 * 构建笔记 Word 文档 buffer
 * @param {Object} note 笔记记录（含 title / category / created_at / content）
 * @returns {Promise<Buffer>} .docx 文件内容
 */
async function buildNoteDocx(note) {
  await ensureMarkdown()
  const tree = unifiedFn().use(remarkParseFn).parse(String(note.content || ''))
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: note.title || '无标题笔记' })]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `类别：${categoryLabel(note.category)}　创建时间：${note.created_at || '-'}`, color: '888888', size: 18 })
      ]
    }),
    ...blocksToDocx(tree)
  ]
  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

module.exports = { buildNoteDocx }
