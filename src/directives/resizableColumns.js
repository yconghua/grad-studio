/**
 * v-resizable-columns 通用指令：让表格表头支持左右拖动调整列宽。
 *
 * 用法：
 *   <table v-resizable-columns class="tbl">...</table>
 *   可选配置：v-resizable-columns="{ min: 48, minByIndex: { 9: 184 } }"
 *     - min: 全局最小列宽（默认 48）
 *     - minByIndex: 按列索引指定最小列宽（如操作列保底，防止按钮被挤压）
 *
 * 行为：
 *   - 自动切 table-layout: fixed，初始宽度取表头当前渲染宽度；
 *   - 表头右缘注入拖拽手柄，拖动实时改列宽并同步表格 min-width；
 *   - 列宽持久化到 localStorage（按 路由 hash + 页面内表格序号 分 key），下次进入恢复；
 *   - 卸载时清理拖拽监听。
 */
function estimateWidth(th) {
  const text = th.textContent || ''
  let w = 0
  for (const ch of text) {
    w += ch.charCodeAt(0) > 255 ? 14 : 8
  }
  if (th.querySelectorAll('input, select, button').length) w += 64
  return Math.max(60, Math.round(w) + 36)
}

function tableKey(table) {
  const routePart = String(window.location.hash || window.location.pathname).replace(/[^\w\u4e00-\u9fa5-]/g, '_')
  const index = Array.prototype.indexOf.call(document.querySelectorAll('[data-rc-table]'), table)
  return `rc-cols-${routePart}-${index}`
}

function mounted(el, binding) {
  const config = binding.value || {}
  const minDefault = config.min != null ? Number(config.min) : 48
  const minByIndex = config.minByIndex || {}
  const ths = Array.from(el.querySelectorAll(':scope > thead > tr > th'))
  if (!ths.length) return

  el.setAttribute('data-rc-table', '')
  el.style.tableLayout = 'fixed'

  // 初始列宽：优先取表头当前渲染宽度（auto 布局下浏览器按内容算好的）
  const widths = ths.map((th, i) => {
    const min = minByIndex[i] != null ? Number(minByIndex[i]) : minDefault
    let w = th.offsetWidth
    if (!w || w < 10) w = estimateWidth(th)
    w = Math.max(w, min)
    th.style.position = 'relative'
    th.style.width = `${w}px`
    th.style.minWidth = `${w}px`
    return { base: w, min }
  })
  const total = () => widths.reduce((s, c) => s + c.base, 0)
  el.style.minWidth = `${total()}px`

  // 从 localStorage 恢复上次拖拽宽度
  const key = tableKey(el)
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (Array.isArray(saved) && saved.length === widths.length) {
      saved.forEach((w, i) => {
        const v = Number(w)
        if (Number.isFinite(v)) widths[i].base = Math.max(widths[i].min, Math.min(500, Math.round(v)))
      })
      ths.forEach((th, i) => {
        th.style.width = `${widths[i].base}px`
        th.style.minWidth = `${widths[i].base}px`
      })
      el.style.minWidth = `${total()}px`
    }
  } catch {
    // 本地缓存损坏时静默回退默认宽度
  }

  // 每个表头注入拖拽手柄
  ths.forEach((th, i) => {
    const rz = document.createElement('span')
    rz.className = 'rc-resizer'
    th.appendChild(rz)
    rz.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = widths[i].base
      document.body.style.userSelect = 'none'
      const onMove = (ev) => {
        const w = Math.max(widths[i].min, Math.min(500, startW + ev.clientX - startX))
        widths[i].base = w
        th.style.width = `${w}px`
        th.style.minWidth = `${w}px`
        el.style.minWidth = `${total()}px`
        try {
          localStorage.setItem(key, JSON.stringify(widths.map((c) => c.base)))
        } catch {
          // 写入失败（隐私模式等）静默
        }
      }
      const onUp = () => {
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    })
  })
}

export default {
  mounted
}
