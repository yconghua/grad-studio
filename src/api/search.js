// 全局搜索模块接口（search:*）
export function searchGlobal(keyword) {
  return window.api.search.global({ keyword })
}
