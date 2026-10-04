// 全局平台名称：从后端 system_param.app_name 读取，未配置时回退默认值。
// 单例 reactive，所有页面共享；超管在系统参数保存后调 refreshAppName() 即时刷新。
import { reactive, computed } from 'vue'
import { getPublicInfo } from '../api'

const state = reactive({
  appName: '小组管理平台',
  loaded: false
})

let inflight = null

export function useAppName() {
  async function refreshAppName() {
    if (inflight) return inflight
    inflight = getPublicInfo()
      .then((res) => {
        if (res && res.success && res.appName) {
          state.appName = res.appName
        }
        state.loaded = true
      })
      .catch(() => {
        // 静默失败，保留默认名
      })
      .finally(() => { inflight = null })
    return inflight
  }

  if (!state.loaded && !inflight) {
    refreshAppName()
  }

  return { appName: computed(() => state.appName), refreshAppName }
}
