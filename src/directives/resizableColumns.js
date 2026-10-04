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
 *   - 自动切 table-layout: fixed；
 *   - 初始列宽按「表头 + 各行内容」字符宽度估算（含按钮/输入框等控件宽度），
 *     数据行异步渲染后（MutationObserver 监测 tbody）自动重算一次，保证不遮挡、整齐；
 *   - 表头右缘注入拖拽手柄，拖动实时改列宽并同步表格 min-width；
 *   - 列宽持久化到 localStorage（按 路由 hash + 页面内表格序号 分 key），下次进入恢复，
 *     有存档时以存档宽度为准（用户拖拽过的列不再被估算覆盖）；
 *   - 卸载时断开观察器并清理拖拽监听。
 */

// 估算文本渲染宽度：中文/全角按 14px，ASCII/半角按 7px（12px 字号下约值）
function textWidth(str) {
  let w = 0
  for (const ch of String(str || '')) {
    w += ch.charCodeAt(0) > 255 ? 14 : 7
  }
  return w
}

// 单元格内可见文本：剔除按钮/输入框/链接等控件的文字，避免与控件宽度重复计数
function visibleTextOfCell(td) {
  const clone = td.cloneNode(true)
  clone.querySelectorAll('button, input, select, a, i, svg').forEach((n) => n.remove())
  return (clone.textContent || '').replace(/\s+/g, ' ').trim()
}

// 单元格内容宽度：文本取最宽行，控件按数量折算，二者取较大值
function cellContentWidth(td) {
  let cw = 0
  const btns = td.querySelectorAll('button')
  if (btns.length) cw += btns.length * 48 + (btns.length - 1) * 6
  const fields = td.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), select')
  if (fields.length) cw += fields.length * 110
  const checks = td.querySelectorAll('input[type="checkbox"], input[type="radio"]')
  if (checks.length) cw += checks.length * 26
  const lines = visibleTextOfCell(td).split('\n')
  const tw = lines.reduce((m, l) => Math.max(m, textWidth(l)), 0)
  return Math.max(cw, tw)
}

// 单列初始宽度：表头与各行内容取最大，附加 padding/边框余量
function estimateColumnWidth(th, tds) {
  let w = textWidth((th.textContent || '').trim())
  for (const td of tds) {
    w = Math.max(w, cellContentWidth(td))
  }
  return Math.max(60, w + 34)
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

  // 列最小宽度：minByIndex 优先，否则用全局 min
  const minOf = (i) => (minByIndex[i] != null ? Number(minByIndex[i]) : minDefault)

  // 按当前 DOM 计算并应用初始列宽（行数据未渲染时只按表头估算）
  function applyWidths() {
    const rows = Array.from(el.querySelectorAll(':scope > tbody > tr'))
    const tdsOf = (i) => rows.map((r) => r.children[i]).filter((td) => td)
    const widths = ths.map((th, i) => ({
      base: Math.max(estimateColumnWidth(th, tdsOf(i)), minOf(i)),
      min: minOf(i)
    }))
    const total = () => widths.reduce((s, c) => s + c.base, 0)

    // 有本地存档时以存档为准（用户拖过的宽度优先于估算）
    const key = tableKey(el)
    let saved = null
    try {
      saved = JSON.parse(localStorage.getItem(key) || 'null')
    } catch {
      saved = null
    }
    if (Array.isArray(saved) && saved.length === widths.length) {
      saved.forEach((w, i) => {
        const v = Number(w)
        if (Number.isFinite(v)) widths[i].base = Math.max(widths[i].min, Math.min(500, Math.round(v)))
      })
    }

    ths.forEach((th, i) => {
      th.style.position = 'relative'
      th.style.width = `${widths[i].base}px`
      th.style.minWidth = `${widths[i].base}px`
    })
    el.style.minWidth = `${total()}px`
    return { widths, key, total }
  }

  let applied = applyWidths()
  let initialized = false

  // 数据行异步渲染后重算一次初始宽度（如接口返回后 v-for 才生成行），
  // 重算后断开观察器，此后宽度完全由用户拖拽控制
  const tbody = el.querySelector('tbody')
  let observer = null
  if (tbody) {
    observer = new MutationObserver(() => {
      if (initialized) return
      const rows = tbody.querySelectorAll(':scope > tr')
      if (!rows.length) return
      initialized = true
      requestAnimationFrame(() => {
        applied = applyWidths()
        attachResizers()
      })
      observer.disconnect()
      observer = null
    })
    observer.observe(tbody, { childList: true })
    el._rcObserver = observer
  }

  function attachResizers() {
    const { widths, key, total } = applied
    ths.forEach((th, i) => {
      // 防止重复注入手柄（重算后 th 不变，但防御性清理）
      if (th.querySelector('.rc-resizer')) return
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

  attachResizers()
}

function unmounted(el) {
  if (el._rcObserver) {
    el._rcObserver.disconnect()
    el._rcObserver = null
  }
}

export default {
  mounted,
  unmounted
}
