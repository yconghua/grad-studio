<template>
  <div class="page">
    <h2 class="page-title">关于平台 · 意见反馈</h2>

    <div class="layout">
      <!-- ===== 主区：反馈表单 ===== -->
      <div class="main">
        <section class="card">
          <h3 class="sec-title">提交反馈（目前只是本地提交，没有连接数据库）</h3>

          <div class="form-group">
            <label class="form-label">反馈类型 <em class="req">*</em></label>
            <div class="type-grid">
              <button
                v-for="t in types"
                :key="t.value"
                type="button"
                class="type-chip"
                :class="{ active: form.type === t.value }"
                @click="form.type = t.value"
              >
                <span class="type-icon">{{ t.icon }}</span>
                <span class="type-name">{{ t.name }}</span>
                <span class="type-desc">{{ t.desc }}</span>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">标题 <em class="req">*</em></label>
            <input
              v-model="form.title"
              class="input"
              type="text"
              maxlength="50"
              placeholder="一句话概括你的问题或建议"
            />
            <span class="input-count">{{ form.title.length }}/50</span>
          </div>

          <div class="form-group">
            <label class="form-label">详细描述 <em class="req">*</em></label>
            <textarea
              v-model="form.desc"
              class="textarea"
              rows="6"
              maxlength="500"
              placeholder="请尽量描述清楚：发生了什么、期望的结果、复现步骤（如有）……"
            ></textarea>
            <span class="input-count">{{ form.desc.length }}/500</span>
          </div>

          <div class="form-group">
            <label class="form-label">联系方式 <em class="opt">选填</em></label>
            <input
              v-model="form.contact"
              class="input"
              type="text"
              maxlength="60"
              placeholder="邮箱 / 微信 / 电话，便于我们回复你"
            />
          </div>

          <p v-if="error" class="error-tip">⚠ {{ error }}</p>

          <div class="form-actions">
            <button type="button" class="btn-submit" @click="submit">提交反馈</button>
            <button type="button" class="btn-reset" @click="resetForm">重置</button>
          </div>
        </section>

        <section class="card">
          <h3 class="sec-title">反馈须知</h3>
          <ul class="notice-list">
            <li>请尽量填写<strong>详细的复现步骤</strong>或<strong>具体建议</strong>，便于我们快速定位与处理。</li>
            <li>涉及数据安全、账号权限等问题，建议优先联系管理员处理。</li>
            <li>每条反馈提交后即进入「待处理」状态，可在右侧「我的反馈」中随时查看。</li>
          </ul>
        </section>
      </div>

      <!-- ===== 侧栏：流程与历史 ===== -->
      <aside class="side">
        <section class="card side-card">
          <h3 class="sec-title">处理流程</h3>
          <ol class="timeline">
            <li class="timeline-item">
              <span class="tl-dot"></span>
              <div class="tl-body">
                <h4 class="tl-title">提交</h4>
                <p class="tl-desc">填写表单并提交反馈</p>
              </div>
            </li>
            <li class="timeline-item">
              <span class="tl-dot"></span>
              <div class="tl-body">
                <h4 class="tl-title">审核</h4>
                <p class="tl-desc">工作人员查看并分类</p>
              </div>
            </li>
            <li class="timeline-item">
              <span class="tl-dot"></span>
              <div class="tl-body">
                <h4 class="tl-title">处理</h4>
                <p class="tl-desc">定位问题或评估建议</p>
              </div>
            </li>
            <li class="timeline-item">
              <span class="tl-dot"></span>
              <div class="tl-body">
                <h4 class="tl-title">回复</h4>
                <p class="tl-desc">通过预留联系方式反馈结果</p>
              </div>
            </li>
          </ol>
          <p class="side-note">一般处理周期 1–2 个工作日；紧急问题请通过「联系我们」页直接联系。</p>
        </section>

        <section class="card side-card">
          <h3 class="sec-title">我的反馈</h3>
          <p v-if="list.length === 0" class="empty-tip">暂无反馈记录，提交第一条吧。</p>
          <ul v-else class="fb-list">
            <li v-for="item in list" :key="item.id" class="fb-item">
              <div class="fb-head">
                <span class="fb-tag" :class="`tag-${item.type}`">{{ typeName(item.type) }}</span>
                <span class="fb-status">待处理</span>
              </div>
              <p class="fb-title">{{ item.title }}</p>
              <p class="fb-desc">{{ item.desc }}</p>
              <div class="fb-foot">
                <span class="fb-time">{{ item.time }}</span>
                <button type="button" class="fb-del" @click="removeItem(item.id)">删除</button>
              </div>
            </li>
          </ul>
          <button v-if="list.length" type="button" class="btn-clear" @click="clearAll">
            清空全部反馈
          </button>
        </section>
      </aside>
    </div>

    <!-- ===== 提交成功提示 ===== -->
    <transition name="fade">
      <div v-if="toast" class="toast">✅ {{ toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// ===== 反馈类型 =====
const types = [
  { value: 'feature', name: '功能建议', desc: '希望新增或改进的功能', icon: '💡' },
  { value: 'bug', name: '缺陷报告', desc: '功能异常或报错', icon: '🐞' },
  { value: 'ux', name: '体验问题', desc: '界面与交互体验', icon: '🎨' },
  { value: 'other', name: '其他', desc: '其他任何想说的', icon: '📝' }
]
const typeName = (v) => (types.find((t) => t.value === v) || { name: '其他' }).name

// ===== 表单状态 =====
const form = reactive({ type: '', title: '', desc: '', contact: '' })
const error = ref('')
const toast = ref('')
let toastTimer = null

function resetForm() {
  form.type = ''
  form.title = ''
  form.desc = ''
  form.contact = ''
  error.value = ''
}

// ===== 本地存储：我的反馈 =====
const STORAGE_KEY = 'gra_feedback_list'
const list = ref([])

function loadList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    list.value = raw ? JSON.parse(raw) : []
  } catch {
    list.value = []
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.value))
  } catch {
    // 存储空间不足等异常时静默降级，不影响页面使用
  }
}

function formatTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ===== 提交与校验 =====
function submit() {
  error.value = ''
  if (!form.type) {
    error.value = '请选择反馈类型'
    return
  }
  if (!form.title.trim()) {
    error.value = '请填写反馈标题'
    return
  }
  if (form.desc.trim().length < 10) {
    error.value = '详细描述请至少填写 10 个字'
    return
  }

  list.value.unshift({
    id: Date.now(),
    type: form.type,
    title: form.title.trim(),
    desc: form.desc.trim(),
    contact: form.contact.trim(),
    status: '待处理',
    time: formatTime(new Date())
  })
  persist()

  showToast('反馈提交成功，感谢你的建议！')
  resetForm()
}

function removeItem(id) {
  list.value = list.value.filter((it) => it.id !== id)
  persist()
}
function clearAll() {
  list.value = []
  persist()
  showToast('已清空全部反馈记录')
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2600)
}

onMounted(loadList)
</script>

<style scoped>
/* ===== 页面骨架 ===== */
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
  color: #1d2129;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  border: 1px solid #f0f2f5;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.sec-title {
  position: relative;
  margin: 0 0 16px;
  padding-left: 12px;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}
.sec-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 4px;
  border-radius: 2px;
  background: #0d80e0;
}

/* ===== 双栏布局 ===== */
.layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 表单 ===== */
.form-group {
  position: relative;
  margin-bottom: 18px;
}
.form-group:last-of-type {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: #1d2129;
}
.req {
  color: #e24b4a;
  font-style: normal;
}
.opt {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  color: #8a9099;
}
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #1d2129;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input:focus,
.textarea:focus {
  outline: none;
  border-color: #0d80e0;
  box-shadow: 0 0 0 3px rgba(13, 128, 224, 0.12);
}
.input-count {
  position: absolute;
  right: 10px;
  bottom: 9px;
  font-size: 12px;
  color: #b0b8c0;
  background: #fff;
  padding: 0 4px;
}
.textarea {
  resize: vertical;
  line-height: 1.7;
}

/* ===== 类型单选 ===== */
.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.type-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid #e4e8ee;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fbfdff;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}
.type-chip:hover {
  border-color: #85b7eb;
}
.type-chip.active {
  border-color: #0d80e0;
  background: #f0f7ff;
  box-shadow: 0 0 0 3px rgba(13, 128, 224, 0.1);
}
.type-icon {
  font-size: 22px;
  line-height: 1;
}
.type-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #1d2129;
}
.type-chip.active .type-name {
  color: #0d47a1;
}
.type-desc {
  font-size: 12px;
  line-height: 1.5;
  color: #8a9099;
}

/* ===== 错误与按钮 ===== */
.error-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #c0392b;
  background: #fdf0ee;
  border: 1px solid #f5c6c0;
  border-radius: 8px;
  padding: 9px 12px;
}
.form-actions {
  display: flex;
  gap: 10px;
}
.btn-submit {
  border: none;
  border-radius: 8px;
  background: #0d80e0;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 26px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-submit:hover {
  background: #0d47a1;
}
.btn-reset {
  border: 1px solid #d9dee5;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font-size: 14px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover {
  border-color: #b0b8c0;
  color: #1d2129;
}

/* ===== 反馈须知 ===== */
.notice-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notice-list li {
  position: relative;
  padding-left: 14px;
  font-size: 13.5px;
  line-height: 1.8;
  color: #4e5969;
}
.notice-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0d80e0;
}

/* ===== 处理流程时间线 ===== */
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  position: relative;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #d9ebff;
}
.timeline-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
}
.timeline-item:last-child {
  padding-bottom: 0;
}
.tl-dot {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 50%;
  background: #0d80e0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #85b7eb;
}
.tl-body {
  min-width: 0;
}
.tl-title {
  margin: 0 0 2px;
  font-size: 13.5px;
  font-weight: 700;
  color: #1d2129;
}
.tl-desc {
  margin: 0;
  font-size: 12.5px;
  color: #8a9099;
  line-height: 1.6;
}
.side-note {
  margin: 14px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #8a9099;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px 12px;
}

/* ===== 我的反馈列表 ===== */
.empty-tip {
  margin: 0;
  font-size: 13px;
  color: #b0b8c0;
  text-align: center;
  padding: 20px 0;
}
.fb-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fb-item {
  border: 1px solid #eef1f5;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fbfdff;
}
.fb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.fb-tag {
  font-size: 11px;
  color: #fff;
  border-radius: 20px;
  padding: 2px 10px;
}
.tag-feature { background: #0d80e0; }
.tag-bug { background: #e24b4a; }
.tag-ux { background: #ef9f27; }
.tag-other { background: #888780; }
.fb-status {
  font-size: 11px;
  color: #b26a00;
  background: #fff4e0;
  border-radius: 20px;
  padding: 2px 10px;
}
.fb-title {
  margin: 0 0 4px;
  font-size: 13.5px;
  font-weight: 600;
  color: #1d2129;
}
.fb-desc {
  margin: 0 0 8px;
  font-size: 12.5px;
  line-height: 1.7;
  color: #4e5969;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fb-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fb-time {
  font-size: 11.5px;
  color: #b0b8c0;
}
.fb-del {
  border: none;
  background: none;
  font-size: 12px;
  color: #8a9099;
  cursor: pointer;
  padding: 2px 4px;
}
.fb-del:hover {
  color: #e24b4a;
}
.btn-clear {
  width: 100%;
  margin-top: 12px;
  border: 1px dashed #d9dee5;
  border-radius: 8px;
  background: none;
  color: #8a9099;
  font-size: 13px;
  padding: 8px 0;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-clear:hover {
  border-color: #e24b4a;
  color: #e24b4a;
}

/* ===== 成功提示 ===== */
.toast {
  position: fixed;
  left: 50%;
  top: 24px;
  transform: translateX(-50%);
  background: #1d2129;
  color: #fff;
  font-size: 14px;
  border-radius: 24px;
  padding: 10px 22px;
  z-index: 100;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

/* ===== 响应式 ===== */
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .card {
    padding: 18px 16px;
  }
  .type-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
