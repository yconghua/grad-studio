// 应用入口：创建 Vue 实例并挂载到 #app。
// 路由（hash 模式）与登录守卫见 src/router/index.js；根组件见 App.vue（仅承载路由出口）。
// 样式顺序：tokens（亮色基准）→ themes/dark（暗色覆盖）→ role-ui（共享类，全部引用令牌）。
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/themes/dark.css'
import './styles/role-ui.css'
import { applyInitialTheme, applyTheme } from './composables/useTheme'
import resizableColumns from './directives/resizableColumns'

// 挂载前先按本地偏好设置根节点 data-theme（index.html 内联脚本的兜底）
applyInitialTheme()

// 无本地偏好时用服务端默认主题兜底（异步增强，不影响首帧；个人切换后不再触发）
async function applyServerDefaultTheme() {
  try {
    const stored = localStorage.getItem('gra_theme_mode')
    if (stored === 'light' || stored === 'dark' || stored === 'system') return
    const res = await window.api.sys.getPublicInfo()
    if (res && res.success && res.defaultTheme) applyTheme(res.defaultTheme)
  } catch (e) {
    // 读取失败静默，沿用当前主题
  }
}
applyServerDefaultTheme()

createApp(App).use(router).directive('resizable-columns', resizableColumns).mount('#app')
