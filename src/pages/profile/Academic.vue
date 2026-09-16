<template>
  <div class="page">
    <h3 class="title">学术档案</h3>
    <p class="tip">完善你的个人与学术信息，保存后立即生效。</p>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else class="form">
      <div class="row">
        <div class="field">
          <label class="label">真实姓名</label>
          <input v-model="form.real_name" class="input" />
        </div>
        <div class="field">
          <label class="label">性别</label>
          <select v-model="form.gender" class="input">
            <option value="">请选择</option>
            <option v-for="o in GENDER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="label">学号/工号</label>
          <input v-model="form.student_no" class="input" />
        </div>
        <div class="field">
          <label class="label">邮箱</label>
          <input v-model="form.email" class="input" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="label">手机号</label>
          <input v-model="form.phone" class="input" />
        </div>
        <div class="field">
          <label class="label">学院</label>
          <input v-model="form.college" class="input" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="label">院系/教研室</label>
          <input v-model="form.department" class="input" />
        </div>
        <div class="field">
          <label class="label">专业</label>
          <input v-model="form.major" class="input" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="label">年级</label>
          <input v-model="form.grade" class="input" placeholder="如 2024级" />
        </div>
        <div class="field">
          <label class="label">学位类型</label>
          <select v-model="form.degree_type" class="input">
            <option value="">请选择</option>
            <option v-for="o in DEGREE_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="label">个人简介</label>
        <textarea v-model="form.bio" class="input" rows="3"></textarea>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getMyProfile, updateMyProfile } from '../../api'
import { GENDER_OPTIONS, DEGREE_TYPE_OPTIONS } from '../../config/fieldOptions'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const form = ref({})

onMounted(async () => {
  try {
    const res = await getMyProfile()
    if (res && res.success && res.profile) {
      form.value = res.profile
    }
  } catch (e) {
    // 忽略
  } finally {
    loading.value = false
  }
})

async function save() {
  error.value = ''
  saving.value = true
  try {
    const res = await updateMyProfile(form.value)
    if (res && res.success) {
      window.alert('保存成功')
    } else {
      error.value = (res && res.message) || '保存失败'
    }
  } catch (e) {
    error.value = '保存过程出现异常，请重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 12px;
  padding: 20px 22px;
}
.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.tip {
  margin: 6px 0 16px;
  font-size: 13px;
  color: #8a9099;
}
.empty {
  text-align: center;
  color: #8a9099;
  padding: 30px 0;
}
.form {
  max-width: 640px;
}
.row {
  display: flex;
  gap: 16px;
}
.row .field {
  flex: 1;
}
.field {
  margin-bottom: 14px;
}
.label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}
textarea.input {
  padding: 8px 10px;
  resize: vertical;
}
.input:focus {
  border-color: #0d80e0;
}
.error {
  margin: 8px 0;
  font-size: 13px;
  color: #ea4335;
}
.btn {
  height: 36px;
  padding: 0 22px;
  font-size: 13px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
}
.btn-primary {
  border: none;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
</style>
