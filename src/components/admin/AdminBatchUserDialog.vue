<template>
  <!-- 批量新增用户弹窗（超管用户管理页：上传 CSV / 粘贴 CSV 文本 → 预览校验 → 提交） -->
  <div v-if="visible" class="modal-mask" @click.self="close">
    <div class="modal lg">
      <div class="modal-head">
        <h3>批量新增用户</h3>
        <button type="button" class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="tabs">
          <button type="button" class="tab" :class="{ active: batchTab === 'upload' }" @click="batchTab = 'upload'">上传 CSV</button>
          <button type="button" class="tab" :class="{ active: batchTab === 'paste' }" @click="batchTab = 'paste'">粘贴 CSV 文本</button>
        </div>

        <template v-if="batchTab === 'upload'">
          <p class="hint" style="margin-bottom: 8px">先下载模板填写，再上传 CSV。每行一个用户，密码统一为角色默认密码，模板不含密码列。</p>
          <div style="display: flex; gap: 10px; align-items: center">
            <button type="button" class="btn btn-sm" :disabled="batchLoading" @click="downloadTemplate">下载模板</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="batchLoading" @click="triggerFile">选择 CSV 文件</button>
            <input ref="csvFileInput" type="file" accept=".csv" style="display: none" @change="onFileChange" />
          </div>
          <div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-muted); border-radius: var(--radius-sm); font-size: 12px; line-height: 1.9; color: var(--text-2)">
            <div style="font-weight: 600; color: var(--text); margin-bottom: 4px">填写说明（表头必须保留，每行一个用户）：</div>
            <div>· <b>必填</b>：用户名（最长 50 字，全局唯一）、角色（只能填 导师 / 学生 / 课题组管理员 三种之一）</div>
            <div>· <b>选填</b>：真实姓名（≤50 字）、手机号（≤20 字）、邮箱（≤100 字）、性别（男 / 女 / 其他，留空按未设置）</div>
            <div>· 所属课题组：填系统内的课题组名称，按名称精确匹配；不存在或名称不唯一时该行导入失败</div>
            <div>· 导师：填导师的用户名，仅学生行有效，且导师必须属于该学生填写的所属课题组；非学生行填写会被忽略</div>
            <div>· 启用状态：填 启用 / 禁用，留空默认启用；学生指定导师时必须同时填写所属课题组</div>
            <div>· 密码：统一为该角色默认密码，模板不含密码列，请提醒用户首次登录后尽快修改；单次最多 500 行</div>
          </div>
        </template>

        <template v-else>
          <p class="hint" style="margin-bottom: 8px">从 Excel 复制后粘贴（保留表头），每行一个用户。</p>
          <textarea
            v-model="pasteText"
            class="input"
            rows="6"
            style="width: 640px; max-width: 100%; min-height: 220px; resize: vertical; font-family: monospace; font-size: 12px"
            placeholder="用户名,真实姓名,角色,手机号,邮箱,性别,所属课题组,导师,启用状态"
          ></textarea>
          <div style="margin-top: 8px">
            <button type="button" class="btn btn-primary btn-sm" :disabled="batchLoading" @click="doParsePaste">解析预览</button>
          </div>
        </template>

        <template v-if="previewRows.length">
          <div style="margin-top: 14px; margin-bottom: 8px; font-size: 13px; color: var(--text)">
            共 <b>{{ previewStats.total }}</b> 行，可用 <b style="color: var(--success)">{{ previewStats.ok }}</b> 行，错误 <b style="color: var(--danger)">{{ previewStats.err }}</b> 行
            <span style="color: var(--text-3); margin-left: 8px">仅勾选且校验通过的行会提交；错误行需修改外部文件后重新导入</span>
          </div>
          <div class="tbl-wrap">
            <table v-resizable-columns class="tbl tbl-fixed">
              <thead>
                <tr>
                  <th style="width: 36px"><input type="checkbox" :checked="allPreviewChecked" @change="toggleAllPreview" /></th>
                  <th style="width: 50px">行号</th>
                  <th style="width: 50px">账号</th>
                  <th style="width: 50px">姓名</th>
                  <th style="width: 50px">角色</th>
                  <th style="width: 50px">手机</th>
                  <th style="width: 50px">邮箱</th>
                  <th style="width: 50px">性别</th>
                  <th style="width: 76px">课题组</th>
                  <th style="width: 50px">导师</th>
                  <th style="width: 50px">状态</th>
                  <th style="width: 60px">校验</th>
                  <th style="width: 44px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in previewRows" :key="i">
                  <td @click.stop><input type="checkbox" :value="i" v-model="checkedIdx" :disabled="r.errors.length > 0" /></td>
                  <td>{{ r.row }}</td>
                  <td class="ellipsis" :title="r.username">{{ r.username }}</td>
                  <td class="ellipsis" :title="r.realName">{{ r.realName || '-' }}</td>
                  <td class="ellipsis" :title="r.roleText">{{ r.roleText || '-' }}</td>
                  <td class="ellipsis" :title="r.phone">{{ r.phone || '-' }}</td>
                  <td class="ellipsis" :title="r.email">{{ r.email || '-' }}</td>
                  <td>{{ r.genderText || '-' }}</td>
                  <td class="ellipsis" :title="r.groupName">{{ r.groupName || '-' }}</td>
                  <td class="ellipsis" :title="r.mentorUsername">{{ r.mentorUsername || '-' }}</td>
                  <td>{{ r.statusText || '启用' }}</td>
                  <td>
                    <span v-if="r.errors.length" class="ellipsis" :title="r.errors.join('；')" style="display: block; color: var(--danger); font-size: 12px">{{ r.errors.join('；') }}</span>
                    <span v-else-if="r.warnings.length" class="ellipsis" :title="r.warnings.join('；')" style="display: block; color: var(--warning); font-size: 12px">{{ r.warnings.join('；') }}</span>
                    <span v-else style="color: var(--success); font-size: 12px">可导入</span>
                  </td>
                  <td>
                    <button type="button" class="btn btn-sm" style="padding: 0 5px" title="删除该行" @click="removePreviewRow(i)">×</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="close">取消</button>
        <button
          class="btn btn-primary"
          :disabled="batchLoading || !previewRows.length || checkedIdx.length === 0"
          @click="submitBatch"
        >
          {{ batchLoading ? '导入中…' : `导入勾选的 ${checkedIdx.length} 条` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { downloadCsvTemplate, listAllUsernames, batchCreateUsers } from '../../api'
import { parseCsvFile, parseCsvText, validatePreviewRows } from '../../utils/csvImport'
import { dialogAlert, dialogConfirm } from '../../composables/useDialog'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const batchTab = ref('upload')
const batchLoading = ref(false)
const pasteText = ref('')
const previewRows = ref([])
const checkedIdx = ref([])
const csvFileInput = ref(null)

const previewStats = computed(() => {
  const total = previewRows.value.length
  const ok = previewRows.value.filter((r) => !r.errors.length).length
  return { total, ok, err: total - ok }
})
const allPreviewChecked = computed(
  () => previewRows.value.length > 0 && checkedIdx.value.length === previewRows.value.filter((r) => !r.errors.length).length
)

// 打开弹窗：重置全部状态
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    previewRows.value = []
    checkedIdx.value = []
    pasteText.value = ''
    batchTab.value = 'upload'
  }
)

function close() {
  emit('update:visible', false)
}

// 下载模板：主进程保存对话框 + 写 UTF-8 BOM CSV
async function downloadTemplate() {
  batchLoading.value = true
  try {
    const res = await downloadCsvTemplate()
    if (res && res.success) {
      if (!(res.data && res.data.canceled)) dialogAlert('模板已保存')
    } else {
      dialogAlert((res && res.message) || '下载模板失败')
    }
  } finally {
    batchLoading.value = false
  }
}

function triggerFile() {
  csvFileInput.value && csvFileInput.value.click()
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.name && !/\.csv$/i.test(file.name)) return dialogAlert('仅支持 CSV 文件')
  const { rows, headerError } = await parseCsvFile(file)
  applyPreview(rows, headerError)
}

function doParsePaste() {
  if (!pasteText.value.trim()) return dialogAlert('请先粘贴 CSV 文本')
  const { rows, headerError } = parseCsvText(pasteText.value)
  applyPreview(rows, headerError)
}

// 解析成功后统一进入预览：行数限制 → 拉现有用户名预检 → 校验 → 默认全选可用行
async function applyPreview(rows, headerError) {
  if (headerError) return dialogAlert(headerError)
  if (rows.length === 0) return dialogAlert('文件中没有数据行')
  if (rows.length > 500) return dialogAlert('单次最多 500 行，请分批导入')
  const res = await listAllUsernames()
  validatePreviewRows(rows, res && res.success ? res.data || [] : [])
  previewRows.value = rows
  checkedIdx.value = rows.map((r, i) => (r.errors.length ? -1 : i)).filter((i) => i >= 0)
}

function toggleAllPreview(e) {
  checkedIdx.value = e.target.checked
    ? previewRows.value.map((r, i) => (r.errors.length ? -1 : i)).filter((i) => i >= 0)
    : []
}

function removePreviewRow(i) {
  previewRows.value.splice(i, 1)
  // 删除后重新全选可用行（用户可再取消勾选）
  checkedIdx.value = previewRows.value.map((r, idx) => (r.errors.length ? -1 : idx)).filter((x) => x >= 0)
}

async function submitBatch() {
  // JSON 深拷贝展开为纯普通对象：Vue ref 数组的元素是响应式 Proxy，
  // 嵌套的 errors/warnings 数组也是 Proxy，contextBridge 参数克隆会失败
  const rows = previewRows.value
    .filter((r, i) => checkedIdx.value.includes(i))
    .map((r) => JSON.parse(JSON.stringify(r)))
  if (rows.length === 0) return dialogAlert('请先勾选要导入的行')
  const ok = await dialogConfirm(`确认导入选中的 ${rows.length} 个用户？新用户初始密码为该角色默认密码。`)
  if (!ok) return
  batchLoading.value = true
  try {
    const res = await batchCreateUsers([...rows])
    if (res && res.success) {
      const d = res.data || {}
      const parts = [`成功导入 ${d.successCount || 0} 条`]
      if (d.failCount) parts.push(`失败 ${d.failCount} 条`)
      const reasons = (d.failList || [])
        .map((f) => `第 ${f.row} 行${f.username && f.username !== '-' ? `（${f.username}）` : ''}：${f.reason}`)
        .join('；')
      if (reasons) parts.push(reasons.slice(0, 120))
      parts.push('新用户初始密码为该角色默认密码，请提醒用户首次登录后尽快修改')
      emit('saved', parts.join('，'))
      close()
    } else {
      dialogAlert((res && res.message) || '批量导入失败')
    }
  } finally {
    batchLoading.value = false
  }
}
</script>
