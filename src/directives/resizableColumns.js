/**
 * v-resizable-columns 通用指令：让表格表头支持左右拖动调整列宽。
 *
 * 用法：
 *   <table v-resizable-columns class="tbl">...</table>
 *   可选配置：v-resizable-columns="{ min: 48, minByIndex: { 9: 184 }, shareKey: 'task-overview' }"
 *     - min: 全局最小列宽（默认 48）
 *     - minByIndex: 按列索引指定最小列宽（如操作列保底，防止按钮被挤压）
 *     - shareKey: 同 key 的多张表格共享同一套列宽（估算取最大、拖拽同步、存档共享），
 *       用于"一组数据拆成多张表"的页面（如任务总览按课题组分表）
 *
 * 行为：
 *   - 自动切 table-layout: fixed；
 *   - 初始列宽按「表头 + 各行内容」字符宽度估算（含按钮/输入框等控件宽度），
 *     单元格 max-width（.ellipsis 类或内联样式）作为该列内容宽度上限，长文本列据此收敛不撑宽；
 *     估算完成后以 !important 释放单元格 max-width，渲染时内容随列宽显示（省略号跟随列宽）；
 *   - 数据行异步渲染后（MutationObserver 监测 tbody）自动重算一次，此后持续清理新渲染行的
 *     max-width 约束，并重测操作列（含按钮组 .ops 的列以 scrollWidth 实测完整显示宽度，只扩不缩）；
 *   - 表头右缘注入拖拽手柄，拖动实时改列宽；表格默认铺满容器宽度（width: 100%），
 *     列宽总和不足容器时由 fixed 布局自动拉伸填满，用户拖拽调整的是各列分配比例
 *     （列宽总和超出容器时同样由 fixed 布局按比例压缩）；
 *   - 列宽持久化到 localStorage（普通模式按 路由 hash + 页面内表格序号，shareKey 模式按 shareKey），
 *     下次进入恢复，有存档时以存档宽度为准（用户拖拽过的列不再被估算覆盖）；
 *   - 卸载时断开观察器、退出共享组并清理拖拽监听。
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

// 单列初始宽度：表头与各行内容取最大（内容不超过 limits[i] 上限），附加 padding/边框余量
function estimateColumnWidth(th, tds, limits) {
  let w = textWidth((th.textContent || '').trim())
  for (let i = 0; i < tds.length; i++) {
    let cw = cellContentWidth(tds[i])
    if (limits[i] != null) cw = Math.min(cw, limits[i])
    w = Math.max(w, cw)
  }
  return Math.max(60, w + 34)
}

// 读取单元格内容宽度上限（.ellipsis 等 max-width，内联或类样式取生效值），
// 随后用 !important 释放 max-width：列宽估算按上限收敛，渲染内容随列宽显示
function readLimitAndRelease(td) {
  const mw = parseFloat(getComputedStyle(td).maxWidth)
  td.style.setProperty('max-width', 'none', 'important')
  return Number.isFinite(mw) && mw > 0 ? mw : null
}

// 单元格左右 padding 之和（按钮组容器宽度不含 padding，需补回）
function tdPaddingX(td) {
  const cs = getComputedStyle(td)
  return (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
}

// 是否操作列：单元格含按钮组 .ops 或直接按钮（按钮需要完整显示）
function isOpsColumn(tds) {
  return tds.some((td) => td.querySelector('.ops') || td.querySelector('button'))
}

// 实测某列按钮组完整显示所需宽度：
// td / .ops 的 scrollWidth 在 overflow hidden 下仍返回内容完整宽（含被裁剪部分），
// 取所有行中的最大值并计入单元格左右 padding，保证操作列按钮不被截断
function opsColumnWidth(el, colIndex) {
  let maxW = 0
  el.querySelectorAll(':scope > tbody > tr').forEach((r) => {
    const td = r.children[colIndex]
    if (!td) return
    maxW = Math.max(maxW, td.scrollWidth)
    const ops = td.querySelector('.ops')
    if (ops) maxW = Math.max(maxW, ops.scrollWidth + tdPaddingX(td))
  })
  return maxW
}

function tableKey(table) {
  const routePart = String(window.location.hash || window.location.pathname).replace(/[^\w\u4e00-\u9fa5-]/g, '_')
  const index = Array.prototype.indexOf.call(document.querySelectorAll('[data-rc-table]'), table)
  return `rc-cols-${routePart}-${index}`
}

// 共享组：shareKey -> { tables, widths, key }，同 key 表格共用一套列宽
const shareGroups = new Map()
function getShareGroup(key) {
  if (!shareGroups.has(key)) {
    shareGroups.set(key, { tables: new Set(), widths: null, key: `rc-cols-shared-${key}` })
  }
  return shareGroups.get(key)
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

  const share = config.shareKey ? getShareGroup(config.shareKey) : null
  el._rcShare = share
  if (share) share.tables.add(el)

  // 按当前 DOM 计算本表各列宽度（行数据未渲染时只按表头估算）
  function estimateWidths() {
    const rows = Array.from(el.querySelectorAll(':scope > tbody > tr'))
    const tdsOf = (i) => rows.map((r) => r.children[i]).filter((td) => td)
    return ths.map((th, i) => {
      const tds = tdsOf(i)
      // 读取列内容宽度上限后释放 max-width：估算按上限收敛，渲染内容随列宽显示
      const limits = tds.map(readLimitAndRelease)
      let base = Math.max(estimateColumnWidth(th, tds, limits), minOf(i))
      // 操作列以实测按钮组完整宽度兜底（行渲染后的首次重算即生效）
      if (tds.length && isOpsColumn(tds)) {
        base = Math.max(base, opsColumnWidth(el, i))
      }
      return { base, min: minOf(i) }
    })
  }

  // 把一组宽度应用到本表 th；表格总宽由 CSS（width: fit-content; max-width: 100%）自适应
  function setWidths(widths) {
    ths.forEach((th, i) => {
      th.style.position = 'relative'
      th.style.width = `${widths[i].base}px`
      th.style.minWidth = `${widths[i].base}px`
    })
  }

  // 应用本表估算到共享组，并刷新组内其余表格的列宽
  function syncShare(widths) {
    if (!share) return
    share.tables.forEach((t) => {
      if (t === el) return
      const otherThs = t.querySelectorAll(':scope > thead > tr > th')
      otherThs.forEach((th, i) => {
        if (i >= widths.length) return
        th.style.width = `${widths[i].base}px`
        th.style.minWidth = `${widths[i].base}px`
      })
    })
  }

  // 清理 tbody 内所有 td 的 max-width 约束（翻页/搜索后新渲染的行会带回内联 max-width）
  function releaseTdLimits() {
    el.querySelectorAll(':scope > tbody > tr').forEach((r) =>
      r.querySelectorAll('td').forEach(readLimitAndRelease)
    )
  }

  // 行增删/翻页后重测操作列：按钮完整显示优先，只扩不缩（尊重用户拖拽/存档的更宽值）
  function refreshOpsWidth() {
    const { widths, key } = applied
    ths.forEach((th, i) => {
      const tds = Array.from(el.querySelectorAll(':scope > tbody > tr'))
        .map((r) => r.children[i])
        .filter((td) => td)
      if (!tds.length || !isOpsColumn(tds)) return
      const measured = opsColumnWidth(el, i)
      if (measured <= widths[i].base) return
      widths[i].base = measured
      if (share) share.widths[i] = measured
      th.style.width = `${measured}px`
      th.style.minWidth = `${measured}px`
      setWidths(widths)
      syncShare(widths)
      try {
        localStorage.setItem(key, JSON.stringify(widths.map((c) => c.base)))
      } catch {
        // 写入失败（隐私模式等）静默
      }
    })
  }

  // 计算并应用最终列宽：本表估算 →（共享组取全组最大）→ 存档恢复
  function applyWidths() {
    const self = estimateWidths()
    let widths = self
    let key = tableKey(el)

    if (share) {
      if (!share.widths) {
        share.widths = self.map((c) => c.base)
      } else {
        self.forEach((c, i) => {
          if (i < share.widths.length) share.widths[i] = Math.max(share.widths[i], c.base)
        })
      }
      widths = share.widths.map((w, i) => ({ base: w, min: minOf(i) }))
      key = share.key
    }

    // 有本地存档时以存档为准（用户拖过的宽度优先于估算）
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
      if (share) share.widths = widths.map((c) => c.base)
    }

    setWidths(widths)
    syncShare(widths)
    return { widths, key }
  }

  let applied = applyWidths()
  let initialized = false

  // 监听 tbody：首轮行渲染后重算一次初始宽度（接口返回后 v-for 才生成行），
  // 此后持续清理新渲染行的 max-width 约束并重测操作列，宽度由用户拖拽控制
  const tbody = el.querySelector('tbody')
  let observer = null
  if (tbody) {
    observer = new MutationObserver(() => {
      if (!tbody.querySelectorAll(':scope > tr').length) return
      if (initialized) {
        releaseTdLimits()
        refreshOpsWidth()
        return
      }
      initialized = true
      requestAnimationFrame(() => {
        applied = applyWidths()
        attachResizers()
      })
    })
    observer.observe(tbody, { childList: true })
    el._rcObserver = observer
  }

  function attachResizers() {
    ths.forEach((th, i) => {
      // 防止重复注入手柄（重算后 th 不变，但防御性清理）
      if (th.querySelector('.rc-resizer')) return
      const rz = document.createElement('span')
      rz.className = 'rc-resizer'
      th.appendChild(rz)
      rz.addEventListener('mousedown', (e) => {
        // 每次取最新 applied：applied 在行渲染后会被 applyWidths 重建（更宽的内容值），
        // 若在挂载时把 widths/key 固化进闭包，拖拽会把其他列覆盖回首轮的表头估算窄值
        const { widths, key } = applied
        e.preventDefault()
        const startX = e.clientX
        const startW = widths[i].base
        document.body.style.userSelect = 'none'
        const onMove = (ev) => {
          const w = Math.max(widths[i].min, Math.min(500, startW + ev.clientX - startX))
          widths[i].base = w
          if (share) share.widths[i] = w
          th.style.width = `${w}px`
          th.style.minWidth = `${w}px`
          setWidths(widths)
          syncShare(widths)
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
  // 退出共享组，组内无表格时清理，避免残留
  const share = el._rcShare
  if (share) {
    share.tables.delete(el)
    if (!share.tables.size) shareGroups.delete(share.key)
  }
}

export default {
  mounted,
  unmounted
}
