/**
 * 通用工具：自动翻页拉取全量列表
 *
 * 后端所有列表统一每页 8 条（pageSize 固定），下拉选人等场景需要全量数据，
 * 这里按 totalPages 自动翻页聚合，避免在下拉组件里重复写翻页循环。
 */
export async function fetchAll(fetchFn, params = {}) {
  const all = []
  let page = 1
  for (;;) {
    const res = await fetchFn({ ...params, page })
    if (!res || !res.success) break
    const data = res.data || {}
    all.push(...((data.list || []).map((x) => ({ ...x }))))
    if (page >= (data.totalPages || 1)) break
    page++
  }
  return all
}
