/**
 * v-sortable-columns 通用指令：为表格表头提供点击排序（升序 → 降序 → 取消）。
 *
 * 用法：
 *   <table v-sortable-columns="{ field: sortField, order: sortOrder, onSort: (field, order) => load() }" class="tbl">
 *     <th data-sort="realName">真实姓名</th>
 *     <th>操作</th>   <!-- 不带 data-sort 的表头不可排序 -->
 *   </table>
 *
 * 行为：
 *   - 点击带 data-sort 的表头循环：无排序 → 升序(asc) → 降序(desc) → 取消（恢复后端默认排序）；
 *   - 点击其它列：切到该列升序；
 *   - data-sort 是语义键（如 realName / dueTime），SQL 列名映射在仓库层 SORT_MAP 白名单内完成，
 *     前端字符串永不进入列名位置；
 *   - 与 v-resizable-columns 共存：点击拖拽手柄（.rc-resizer）不触发排序；
 *   - 表头箭头由指令注入 span.sc-arrow，激活态通过 th.sc-asc / th.sc-desc / th.sc-sort 反映。
 */

function arrowOf(th) {
  if (!th._scArrow) {
    const span = document.createElement('span')
    span.className = 'sc-arrow'
    span.setAttribute('aria-hidden', 'true')
    const up = document.createElement('i')
    up.className = 'up'
    const down = document.createElement('i')
    down.className = 'down'
    span.appendChild(up)
    span.appendChild(down)
    th.appendChild(span)
    th._scArrow = span
  }
  return th._scArrow
}

function applyState(el, state) {
  const field = state && state.field
  const order = state && state.order
  el.querySelectorAll(':scope > thead > tr > th[data-sort]').forEach((th) => {
    th.classList.remove('sc-asc', 'sc-desc', 'sc-sort')
    arrowOf(th)
    if (field && th.getAttribute('data-sort') === field) {
      th.classList.add(order === 'desc' ? 'sc-desc' : 'sc-asc')
    } else {
      th.classList.add('sc-sort')
    }
  })
}

function onClick(e) {
  const th = e.target.closest('th[data-sort]')
  if (!th) return
  // 拖拽手柄（列宽调整）不触发排序
  if (e.target.closest('.rc-resizer')) return
  const table = th.closest('table')
  const state = table && table._scState
  if (!state || typeof state.onSort !== 'function') return
  const key = th.getAttribute('data-sort')
  let next
  if (state.field !== key) {
    next = { field: key, order: 'asc' }
  } else if (state.order !== 'desc') {
    next = { field: key, order: 'desc' }
  } else {
    // 已降序再点：取消排序，恢复后端默认
    next = { field: '', order: '' }
  }
  state.onSort(next.field, next.order)
}

function mounted(el, binding) {
  el._scState = binding.value || {}
  el.addEventListener('click', onClick)
  applyState(el, binding.value || {})
}

function updated(el, binding) {
  el._scState = binding.value || {}
  applyState(el, binding.value || {})
}

function unmounted(el) {
  el.removeEventListener('click', onClick)
  el._scState = null
}

export default {
  mounted,
  updated,
  unmounted
}
