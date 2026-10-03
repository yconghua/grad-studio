<template>
  <canvas ref="canvasEl" class="particle-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// 登录页品牌区粒子背景：粒子按爱心面积均匀填满（心尖朝下）；鼠标进入左区后仅鼠标周围一圈粒子聚拢跟随
const canvasEl = ref(null)

let ctx = null
let rafId = 0
let particles = []
let width = 0
let height = 0
let dpr = 1
// 爱心团基准中心（左区居中）
let heartX = 0
let heartY = 0
let heartScale = 1
let radiusTable = [] // 极角 → 心形边界半径表（用于面积均匀撒点）
let mouse = { x: -9999, y: -9999, inside: false }
let frameCount = 0
let attrObserver = null
// 主题主色 --primary 的 RGB 分量（亮色基准 #4f6ef7），暗色主题由 MutationObserver 刷新
let color = '79,110,247'

const DOT_ALPHA = 0.42 // 粒子透明度
const FLOAT_AMP = 3 // 爱心态下绕基准的漂浮振幅
const GATHER_EASE = 0.045 // 粒子朝目标缓动速度（聚拢/回弹均适用）
const ATTRACT_RADIUS = 100 // 鼠标吸引半径：仅此半径内（按爱心基准计）的粒子可能聚拢
const TABLE_BUCKETS = 360 // 半径表方向桶数

// 读取当前 --primary 的 RGB 分量（含暗色主题覆盖）
function readPrimary() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    color = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
  }
}

// 经典爱心参数方程：返回相对原点的坐标（y 取反，心尖朝下）
function heartPoint(t) {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x, y }
}

// 预计算各方向的心形边界半径（resize 时调用一次）
function buildRadiusTable() {
  radiusTable = new Array(TABLE_BUCKETS).fill(0)
  const steps = 720
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const pt = heartPoint(t)
    const ang = Math.atan2(pt.y, pt.x)
    const rho = Math.hypot(pt.x, pt.y)
    const idx = Math.round(((ang + Math.PI) / (Math.PI * 2)) * TABLE_BUCKETS) % TABLE_BUCKETS
    if (rho > radiusTable[idx]) radiusTable[idx] = rho
  }
}

// 取任意角度方向的心形边界半径（相邻桶线性插值）
function radiusAt(theta) {
  const f = ((theta + Math.PI) / (Math.PI * 2)) * TABLE_BUCKETS
  const i0 = Math.floor(f) % TABLE_BUCKETS
  const i1 = (i0 + 1) % TABLE_BUCKETS
  const frac = f - Math.floor(f)
  return radiusTable[i0] * (1 - frac) + radiusTable[i1] * frac
}

// 面积均匀撒点：角度均匀、半径按 sqrt 分布，使爱心内部各区域粒子密度一致
function makeParticle() {
  const theta = Math.random() * Math.PI * 2
  const rho = radiusAt(theta) * Math.sqrt(Math.random())
  const bx = Math.cos(theta) * rho * heartScale
  const by = Math.sin(theta) * rho * heartScale
  return {
    bx,
    by,
    r: 1.4 + Math.random() * 1.6, // 粒子半径
    phase: Math.random() * Math.PI * 2, // 漂浮相位（兼作聚拢散布角）
    // 跟随意愿：决定该粒子在吸引半径内是否聚拢（近处几乎全聚，边缘部分保留）
    follow: 0.6 + Math.random() * 0.4,
    x: heartX + bx,
    y: heartY + by
  }
}

// 以父容器（品牌区）尺寸重建画布，按爱心尺寸配粒子并重置爱心中心
function resize() {
  const el = canvasEl.value
  const parent = el && el.parentElement
  if (!el || !parent) return
  const rect = parent.getBoundingClientRect()
  width = rect.width
  height = rect.height
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // 爱心水平跨度 ±16，垂直约 -17..13；取高度约 60% 时的心形尺寸做基准
  heartScale = Math.min(width, height) * 0.021
  heartX = width * 0.5
  heartY = height * 0.47
  buildRadiusTable()
  // 实心填充密度：按爱心实际面积配粒子数（约 48px²/粒，粒子间距约 7px）
  const heartArea = 32 * 30 * 0.55 * heartScale * heartScale
  const count = Math.max(400, Math.min(1500, Math.round(heartArea / 40)))
  while (particles.length < count) particles.push(makeParticle())
  if (particles.length > count) particles.length = count
}

function onPointerMove(e) {
  const el = canvasEl.value
  const parent = el && el.parentElement
  if (!el || !parent) return
  const rect = parent.getBoundingClientRect()
  mouse.x = e.clientX - rect.left
  mouse.y = e.clientY - rect.top
  mouse.inside = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height
}

function onPointerLeave() {
  mouse.inside = false
}

function frame() {
  frameCount++
  ctx.clearRect(0, 0, width, height)

  for (const p of particles) {
    // 该粒子的爱心基准坐标（含漂浮）
    const bx = heartX + p.bx + Math.sin(p.phase + frameCount * 0.02) * FLOAT_AMP
    const by = heartY + p.by + Math.cos(p.phase + frameCount * 0.025) * FLOAT_AMP

    let tx = bx
    let ty = by
    // 仅鼠标吸引半径内（按爱心基准计）的粒子可能聚拢；距离越近聚拢概率越高（follow 阈值），边缘粒子部分保留
    if (mouse.inside) {
      const dx = mouse.x - bx
      const dy = mouse.y - by
      if (dx * dx + dy * dy < ATTRACT_RADIUS * ATTRACT_RADIUS * p.follow * p.follow) {
        const rad = 6 + p.r * 2.2
        tx = mouse.x + Math.cos(p.phase) * rad
        ty = mouse.y + Math.sin(p.phase) * rad
      }
    }
    p.x += (tx - p.x) * GATHER_EASE
    p.y += (ty - p.y) * GATHER_EASE

    // 聚拢时粒子轻微放大，聚拢感更明显
    const drawR = (tx !== bx || ty !== by) ? p.r * 1.25 : p.r
    ctx.beginPath()
    ctx.arc(p.x, p.y, drawR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${color},${DOT_ALPHA})`
    ctx.fill()
  }

  rafId = requestAnimationFrame(frame)
}

onMounted(() => {
  const el = canvasEl.value
  if (!el) return
  ctx = el.getContext('2d')
  readPrimary()
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerleave', onPointerLeave)
  // 主题切换（<html data-theme> 变化）时刷新主色
  attrObserver = new MutationObserver(readPrimary)
  attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  // 系统开启"减少动态"时只绘制一帧静态粒子
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduceMotion) {
    rafId = requestAnimationFrame(frame)
  } else {
    frame()
    cancelAnimationFrame(rafId)
    rafId = 0
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerleave', onPointerLeave)
  if (attrObserver) attrObserver.disconnect()
})
</script>

<style scoped>
.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
</style>
