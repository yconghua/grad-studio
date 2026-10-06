<template>
  <div class="panel">
    <div style="display: flex; align-items: center; justify-content: space-between">
      <p class="panel-title" style="margin: 0">{{ mode === 'global' ? '外观（全局默认字号）' : '字号调节' }}</p>
      <button v-if="mode === 'global'" class="btn btn-primary btn-sm" :disabled="saving" @click="saveGlobal">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
    <div class="field" style="margin-top: 12px; margin-bottom: 0">
      <label>{{ mode === 'global' ? '无个人字号设置的账号首次登录使用的字号' : '个人字号（立即生效，覆盖全局默认）' }}</label>
      <div class="fs-options">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="fs-item"
          :class="{ active: current === opt.value }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
        <button v-if="mode === 'personal' && hasPersonal" type="button" class="fs-item" @click="clearPersonal">跟随全局</button>
      </div>
      <p v-if="mode === 'global'" class="hint">全局默认字号：小 0.9 / 标准 1 / 大 1.125 / 特大 1.25；个人设置页可单独覆盖自己的字号</p>
      <p v-else class="hint">选择"跟随全局"后，字号以超管系统配置里的全局默认字号为准</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { listParams, updateParam, createParam } from '../../api/system'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import {
  useFontScale,
  FONT_SCALE_OPTIONS,
  FONT_SCALE_KEY
} from '../../composables/useFontScale'

// 字号调节面板：personal = 各角色设置页的个人字号；global = 超管系统配置的全局默认字号
const props = defineProps({
  mode: { type: String, default: 'personal' }
})

const options = FONT_SCALE_OPTIONS
const { scale, setScale, clearScale } = useFontScale()
const hasPersonal = computed(() => {
  try {
    return localStorage.getItem(FONT_SCALE_KEY) !== null
  } catch (e) {
    return false
  }
})
const current = computed(() => scale.value)

function pick(v) {
  if (props.mode === 'personal') {
    setScale(v)
  } else {
    globalScale.value = v
  }
}

function clearPersonal() {
  clearScale()
}

// ===== 全局默认字号（超管系统配置） =====
const globalScale = ref(1)
const saving = ref(false)
let globalParamId = null

async function loadGlobal() {
  const res = await listParams({ page: 1, keyword: 'system.font_scale' })
  if (res && res.success) {
    const found = ((res.data && res.data.list) || []).find((p) => p.configKey === 'system.font_scale')
    if (found) {
      globalParamId = found.id
      const v = Number(found.configValue)
      globalScale.value = options.some((o) => o.value === v) ? v : 1
    }
  }
}

async function saveGlobal() {
  if (saving.value) return
  saving.value = true
  try {
    const value = globalScale.value
    let res
    if (globalParamId) {
      res = await updateParam(globalParamId, { configValue: value })
    } else {
      res = await createParam({
        configKey: 'system.font_scale',
        configValue: value,
        configType: 'number',
        description: '全局默认字号：0.9/1/1.125/1.25（超管可配，无个人字号设置的账号兜底）'
      })
    }
    if (res && res.success) {
      globalParamId = res.data ? res.data.id : globalParamId
      await refreshAfterWrite('全局默认字号已保存')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (props.mode === 'global') loadGlobal()
})
</script>

<style scoped>
.fs-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fs-item {
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
}
.fs-item:hover {
  border-color: var(--primary);
}
.fs-item.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-soft, rgba(64, 128, 255, 0.08));
  font-weight: 600;
}
</style>
