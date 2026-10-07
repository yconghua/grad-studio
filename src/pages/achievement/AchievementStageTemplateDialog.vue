<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>节点管理 · {{ typeLabel }}</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="tpl-tabs">
          <button
            v-for="(label, key) in TYPE_LABELS"
            :key="key"
            class="tpl-tab"
            :class="{ 'tpl-tab--active': curType === key }"
            @click="switchType(key)"
          >{{ label }}</button>
        </div>

        <div class="tpl-toolbar">
          <button class="btn btn-primary btn-sm" @click="startCreate">新增节点</button>
          <span class="tpl-tip">停用节点：成果时间线隐藏该节点，已填历史保留</span>
        </div>

        <div v-if="groupId > 0" class="tpl-tip tpl-tip--warn">
          本组节点以超管全局节点为基础，新增 / 修改 / 删除仅影响本组，不影响全局。
        </div>

        <!-- 新增/编辑表单 -->
        <div v-if="formVisible" class="tpl-form">
          <div class="form-row">
            <label class="form-label">节点名称 <i style="color:#ef4444">*</i></label>
            <input v-model="form.nodeName" class="input" style="width: 200px" placeholder="如：投稿 / 初审通过" />
          </div>
          <div class="form-row">
            <label class="form-label">节点标识 <i style="color:#ef4444">*</i></label>
            <input v-model="form.nodeKey" class="input" style="width: 160px" placeholder="英文标识，唯一" :disabled="!!form.id" />
            <span class="form-tip">唯一标识，保存后不可改</span>
          </div>
          <div class="form-row">
            <label class="form-label">排序</label>
            <input v-model.number="form.sortOrder" type="number" class="input" style="width: 90px" />
            <span class="form-tip">数字小靠前</span>
          </div>
          <div class="form-row">
            <label class="form-label">启用</label>
            <select v-model="form.enabled" class="input" style="width: 120px">
              <option :value="true">启用</option>
              <option :value="false">停用</option>
            </select>
          </div>
          <div class="tpl-form__actions">
            <button class="btn" @click="formVisible = false">取消</button>
            <button class="btn btn-primary" :disabled="!form.nodeName.trim() || !form.nodeKey.trim() || saving" @click="save">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>

        <!-- 节点列表 -->
        <table class="tbl">
          <thead>
            <tr>
              <th>排序</th>
              <th>节点名称</th>
              <th>标识</th>
              <th>状态</th>
              <th style="width: 180px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in list" :key="t.id">
              <td>{{ t.sortOrder }}</td>
              <td>{{ t.nodeName }}</td>
              <td class="ellipsis" style="max-width: 140px">{{ t.nodeKey }}</td>
              <td><span :class="t.enabled ? 'tag-ok' : 'tag-off'">{{ t.enabled ? '启用' : '停用' }}</span></td>
              <td>
                <button class="btn btn-sm" @click="startEdit(t)">编辑</button>
                <button class="btn btn-sm" @click="toggle(t)">{{ t.enabled ? '停用' : '启用' }}</button>
                <button class="btn btn-sm btn-danger" @click="remove(t)">删除</button>
              </td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="5"><div class="empty">暂无节点，点击「新增节点」创建</div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import {
  listAchievementStageTemplates,
  saveAchievementStageTemplate,
  toggleAchievementStageTemplate,
  removeAchievementStageTemplate
} from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

const props = defineProps({
  visible: { type: Boolean, default: false },
  type: { type: String, default: 'paper' }
})
const emit = defineEmits(['update:visible', 'changed'])

const TYPE_LABELS = { paper: '论文', patent: '专利', software: '软件著作权', award: '获奖', project: '项目', other: '其他' }
const curType = ref(props.type || 'paper')
const typeLabel = computed(() => TYPE_LABELS[curType.value] || curType.value)

const list = ref([])
const groupId = ref(0)
const formVisible = ref(false)
const saving = ref(false)
const form = ref({ id: null, nodeKey: '', nodeName: '', sortOrder: 1, enabled: true })

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)

async function load() {
  const res = await listAchievementStageTemplates(curType.value)
  if (res && res.success) {
    groupId.value = res.data && res.data.groupId
    list.value = (res.data && res.data.list) || []
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

function switchType(t) {
  curType.value = t
  formVisible.value = false
  load()
}

function startCreate() {
  form.value = { id: null, nodeKey: '', nodeName: '', sortOrder: list.value.length + 1, enabled: true }
  formVisible.value = true
}

function startEdit(t) {
  form.value = { id: t.id, nodeKey: t.nodeKey, nodeName: t.nodeName, sortOrder: t.sortOrder, enabled: t.enabled }
  formVisible.value = true
}

async function save() {
  saving.value = true
  try {
    const res = await saveAchievementStageTemplate({
      id: form.value.id,
      type: curType.value,
      nodeKey: form.value.nodeKey.trim(),
      nodeName: form.value.nodeName.trim(),
      sortOrder: form.value.sortOrder,
      enabled: form.value.enabled
    })
    if (res && res.success) {
      formVisible.value = false
      await refreshAfterWrite(form.value.id ? '节点已更新' : '节点已新增')
      load()
      emit('changed')
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function toggle(t) {
  const res = await toggleAchievementStageTemplate(t.id, !t.enabled)
  if (res && res.success) {
    await refreshAfterWrite(t.enabled ? '节点已停用' : '节点已启用')
    load()
    emit('changed')
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function remove(t) {
  const ok = await dialogConfirm(`确定删除节点「${t.nodeName}」？已填写的进度记录仍会保留`)
  if (!ok) return
  const res = await removeAchievementStageTemplate(t.id)
  if (res && res.success) {
    await refreshAfterWrite('节点已删除')
    load()
    emit('changed')
  } else {
    dialogAlert((res && res.message) || '删除失败')
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.tpl-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.tpl-tab {
  padding: 5px 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-card, #fff);
  color: var(--text-2, #6b7280);
  cursor: pointer;
  font-size: 13px;
}
.tpl-tab--active {
  background: var(--primary, #2563eb);
  border-color: var(--primary, #2563eb);
  color: #fff;
}
.tpl-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tpl-tip { font-size: 12px; color: var(--text-3, #9aa0aa); }
.tpl-tip--warn { display: block; margin-bottom: 8px; color: #d97706; }
.tpl-form {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-2, #f9fafb);
}
.form-row { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 6px 0; }
.form-label { width: 76px; font-size: 13px; color: var(--text-2, #6b7280); }
.form-tip { font-size: 12px; color: var(--text-3, #9aa0aa); }
.tpl-form__actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
.btn-danger { color: #dc2626; border-color: #fecaca; }
</style>
