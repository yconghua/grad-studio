<template>
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>{{ title }} · {{ stageTypeLabel }}</h3>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="tpl-tabs">
          <button
            v-for="(label, key) in STAGE_LABELS"
            :key="key"
            class="tpl-tab"
            :class="{ 'tpl-tab--active': curType === key }"
            @click="switchType(key)"
          >{{ label }}</button>
        </div>

        <div class="tpl-toolbar">
          <button class="btn btn-primary btn-sm" @click="startCreate">新增节点</button>
          <span class="tpl-tip">停用节点：学生时间线隐藏该节点，已填历史保留</span>
        </div>

        <div v-if="groupId > 0" class="tpl-tip tpl-tip--warn">
          本组模板以全局默认模板为基础，新增 / 修改 / 删除节点仅影响本组，不影响全局。
        </div>

        <!-- 新增/编辑表单 -->
        <div v-if="formVisible" class="tpl-form">
          <div class="form-row">
            <label class="form-label">节点名称 <i style="color:#ef4444">*</i></label>
            <input v-model="form.nodeName" class="input" style="width: 200px" placeholder="如：开题报告" />
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
            <label class="form-label">必填</label>
            <select v-model="form.required" class="input" style="width: 120px">
              <option :value="true">必填</option>
              <option :value="false">选填</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">期望学期</label>
            <input v-model.number="form.planTerm" type="number" min="1" class="input" style="width: 90px" placeholder="不限" />
            <span class="form-tip">第几学期，可留空</span>
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

        <!-- 模板列表 -->
        <table class="tbl">
          <thead>
            <tr>
              <th>排序</th>
              <th>节点名称</th>
              <th>标识</th>
              <th>必填</th>
              <th>期望学期</th>
              <th>状态</th>
              <th style="width: 150px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in list" :key="t.id">
              <td>{{ t.sortOrder }}</td>
              <td>{{ t.nodeName }}</td>
              <td class="ellipsis" style="max-width: 120px">{{ t.nodeKey }}</td>
              <td>{{ t.required ? '必填' : '选填' }}</td>
              <td>{{ t.planTerm ? `第${t.planTerm}学期` : '-' }}</td>
              <td><span :class="t.enabled ? 'tag-ok' : 'tag-off'">{{ t.enabled ? '启用' : '停用' }}</span></td>
              <td>
                <button class="btn btn-sm" @click="startEdit(t)">编辑</button>
                <button class="btn btn-sm" @click="toggle(t)">{{ t.enabled ? '停用' : '启用' }}</button>
                <button class="btn btn-sm btn-danger" @click="remove(t)">删除</button>
              </td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="7"><div class="empty">暂无节点，点击「新增节点」创建</div></td>
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
import { getAcademicTemplates, saveAcademicTemplate, toggleAcademicTemplate, removeAcademicTemplate } from '../../api'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'
import { refreshAfterWrite } from '../../composables/useGlobalRefresh'

const props = defineProps({
  visible: { type: Boolean, default: false },
  stageType: { type: String, default: 'master' }
})
const emit = defineEmits(['update:visible', 'changed'])

const STAGE_LABELS = { master: '硕士', doctor: '博士', bachelor: '本科' }
const curType = ref(props.stageType || 'master')
const stageTypeLabel = computed(() => STAGE_LABELS[curType.value] || curType.value)
const title = '配置阶段模板'

const list = ref([])
const groupId = ref(0)
const formVisible = ref(false)
const form = ref({ id: null, nodeName: '', nodeKey: '', sortOrder: 0, required: true, planTerm: null, enabled: true })
const saving = ref(false)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      curType.value = props.stageType || 'master'
      formVisible.value = false
      load()
    }
  }
)

async function load() {
  const res = await getAcademicTemplates(curType.value)
  if (res && res.success) {
    list.value = (res.data && res.data.list) || []
    groupId.value = (res.data && res.data.groupId) || 0
  } else {
    dialogAlert((res && res.message) || '加载失败')
  }
}

// 切换培养类型：重置表单并重新加载对应类型模板
function switchType(key) {
  if (curType.value === key) return
  curType.value = key
  formVisible.value = false
  load()
}

function startCreate() {
  form.value = { id: null, nodeName: '', nodeKey: '', sortOrder: list.value.length + 1, required: true, planTerm: null, enabled: true }
  formVisible.value = true
}
function startEdit(t) {
  form.value = {
    id: t.id,
    nodeName: t.nodeName,
    nodeKey: t.nodeKey,
    sortOrder: t.sortOrder,
    required: t.required,
    planTerm: t.planTerm,
    enabled: t.enabled
  }
  formVisible.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = {
      id: form.value.id,
      stageType: curType.value,
      nodeName: form.value.nodeName.trim(),
      nodeKey: form.value.nodeKey.trim(),
      sortOrder: form.value.sortOrder,
      required: form.value.required,
      planTerm: form.value.planTerm,
      enabled: form.value.enabled
    }
    const res = await saveAcademicTemplate(payload)
    if (res && res.success) {
      formVisible.value = false
      await refreshAfterWrite('模板已保存')
      emit('changed')
      load()
    } else {
      dialogAlert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function toggle(t) {
  const res = await toggleAcademicTemplate(t.id, !t.enabled)
  if (res && res.success) {
    await refreshAfterWrite(t.enabled ? '已停用' : '已启用')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

async function remove(t) {
  const ok = await dialogConfirm(`确认删除「${t.nodeName}」？\n（停用即可隐藏且保留学生历史，删除将彻底移除模板）`)
  if (!ok) return
  const res = await removeAcademicTemplate(t.id)
  if (res && res.success) {
    await refreshAfterWrite('已删除')
    emit('changed')
    load()
  } else {
    dialogAlert((res && res.message) || '操作失败')
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.form-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px 12px;
  padding: 8px 0;
}
.form-label {
  width: 90px;
  flex-shrink: 0;
  font-size: 14px;
  color: var(--text-2, #6b7280);
  line-height: 34px;
}
.tpl-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tpl-tab {
  padding: 5px 18px;
  font-size: 13px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 16px;
  background: transparent;
  color: var(--text-2, #6b7280);
  cursor: pointer;
}
.tpl-tab--active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.tpl-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.tpl-tip { font-size: 12px; color: var(--text-3, #9aa0aa); }
.tpl-tip--warn {
  display: block;
  margin: 0 0 10px;
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  color: #92400e;
}
.tpl-form {
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.tpl-form__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.form-tip {
  flex: 1 1 100%;
  padding-left: 102px;
  font-size: 12px;
  color: var(--text-3, #9aa0aa);
  line-height: 18px;
}
.tag-ok { background: #ecfdf5; color: #16a34a; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.tag-off { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.btn-danger { color: #dc2626; border-color: #fecaca; }
</style>
