<template>
  <!-- 新增 / 编辑课题组弹窗（超管课题组设置页） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal">
      <div class="modal-head">
        <h3>{{ isEdit ? '编辑课题组' : '新增课题组' }}</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="field" v-if="isEdit">
          <label>唯一标识号（不可修改）</label>
          <input :value="form.code" class="input" readonly />
        </div>
        <div class="field">
          <label>课题组名称</label>
          <input v-model.trim="form.name" class="input" placeholder="请输入课题组名称" maxlength="100" />
          <p class="hint">不超过 100 个字符</p>
        </div>
        <div class="field">
          <label>描述</label>
          <textarea v-model.trim="form.description" placeholder="请输入课题组描述（选填）" maxlength="500"></textarea>
          <p class="hint">不超过 500 个字符</p>
        </div>
        <div class="field">
          <label>课题组管理员（从已有用户中选择，一个管理员只能管理一个课题组）</label>
          <select v-model="form.adminUserId" class="select">
            <option value="">{{ isEdit ? '暂不指定' : '请选择课题组管理员' }}</option>
            <option v-for="a in admins" :key="a.id" :value="a.id" :disabled="a.groupId !== null && a.groupId !== form.groupId">
              {{ a.realName || a.username }}{{ a.groupId ? '（已绑定课题组）' : '' }}
            </option>
          </select>
          <p v-if="!isEdit" class="hint">新建课题组必须指定管理员</p>
        </div>
        <div class="field">
          <label>状态</label>
          <select v-model="form.status" class="select">
            <option :value="1">启用</option>
            <option :value="0">禁用</option>
          </select>
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
import { createGroup, updateGroup, getGroup } from '../../api'
import { dialogAlert } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  isEdit: { type: Boolean, default: false },
  editId: { type: [Number, String], default: null },
  admins: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'saved'])

const saving = ref(false)
const form = reactive({ name: '', description: '', adminUserId: '', status: 1, code: '', groupId: null })

// 打开弹窗：编辑时按 editId 加载课题组数据，新建时重置表单
watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    if (props.isEdit && props.editId != null) {
      const res = await getGroup(props.editId)
      if (!res || !res.success) {
        dialogAlert((res && res.message) || '加载课题组失败')
        close()
        return
      }
      const d = res.data
      Object.assign(form, {
        name: d.name,
        description: d.description || '',
        adminUserId: d.adminUserId === null ? '' : d.adminUserId,
        status: d.status,
        code: d.code,
        groupId: d.id
      })
    } else {
      Object.assign(form, { name: '', description: '', adminUserId: '', status: 1, code: '', groupId: null })
    }
  }
)

function close() {
  emit('update:visible', false)
}

async function save() {
  if (!form.name) return dialogAlert('请输入课题组名称')
  // 新建课题组必须指定管理员；编辑时允许暂不更换
  if (!props.isEdit && !form.adminUserId) return dialogAlert('请选择课题组管理员')
  saving.value = true
  try {
    const data = {
      name: form.name,
      description: form.description,
      adminUserId: form.adminUserId === '' ? null : Number(form.adminUserId),
      status: Number(form.status)
    }
    const res = props.isEdit ? await updateGroup(props.editId, data) : await createGroup(data)
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
