<template>
  <div class="page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">⚙️ 课题组设置</h2>
        <p class="page-desc">维护课题组基本信息与配置项（仅课题组管理员）。</p>
      </div>
      <div class="ph-right">
        <button class="btn btn-primary" :disabled="saving" @click="onSave">
          {{ saving ? '保存中…' : '保存全部配置' }}
        </button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="empty-block"><p>请先选择/输入课题组ID</p></div>

    <div v-else class="card">
      <div v-if="loading" class="empty-block"><p>加载中…</p></div>

      <template v-else>
        <div v-if="errorMsg" class="error-block">{{ errorMsg }}</div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:220px">配置键</th>
                <th>配置值</th>
                <th style="width:260px">配置说明</th>
                <th style="width:70px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in rows" :key="idx">
                <td>
                  <input v-model="row.config_key" class="form-input" placeholder="如 weekly_deadline" :disabled="row.existing" />
                </td>
                <td>
                  <input v-model="row.config_value" class="form-input" placeholder="配置值" />
                </td>
                <td>
                  <input v-model="row.description" class="form-input" placeholder="配置说明" />
                </td>
                <td class="col-actions">
                  <button v-if="!row.existing" class="btn btn-danger" @click="removeRow(idx)">删除</button>
                  <span v-else class="lock-tip">已保存</span>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="4" class="empty-block">📭 暂无配置项，点击下方「添加配置项」</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer">
          <button class="btn btn-ghost" @click="addRow">＋ 添加配置项</button>
          <span class="save-tip">{{ saveTip }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { getGroupSetting, updateGroupSetting } from '../../api'
import { useGroupContext } from '../../composables/useGroupContext'

const { currentGroupId, loadGroups } = useGroupContext()

const rows = ref([])
const loading = ref(false)
const errorMsg = ref('')
const saving = ref(false)
const saveTip = ref('')

async function loadSettings() {
  if (!currentGroupId.value) { rows.value = []; return }
  loading.value = true
  errorMsg.value = ''
  saveTip.value = ''
  try {
    const res = await getGroupSetting(currentGroupId.value)
    if (res && res.success) {
      rows.value = (res.list || []).map((r) => ({
        config_key: r.config_key,
        config_value: r.config_value || '',
        description: r.description || '',
        existing: true
      }))
    } else {
      rows.value = []
      errorMsg.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    rows.value = []
    errorMsg.value = '网络错误，加载失败'
  } finally {
    loading.value = false
  }
}

function addRow() {
  rows.value.push({ config_key: '', config_value: '', description: '', existing: false })
}

function removeRow(idx) {
  rows.value.splice(idx, 1)
}

async function onSave() {
  saving.value = true
  saveTip.value = ''
  let okCount = 0
  const failMsgs = []
  for (const row of rows.value) {
    const key = (row.config_key || '').trim()
    if (!key) continue
    try {
      const res = await updateGroupSetting({
        group_id: currentGroupId.value,
        config_key: key,
        config_value: row.config_value,
        description: row.description
      })
      if (res && res.success) okCount += 1
      else failMsgs.push(res && res.message ? res.message : key + ' 保存失败')
    } catch (e) {
      failMsgs.push(key + ' 网络错误')
    }
  }
  saving.value = false
  if (failMsgs.length) {
    saveTip.value = `成功 ${okCount} 项；失败：${failMsgs.join('；')}`
  } else {
    saveTip.value = `已保存 ${okCount} 项配置`
  }
  loadSettings()
}

watch(currentGroupId, () => { loadSettings() })

onMounted(() => {
  loadGroups()
  loadSettings()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: flex-end; gap: 14px; }
.page-title { font-size: 18px; font-weight: 600; color: #1f2329; margin: 0; }
.page-desc { margin: 0 0 3px; font-size: 13px; color: #8a9099; }
.ph-right { display: flex; align-items: center; gap: 10px; }

.card {
  background: #fff; border: 1px solid #eceff3; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04); overflow: hidden;
}
.empty-block { padding: 40px 20px; text-align: center; color: #8a9099; font-size: 14px; }
.error-block { padding: 24px; text-align: center; color: #ea4335; font-size: 14px; }

.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background: #f7f9fc; color: #4e5969; font-weight: 600;
  text-align: left; padding: 10px 12px; border-bottom: 1px solid #eceff3;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.col-actions { white-space: nowrap; text-align: center; }
.lock-tip { font-size: 12px; color: #8a9099; }

.card-footer {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 16px; border-top: 1px solid #eceff3;
}
.save-tip { font-size: 13px; color: #4e5969; }

.btn {
  height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px;
  cursor: pointer; border: 1px solid #dfe3e8; background: #fff; color: #1f2329;
}
.btn-primary { background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%); border: none; color: #fff; font-weight: 600; height: 32px; }
.btn-ghost { background: #fff; color: #4e5969; }
.btn-ghost:hover { border-color: #0d80e0; color: #0d80e0; }
.btn-danger { background: #fff; color: #ea4335; border-color: #f5c6c2; }
.btn-danger:hover { background: #ea4335; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.form-input {
  width: 100%; box-sizing: border-box; border: 1px solid #dfe3e8; border-radius: 8px;
  padding: 7px 10px; font-size: 13px; outline: none; color: #1f2329; background: #fff; height: 34px;
}
.form-input:focus { border-color: #0d80e0; }
.form-input:disabled { background: #f5f7fa; color: #8a9099; }
</style>
