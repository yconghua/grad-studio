<template>
  <div class="page">
    <div class="page-head card">
      <div>
        <h2 class="page-title">🤖 AI 科研助手</h2>
        <p class="page-desc">辅助论文写作、实验设计与文献综述（当前为前端演示界面）。</p>
      </div>
    </div>

    <div class="body">
      <!-- 左：提示词模板 -->
      <div class="card tpl-col">
        <h3 class="side-title">常用提示词</h3>
        <div
          v-for="t in templates" :key="t.label"
          class="tpl-item" @click="useTemplate(t.prompt)"
        >
          <div class="tpl-icon">{{ t.icon }}</div>
          <div class="tpl-text">
            <div class="tpl-label">{{ t.label }}</div>
            <div class="tpl-desc">{{ t.desc }}</div>
          </div>
        </div>
      </div>

      <!-- 右：对话区 -->
      <div class="card chat-col">
        <div ref="msgBox" class="msgs">
          <div v-if="!messages.length" class="welcome">
            <div class="welcome-icon">🤖</div>
            <p class="welcome-title">你好，我是你的科研助手</p>
            <p class="welcome-sub">从左侧选择一个提示词模板开始，或直接输入你的问题。</p>
          </div>
          <div
            v-for="(m, i) in messages" :key="i"
            class="msg-row" :class="m.role"
          >
            <div class="bubble">
              <div class="bubble-role">{{ m.role === 'user' ? '我' : '系统提示' }}</div>
              <div class="bubble-text">{{ m.content }}</div>
            </div>
          </div>
        </div>

        <div class="composer">
          <textarea
            v-model="input" rows="2"
            placeholder="输入你的科研问题…（Enter 发送，Shift+Enter 换行）"
            @keydown.enter.exact.prevent="onSend"
          ></textarea>
          <button class="btn primary send" @click="onSend" :disabled="!input.trim()">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const templates = [
  { icon: '✍️', label: '论文摘要润色', desc: '把粗糙的摘要改写得更学术、流畅', prompt: '请帮我润色以下论文摘要，使其更符合学术写作规范：' },
  { icon: '🧪', label: '实验设计建议', desc: '针对研究问题给出实验方案思路', prompt: '我的研究问题是「」，请帮我梳理可行的实验设计与对照方案：' },
  { icon: '📚', label: '文献综述框架', desc: '生成某主题的综述大纲', prompt: '请为以下主题生成一份文献综述写作框架：' },
  { icon: '🐛', label: '代码调试思路', desc: '分析报错并给出排查方向', prompt: '我遇到如下代码问题，请帮我分析可能原因与调试思路：' },
  { icon: '📅', label: '周报润色', desc: '把口语化记录整理成规范周报', prompt: '请把以下本周工作记录整理成规范的周报条目：' },
  { icon: '🎯', label: '研究选题评估', desc: '评估选题的创新性与可行性', prompt: '我的初步研究方向是「」，请评估其创新性与可行性：' }
]

const messages = ref([])
const input = ref('')
const msgBox = ref(null)

async function scrollBottom() {
  await nextTick()
  if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
}

function useTemplate(prompt) {
  input.value = prompt
}

function onSend() {
  const text = input.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  messages.value.push({
    role: 'bot',
    content: 'AI 服务尚未接入，当前为前端演示界面，暂无法生成真实回答。接入后端大模型后即可在此获得科研辅助。'
  })
  scrollBottom()
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; height: 100%; }
.card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #eceff3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }

.body { display: flex; gap: 16px; flex: 1; min-height: 0; }
.tpl-col { flex: 0 0 260px; display: flex; flex-direction: column; }
.side-title { margin: 0 0 12px; font-size: 14px; color: #1f2329; }
.tpl-item {
  display: flex; gap: 10px; padding: 10px; border-radius: 10px;
  cursor: pointer; border: 1px solid transparent; margin-bottom: 6px;
}
.tpl-item:hover { background: #eef6ff; border-color: #d6e9ff; }
.tpl-icon { font-size: 18px; }
.tpl-label { font-size: 13px; color: #1f2329; font-weight: 500; }
.tpl-desc { font-size: 12px; color: #8a9099; margin-top: 2px; }

.chat-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.msgs { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 12px; }
.welcome { margin: auto; text-align: center; color: #8a9099; }
.welcome-icon { font-size: 44px; }
.welcome-title { font-size: 15px; color: #1f2329; margin: 10px 0 4px; }
.welcome-sub { font-size: 13px; margin: 0; }

.msg-row { display: flex; }
.msg-row.user { justify-content: flex-end; }
.bubble { max-width: 70%; padding: 10px 14px; border-radius: 12px; }
.msg-row.user .bubble {
  background: linear-gradient(135deg, #0d80e0, #19a558); color: #fff;
  border-bottom-right-radius: 4px;
}
.msg-row.bot .bubble { background: #f2f3f5; color: #1f2329; border-bottom-left-radius: 4px; }
.bubble-role { font-size: 11px; opacity: 0.7; margin-bottom: 4px; }
.bubble-text { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }

.composer { display: flex; gap: 10px; border-top: 1px solid #eceff3; padding-top: 12px; }
.composer textarea {
  flex: 1; padding: 10px 12px; border: 1px solid #dfe3e8; border-radius: 8px;
  font-size: 13px; outline: none; font-family: inherit; resize: none;
}
.composer textarea:focus { border-color: #0d80e0; }
.btn {
  height: 38px; padding: 0 20px; border-radius: 8px; font-size: 13px; cursor: pointer;
  border: 1px solid #dfe3e8; background: #fff; color: #4e5969;
}
.btn.primary { background: linear-gradient(135deg, #0d80e0, #19a558); border: none; color: #fff; font-weight: 600; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
