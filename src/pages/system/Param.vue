<template>
  <div class="param-page">
    <!-- 登录引导开关（管理员快捷配置） -->
    <div class="guide-card">
      <div class="guide-info">
        <div class="guide-title">登录引导</div>
        <div class="guide-desc">是否在用户登录后显示角色引导说明（学生 / 导师 / 管理员各有专属步骤，每个用户只看一次）</div>
      </div>
      <div class="guide-ctrl">
        <select v-model="guideEnabled" class="guide-select">
          <option value="1">开启</option>
          <option value="0">关闭</option>
        </select>
        <button class="btn btn-primary" @click="saveGuide" :disabled="savingGuide">{{ savingGuide ? '保存中…' : '保存' }}</button>
      </div>
    </div>

    <!-- 参数列表（通用 CRUD） -->
    <CrudPage v-bind="config" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CrudPage from '../../components/CrudPage.vue'
import { system } from '../../api'
import { useRole } from '../../composables/useRole'
import { dialogAlert } from '../../composables/useDialog'

const { isManager } = useRole()

const config = {
  title: '系统参数',
  api: system.param,
  searchField: 'param_key',
  searchLabel: '参数键',
  writable: isManager,
  columns: [
    { label: '参数键', key: 'param_key' },
    { label: '参数值', key: 'param_value' },
    { label: '说明', key: 'description' }
  ],
  formFields: [
    { label: '参数键', key: 'param_key', required: true },
    { label: '参数值', key: 'param_value', type: 'textarea' },
    { label: '说明', key: 'description' }
  ]
}

// 登录引导开关
const guideEnabled = ref('1')
const savingGuide = ref(false)

onMounted(async () => {
  try {
    const r = await system.getParam('guide_enabled')
    if (r && r.success && r.value !== null && r.value !== undefined) {
      guideEnabled.value = String(r.value)
    }
  } catch (e) {
    console.error('[param.guide] 读取引导开关失败:', e)
  }
})

async function saveGuide() {
  savingGuide.value = true
  try {
    const r = await system.setParam('guide_enabled', guideEnabled.value, '是否启用登录引导（1开启 / 0关闭，每个用户只看一次）')
    if (r && r.success) {
      await dialogAlert('已保存：登录引导已' + (guideEnabled.value === '1' ? '开启' : '关闭'))
    } else {
      await dialogAlert((r && r.message) || '保存失败')
    }
  } catch (e) {
    await dialogAlert('保存过程出现异常，请重试')
  } finally {
    savingGuide.value = false
  }
}
</script>

<style scoped>
.param-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.guide-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: linear-gradient(135deg, #eef5ff 0%, #e6f7ec 100%);
  border: 1px solid #d6ebff;
  border-radius: 12px;
  padding: 14px 18px;
}
.guide-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}
.guide-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #5c6b7a;
}
.guide-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.guide-select {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  background: #fff;
}
.btn {
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:hover {
  opacity: 0.92;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
