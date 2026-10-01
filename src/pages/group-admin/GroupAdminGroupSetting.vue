<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">课题组设置</h2>
        <p class="page-sub">仅可查看与编辑当前管理员绑定的课题组（不能跨课题组操作）</p>
      </div>
    </div>

    <div class="panel" style="max-width: 640px">
      <p class="panel-title">本课题组信息</p>
      <div class="field">
        <label>唯一标识号（不可修改）</label>
        <input :value="form.code" class="input" readonly />
      </div>
      <div class="field">
        <label>课题组名称</label>
        <input v-model.trim="form.name" class="input" placeholder="请输入课题组名称" maxlength="100" />
      </div>
      <div class="field">
        <label>描述</label>
        <textarea v-model.trim="form.description" placeholder="请输入课题组描述（选填）" maxlength="500"></textarea>
      </div>
      <div class="field">
        <label>课题组管理员</label>
        <input :value="user ? user.realName || user.username : ''" class="input" readonly />
        <p class="hint">管理员由超级管理员指定，此处不可修改</p>
      </div>
      <div class="field">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getOwnGroup, updateOwnGroup } from '../../api'
import { dialogAlert } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'
import { useSession } from '../../composables/useSession'

// 课题组管理员独立页面：本课题组设置（UUID 与管理员绑定不可修改）
const { getSessionUser } = useSession()
const user = getSessionUser()

const saving = ref(false)
const form = reactive({ name: '', description: '', code: '' })

async function load() {
  const res = await getOwnGroup()
  if (!res || !res.success) {
    dialogAlert((res && res.message) || '加载课题组失败')
    return
  }
  form.name = res.data.name || ''
  form.description = res.data.description || ''
  form.code = res.data.code || ''
}

async function save() {
  if (!form.name) return dialogAlert('请输入课题组名称')
  saving.value = true
  try {
    const res = await updateOwnGroup({ name: form.name, description: form.description })
    if (res && res.success) {
      await refreshAfterWrite('保存成功')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
