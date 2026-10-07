// 通用列表加载状态（AsyncList）：包装分页拉全量列表的加载过程
//
// 用法：const { loading, error, data, run } = useAsyncList(listCandidates)
//   - run(params) 自动翻页拉全量（与 fetchAll 语义一致），返回列表数组
//   - loading：请求中置 true；error：失败时置原因文案；data：最终结果
// 供各弹窗/页面的候选列表、下拉选项统一三态提示（加载中 / 加载失败+重试 / 空态）。
import { ref } from 'vue'

export function useAsyncList(fetchFn) {
  const loading = ref(false)
  const error = ref('')
  const data = ref([])

  async function run(params = {}) {
    loading.value = true
    error.value = ''
    const all = []
    let page = 1
    try {
      for (;;) {
        const res = await fetchFn({ ...params, page })
        if (!res || !res.success) {
          error.value = (res && res.message) || '加载失败'
          break
        }
        const d = res.data || {}
        all.push(...((d.list || []).map((x) => ({ ...x }))))
        if (page >= (d.totalPages || 1)) break
        page++
      }
    } catch (e) {
      error.value = '加载失败，请检查网络后重试'
    } finally {
      data.value = all
      loading.value = false
    }
    return all
  }

  return { loading, error, data, run }
}
