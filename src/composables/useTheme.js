// 亮暗主题（组合式函数）：读本地偏好并写入根节点 data-theme
// 模式：light / dark / system；非法值回退 system。
// 与 useSession 同风格：纯函数 + ref，可脱离组件调用（main.js 挂载前使用）。
import { ref } from 'vue'

export const THEME_KEY = 'gra_theme_mode'
const VALID_MODES = ['light', 'dark', 'system']

function readStoredMode() {
  try {
    const m = localStorage.getItem(THEME_KEY)
    return VALID_MODES.includes(m) ? m : 'system'
  } catch (e) {
    return 'system'
  }
}

// 系统当前是否为暗色
export function systemPrefersDark() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// 由模式解析出实际主题 light/dark
export function resolveTheme(mode) {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return systemPrefersDark() ? 'dark' : 'light'
}

// 立即把主题写入根节点（与 index.html 内联脚本同逻辑，供挂载前兜底）
export function applyTheme(mode) {
  const theme = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

// 启动时应用一次：读偏好 → 立即设 data-theme，返回实际模式
export function applyInitialTheme() {
  const mode = readStoredMode()
  applyTheme(mode)
  return mode
}

export function useTheme() {
  const mode = ref(readStoredMode())
  const currentTheme = ref(applyTheme(mode.value))

  let media = null
  let mediaHandler = null

  // 跟随系统：监听系统主题变化，仅 system 模式生效
  function watchSystem() {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (mediaHandler) media.removeEventListener('change', mediaHandler)
    media = window.matchMedia('(prefers-color-scheme: dark)')
    mediaHandler = () => {
      if (mode.value === 'system') currentTheme.value = applyTheme('system')
    }
    media.addEventListener('change', mediaHandler)
  }

  // 切换模式：写 localStorage、设 data-theme；切换瞬间加短过渡类
  function setTheme(next) {
    const m = VALID_MODES.includes(next) ? next : 'system'
    mode.value = m
    try {
      localStorage.setItem(THEME_KEY, m)
    } catch (e) {
      // 存储失败静默，仅当前会话生效
    }
    const el = document.documentElement
    el.classList.add('theme-transitioning')
    currentTheme.value = applyTheme(m)
    window.setTimeout(() => el.classList.remove('theme-transitioning'), 250)
    if (m === 'system') watchSystem()
  }

  watchSystem()
  return { mode, currentTheme, setTheme }
}
