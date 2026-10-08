// 全局平台名称：从后端 sys:get-public-info 读取（system_configs 的系统名称），未配置/请求失败时回退默认值。
// 默认值与后端 systemService / ipc sys 的 DEFAULT_APP_NAME 保持一致（千兆中心），避免前后端兜底不一致。
// 单例 reactive，所有页面共享；超管在系统参数保存后调 refreshAppName() 即时刷新。
import { reactive, computed, onMounted, onUnmounted } from 'vue'
import { getPublicInfo } from '../api'

const state = reactive({
  appName: '千兆中心',
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

  // 数据库连接生效/切换/参数保存会广播 db:changed，此时自动重拉系统名，
  // 解决「第一次连接数据库后系统名/简介仍显示默认值、要编辑保存才生效」的问题
  let unsubDb = null
  onMounted(() => {
    if (window.api && window.api.sys && typeof window.api.sys.onDbChanged === 'function') {
      unsubDb = window.api.sys.onDbChanged(refreshAppName)
    }
  })
  onUnmounted(() => {
    if (unsubDb) unsubDb()
    unsubDb = null
  })

  return { appName: computed(() => state.appName), refreshAppName }
}
