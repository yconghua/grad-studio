<template>
  <div class="help-page">
    <h2 class="help-title">使用帮助</h2>
    <p class="help-sub">系统按角色动态渲染侧边菜单，各角色能力范围如下：</p>

    <div class="help-grid">
      <div v-for="role in roles" :key="role.key" class="help-card">
        <h3 class="card-title">{{ role.title }}</h3>
        <p class="card-desc">{{ role.desc }}</p>
        <ul class="card-menus">
          <li v-for="m in role.menus" :key="m">{{ m }}</li>
        </ul>
      </div>
    </div>

    <div class="help-tip">
      详细帮助文档将在后续迭代中完善；如遇账号问题请联系课题组管理员或平台超级管理员。
    </div>
  </div>
</template>

<script setup>
// 使用帮助页（骨架版）：仅展示四类角色能力说明，详细 FAQ 后续补充
const roles = [
  {
    key: 'super-admin',
    title: '超级管理员',
    desc: '平台运维角色，不参与课题组内业务，负责平台级管控。',
    menus: ['工作台', '用户管理', '课题组管理', '系统配置', '系统操作日志', '帮助文档']
  },
  {
    key: 'group-admin',
    title: '课题组管理员',
    desc: '课题组行政管理员，负责本组公告、成员、组会发布、课题、知识库与设置等日常运营；学术指导（任务、周报、成果、学位、汇报审阅）由导师承担。',
    menus: ['工作台', '课题组公告', '成员管理', '课题组设置', '课题管理', '组会发布', '课题组知识库']
  },
  {
    key: 'mentor',
    title: '导师',
    desc: '管理分配给自己的学生，承担科研指导职责：下发任务、批阅周报、审核成果、审阅组会汇报并维护学位节点。',
    menus: ['工作台', '课题组公告', '我的学生', '学位节点管理', '课题管理', '任务管理', '周报批阅', '组会管理', '科研成果', '课题组知识库']
  },
  {
    key: 'student',
    title: '学生',
    desc: '围绕个人科研工作，无审核与管理权限，仅访问自身数据。',
    menus: ['工作台', '课题组公告', '组会管理', '科研记录', '学位进度', '课题与任务', '科研成果', '文献与笔记', '科研档案', '课题组知识库', 'AI科研助手']
  }
]
</script>

<style scoped>
.help-page { max-width: 980px; margin: 0 auto; }
.help-title { margin: 0 0 6px; font-size: 22px; color: #1f2329; }
.help-sub { margin: 0 0 20px; font-size: 13px; color: #8a9099; }
.help-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px;
}
.help-card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.card-title { margin: 0 0 8px; font-size: 16px; color: #0d80e0; }
.card-desc { margin: 0 0 10px; font-size: 12px; color: #8a9099; line-height: 1.7; }
.card-menus { margin: 0; padding-left: 18px; }
.card-menus li { font-size: 13px; color: #4e5969; line-height: 1.9; }
.help-tip { margin-top: 18px; font-size: 12px; color: #b8bec4; text-align: center; }
</style>
