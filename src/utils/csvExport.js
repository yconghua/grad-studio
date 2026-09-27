/**
 * 前端通用 CSV 导出工具
 *
 * 数据总览页各模块表格复用：把行数据按列定义转成 UTF-8（带 BOM）CSV 并触发下载。
 * 所有单元格统一加引号包裹并转义内部引号，避免内容中的逗号/换行破坏列对齐。
 */

/**
 * 导出 CSV
 * @param {string} filename 下载文件名（建议以 .csv 结尾）
 * @param {Array<object>} rows 行数据
 * @param {Array<{ key: string, label: string }>} columns 列定义（key 取行字段，label 为表头）
 */
export function exportCsv(filename, rows, columns) {
  const head = columns.map((c) => c.label).join(',')
  const lines = (rows || []).map((row) =>
    columns
      .map((c) => {
        let v = row[c.key]
        if (v == null) v = ''
        if (v instanceof Date) v = v.toISOString()
        v = String(v).replace(/"/g, '""')
        return `"${v}"`
      })
      .join(',')
  )
  const csv = '\ufeff' + [head, ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
