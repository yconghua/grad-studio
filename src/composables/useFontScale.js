// 全局字号（组合式函数）：个人档位（localStorage）优先，其次全局默认（system_configs），兜底 1
// 应用方式：Chromium 原生 zoom 作用于根元素，全站（字号/间距/图标）等比缩放，即时生效、可逆。
// 与 useTheme 同风格：纯函数 + ref，可脱离组件调用（App 挂载前兜底应用）。
import { ref } from 'vue'
import { getPublicInfo } from '../api/db'

export const FONT_SCALE_KEY = 'gra_font_scale'
export const FONT_SCALE_OPTIONS = [
  { value: 0.9, label: '小' },
  { value: 1, label: '标准' },
  { value: 1.125, label: '大' },
  { value: 1.25, label: '特大' }
]
const VALID_SCALES = new Set(FONT_SCALE_OPTIONS.map((o) => o.value))

function readPersonalScale() {
  try {
    const v = Number(localStorage.getItem(FONT_SCALE_KEY))
    return VALID_SCALES.has(v) ? v : null
  } catch (e) {
    return null
  }
}

// 立即把字号写入根元素（同时写入 --app-font-zoom，供弹窗 vh/vw 约束按缩放折算）
export function applyFontScale(scale) {
  const s = VALID_SCALES.has(Number(scale)) ? Number(scale) : 1
  document.documentElement.style.zoom = String(s)
  document.documentElement.style.setProperty('--app-font-zoom', String(s))
}

// 启动应用一次：个人档位优先；无个人设置时拉全局默认（失败回退 1）
export async function applyInitialFontScale() {
  const personal = readPersonalScale()
  if (personal !== null) {
    applyFontScale(personal)
    return
  }
  let global = 1
  try {
    const res = await getPublicInfo()
    if (res && res.success && VALID_SCALES.has(Number(res.data && res.data.fontScale))) {
      global = Number(res.data.fontScale)
    }
  } catch (e) {
    // 数据库未连接 / 拉取失败时保持默认
  }
  applyFontScale(global)
}

export function useFontScale() {
  const scale = ref(readPersonalScale() ?? 1)

  // 设置个人档位：写 localStorage + 立即应用
  function setScale(next) {
    const v = VALID_SCALES.has(Number(next)) ? Number(next) : 1
    scale.value = v
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(v))
    } catch (e) {
      // 存储失败静默，仅当前会话生效
    }
    applyFontScale(v)
  }

  // 清除个人档位：恢复跟随全局默认（超管改全局后生效）
  function clearScale() {
    try {
      localStorage.removeItem(FONT_SCALE_KEY)
    } catch (e) {
      // 忽略
    }
    scale.value = readPersonalScale() ?? 1
    applyFontScale(scale.value)
  }

  return { scale, setScale, clearScale }
}
