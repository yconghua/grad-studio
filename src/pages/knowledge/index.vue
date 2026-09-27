<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">📖 课题组知识库</h2>
        <p class="page-desc">组内共享资料目录与文件，学生只读，组管 / 导师可维护。</p>
      </div>
      <div class="head-actions">
        <GroupSelector />
        <button v-if="isManager" class="btn primary" @click="openNodeModal()">＋ 新建目录</button>
      </div>
    </div>

    <div v-if="!currentGroupId" class="card state">请先在右上角设置课题组 ID。</div>

    <div v-else class="body">
      <!-- 左：目录树 -->
      <div class="card tree-col">
        <div v-if="treeLoading" class="state">加载中…</div>
        <div v-else-if="treeError" class="state error">{{ treeError }}</div>
        <div v-else-if="!flatNodes.length" class="state">该课题组暂无知识库目录。</div>
        <div v-else class="node-list">
          <div
            v-for="n in flatNodes" :key="n.id"
            class="node-item" :class="{ active: selectedId === n.id }"
            :style="{ paddingLeft: (12 + n.depth * 18) + 'px' }"
            @click="selectNode(n)"
          >
            <span class="node-icon">{{ n.node_type === 'folder' ? '📁' : '📄' }}</span>
            <span class="node-name">{{ n.name }}</span>
            <button v-if="isManager && selectedId === n.id" class="link danger" @click.stop="onRemoveNode(n)">删除</button>
          </div>
        </div>
      </div>

      <!-- 右：文件列表 -->
      <div class="card file-col">
        <template v-if="selected">
          <div class="file-head">
            <div>
              <h3 class="file-title">
                {{ selected.node_type === 'folder' ? '📁' : '📄' }} {{ selected.name }}
              </h3>
              <p v-if="selected.description" class="file-desc">{{ selected.description }}</p>
            </div>
            <button v-if="isManager" class="btn primary sm" @click="onUploadFile">＋ 上传文件</button>
          </div>
          <div v-if="fileLoading" class="state">加载文件…</div>
          <div v-else-if="!files.length" class="state">该节点下暂无文件。</div>
          <table v-else class="tbl">
            <thead>
              <tr><th>文件名</th><th>类型</th><th>大小</th><th>上传时间</th><th style="width:120px">操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in files" :key="f.id">
                <td class="file-name">{{ f.title }}</td>
                <td><span class="tag">{{ f.file_type || '—' }}</span></td>
                <td class="muted">{{ formatSize(f.file_size) }}</td>
                <td class="nowrap muted">{{ fmtTime(f.created_at) }}</td>
                <td>
                  <button v-if="f.file_path" class="link" @click="onOpenFile(f.file_path)">打开</button>
                  <button v-if="isManager" class="link danger" @click="onRemoveFile(f)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
        <div v-else class="empty-note">
          <div class="empty-icon">🗂️</div>
          <p>从左侧选择目录或文档节点，查看其下文件</p>
        </div>
      </div>
    </div>

    <!-- 新建目录弹窗（仅组管/导师） -->
    <div v-if="nodeModal.show" class="modal-mask" @click.self="nodeModal.show = false">
      <div class="modal-box">
        <h3 class="modal-title">新建知识库目录</h3>
        <label class="form-item">
          <span class="form-label">名称 <i>*</i></span>
          <input type="text" v-model="nodeModal.form.name" />
        </label>
        <label class="form-item">
          <span class="form-label">类型</span>
          <select v-model="nodeModal.form.node_type">
            <option value="folder">文件夹</option>
            <option value="doc">文档</option>
          </select>
        </label>
        <label class="form-item">
          <span class="form-label">说明</span>
          <textarea rows="2" v-model="nodeModal.form.description"></textarea>
        </label>
        <p v-if="nodeModal.error" class="form-error">{{ nodeModal.error }}</p>
        <div class="modal-actions">
          <button class="btn" @click="nodeModal.show = false">取消</button>
          <button class="btn primary" :disabled="nodeModal.saving" @click="onSaveNode">
            {{ nodeModal.saving ? '保存中…' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import {
  listKnowledge, createKnowledge, removeKnowledge,
  listKnowledgeFiles, uploadKnowledgeFile, removeKnowledgeFile,
  pickAttachment, openAttachment
} from '../../api'
import GroupSelector from '../../components/GroupSelector.vue'
import { useGroupContext } from '../../composables/useGroupContext'
import { useRole } from '../../composables/useRole'

const { currentGroupId } = useGroupContext()
const { isManager } = useRole()

const tree = ref([])
const flatNodes = ref([])
const treeLoading = ref(false)
const treeError = ref('')
const selectedId = ref(null)
const selected = ref(null)

const files = ref([])
const fileLoading = ref(false)

const nodeModal = ref({
  show: false, saving: false, error: '',
  form: { name: '', node_type: 'folder', description: '' }
})

function flatten(nodes, depth = 0, out = []) {
  nodes.forEach((n) => {
    out.push({ ...n, depth })
    if (n.children && n.children.length) flatten(n.children, depth + 1, out)
  })
  return out
}

async function loadTree() {
  if (!currentGroupId.value) return
  treeLoading.value = true
  treeError.value = ''
  selectedId.value = null
  selected.value = null
  files.value = []
  try {
    const res = await listKnowledge(currentGroupId.value)
    if (res && res.success) {
      tree.value = res.data || []
      flatNodes.value = flatten(tree.value)
    } else {
      treeError.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    treeError.value = '网络异常，请重试'
  } finally {
    treeLoading.value = false
  }
}

async function selectNode(n) {
  selectedId.value = n.id
  selected.value = n
  fileLoading.value = true
  files.value = []
  try {
    const res = await listKnowledgeFiles(n.id)
    if (res && res.success) files.value = res.data || []
  } catch (e) {
    files.value = []
  } finally {
    fileLoading.value = false
  }
}

function openNodeModal() {
  nodeModal.value.error = ''
  nodeModal.value.form = { name: '', node_type: 'folder', description: '' }
  nodeModal.value.show = true
}

async function onSaveNode() {
  const f = nodeModal.value.form
  if (!f.name || !f.name.trim()) { nodeModal.value.error = '请填写名称'; return }
  nodeModal.value.saving = true
  nodeModal.value.error = ''
  try {
    const res = await createKnowledge({
      group_id: currentGroupId.value,
      parent_id: 0,
      name: f.name, node_type: f.node_type, description: f.description
    })
    if (res && res.success) {
      nodeModal.value.show = false
      await loadTree()
    } else {
      nodeModal.value.error = (res && res.message) || '创建失败'
    }
  } catch (e) {
    nodeModal.value.error = '网络异常，请重试'
  } finally {
    nodeModal.value.saving = false
  }
}

async function onRemoveNode(n) {
  if (!window.confirm(`确定删除目录「${n.name}」及其下文件吗？`)) return
  const res = await removeKnowledge(n.id)
  if (res && res.success) await loadTree()
  else alert((res && res.message) || '删除失败')
}

async function onUploadFile() {
  const picked = await pickAttachment()
  if (!picked || !picked.success) {
    if (picked && picked.message) alert(picked.message)
    return
  }
  const title = window.prompt('文件标题：', picked.name || '')
  if (!title) return
  const ext = picked.name ? picked.name.split('.').pop().toLowerCase() : ''
  const res = await uploadKnowledgeFile({
    knowledge_id: selectedId.value,
    group_id: currentGroupId.value,
    title,
    file_path: picked.path,
    file_type: ext
  })
  if (res && res.success) await selectNode(selected.value)
  else alert((res && res.message) || '上传失败')
}

async function onRemoveFile(f) {
  if (!window.confirm('确定删除该文件记录吗？')) return
  const res = await removeKnowledgeFile(f.id)
  if (res && res.success) await selectNode(selected.value)
  else alert((res && res.message) || '删除失败')
}

async function onOpenFile(path) {
  const res = await openAttachment(path)
  if (!res || !res.success) alert((res && res.message) || '打开失败')
}

function formatSize(b) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}
function fmtTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

watch(currentGroupId, () => loadTree(), { immediate: true })
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-head { display: flex; justify-content: space-between; align-items: center; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.head-actions { display: flex; gap: 12px; align-items: center; }

.btn {
  height: 34px; padding: 0 16px; border-radius: 8px; font-size: 13px;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969; cursor: pointer;
}
.btn.sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn.primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.5; }

.body { display: flex; gap: 16px; align-items: stretch; }
.tree-col { flex: 1; min-width: 0; }
.file-col { flex: 1.6; min-width: 0; }

.state { padding: 40px 0; text-align: center; color: #8a9099; font-size: 13px; }
.state.error { color: #ea4335; }

.node-list { display: flex; flex-direction: column; }
.node-item {
  display: flex; align-items: center; gap: 8px; padding: 9px 12px;
  border-radius: 8px; cursor: pointer; font-size: 13px; color: #1f2329;
}
.node-item:hover { background: #f5f7fa; }
.node-item.active { background: #eef6ff; color: #0d80e0; font-weight: 500; }
.node-icon { font-size: 15px; }
.node-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.file-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.file-title { margin: 0; font-size: 15px; color: #1f2329; }
.file-desc { margin: 4px 0 0; font-size: 12px; color: #8a9099; }

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  background: #f7f9fc; text-align: left; padding: 10px 12px;
  border-bottom: 1px solid #eceff3; color: #4e5969; font-weight: 600;
}
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
.tbl tbody tr:hover { background: #eef6ff; }
.file-name { font-size: 13px; }
.tag { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #f2f3f5; color: #4e5969; font-size: 12px; }
.nowrap { white-space: nowrap; }
.muted { color: #8a9099; }

.link { background: none; border: none; color: #0d80e0; cursor: pointer; font-size: 13px; padding: 0 4px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #ea4335; }

.empty-note { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #b8bec4; gap: 10px; }
.empty-icon { font-size: 40px; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-box { background: #fff; border-radius: 12px; padding: 24px; width: 440px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
.modal-title { margin: 0 0 18px; font-size: 16px; color: #1f2329; }
.form-item { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-label { font-size: 13px; color: #4e5969; }
.form-label i { color: #ea4335; font-style: normal; }
.form-item input, .form-item textarea, .form-item select {
  padding: 8px 10px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: vertical; background: #fff;
}
.form-item input:focus, .form-item textarea:focus, .form-item select:focus { border-color: #0d80e0; }
.form-error { color: #ea4335; font-size: 12px; margin: 0 0 10px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
</style>
