<template>
  <!-- 新增 / 编辑系统参数弹窗（超管系统配置页） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>{{ isEdit ? '编辑系统参数' : '新增系统参数' }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>参数键</label>
          <input v-model.trim="form.configKey" class="input" placeholder="例如 system.name" maxlength="100" />
          <p class="hint">不超过 100 个字符</p>
        </div>
        <div class="field">
          <label>参数值</label>
          <input v-if="form.configType === 'number'" v-model="form.configValue" class="input" type="number" placeholder="请输入数字" />
          <select v-else-if="form.configType === 'boolean'" v-model="form.configValue" class="select">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <textarea v-else v-model="form.configValue" :placeholder="form.configType === 'json' ? '请输入合法 JSON' : '请输入参数值'"></textarea>
        </div>
        <div class="field">
          <label>参数类型</label>
          <select v-model="form.configType" class="select">
            <option value="string">string（字符串）</option>
            <option value="number">number（数字）</option>
            <option value="boolean">boolean（布尔）</option>
            <option value="json">json（JSON）</option>
          </select>
          <p class="hint">参数值将按所选类型进行校验与保存</p>
        </div>
        <div class="field">
          <label>描述</label>
          <input v-model.trim="form.description" class="input" placeholder="参数描述（选填）" maxlength="255" />
          <p class="hint">不超过 255 个字符</p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { createParam, updateParam } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  editId: { type: [Number, String], default: null },
  initial: { type: Object, default: null }
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const form = reactive({ configKey: '', configValue: '', configType: 'string', description: '' })

// 打开弹窗：用父级传入的 initial 初始化（编辑用行数据，新建重置）
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    const d = props.initial || {}
    Object.assign(form, {
      configKey: d.configKey || '',
      configValue: d.configValue || '',
      configType: d.configType || 'string',
      description: d.description || ''
    })
  }
)

function close() {
  emit('update:visible', false)
}

async function save() {
  if (!form.configKey) return dialogAlert('请输入参数键')
  saving.value = true
  try {
    const data = {
      configKey: form.configKey,
      configValue: form.configValue,
      configType: form.configType,
      description: form.description
    }
    const res = props.isEdit ? await updateParam(props.editId, data) : await createParam(data)
    if (res && res.success) {
      emit('saved')
      close()
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}
</script>
