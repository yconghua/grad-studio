<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">❓ 帮助文档</h2>
        <p class="page-desc">{{ appName }}使用说明（仅超级管理员可见）</p>
      </div>
    </div>

    <!-- 平台简介 -->
    <div class="card">
      <h3 class="card-title">📖 平台简介</h3>
      <p class="text">本平台面向高校课题组，覆盖账号与组织管理、课题组日常运营、科研过程记录与成果归档全流程。平台采用「超级管理员 → 课题组管理员 → 导师 → 学生」四级角色体系，数据按课题组隔离，支持公告、组会、任务、周报、成果、学位节点、文献与知识库等模块。</p>
    </div>

    <!-- 角色权限矩阵 -->
    <div class="card">
      <h3 class="card-title">👥 角色权限说明</h3>
      <table class="tbl">
        <thead>
          <tr><th>能力</th><th>超级管理员</th><th>课题组管理员</th><th>导师</th><th>学生</th></tr>
        </thead>
        <tbody>
          <tr><td>平台账号 / 课题组 / 系统参数 / 操作日志维护</td><td>✅</td><td>—</td><td>—</td><td>—</td></tr>
          <tr><td>本组成员增删、师生关系绑定</td><td>—</td><td>✅</td><td>部分（仅本人名下）</td><td>—</td></tr>
          <tr><td>发布公告、创建组会、下发任务、配置课题组</td><td>—</td><td>✅</td><td>部分（任务可下发给自己学生）</td><td>—</td></tr>
          <tr><td>批阅周报、审核科研成果</td><td>—</td><td>✅</td><td>✅</td><td>—</td></tr>
          <tr><td>查看名下学生、课题与知识库</td><td>—</td><td>✅</td><td>✅</td><td>—</td></tr>
          <tr><td>提交任务进展、撰写周报、申报成果、记录科研日志与文献</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 常见操作指引 -->
    <div class="grid">
      <div class="card">
        <h3 class="card-title">🚀 常见操作指引</h3>
        <ul class="list">
          <li><b>新增账号：</b>用户管理 → 新增用户，填写账号与角色；初始密码按角色默认生成，创建成功后请告知用户并提示首次登录修改。</li>
          <li><b>批量导入：</b>用户管理 → 批量导入，每行「账号,角色」或粘贴 JSON 数组，导入后可查看成功数与失败明细。</li>
          <li><b>重置密码：</b>编辑用户 → 勾选「重置密码」，密码恢复为角色默认值，用户下次登录须改密。</li>
          <li><b>新建课题组：</b>课题组管理 → 新增，名称与编号必填且编号唯一；停用后组内业务不可访问。</li>
          <li><b>选择课题组：</b>组内业务页页头的课题组选择器，超管下拉选择，其他角色手动输入本组 ID，选择会记忆保存。</li>
          <li><b>系统参数：</b>系统配置以键值对维护全局参数，同名键保存即更新（upsert）。</li>
        </ul>
      </div>
      <div class="card">
        <h3 class="card-title">🔒 数据安全说明</h3>
        <ul class="list">
          <li>密码均以 bcrypt 哈希存储，系统不保存明文，管理端无法查看他人密码，仅可重置。</li>
          <li>账号删除为硬删除（用户），课题组 / 参数 / 公告等业务数据为软删除，保留审计痕迹。</li>
          <li>关键写操作（增删改账号、课题组、参数等）都会写入操作日志，日志只读、按时间倒序分页查询。</li>
          <li>数据按课题组隔离，学生仅能看到本人任务、周报与成果；越权访问会被后端拦截。</li>
          <li>建议定期在系统设置中导出数据库备份，避免本地数据丢失。</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppName } from '../../../composables/useAppName'
const { appName } = useAppName()
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title { margin: 0; font-size: 18px; color: #1f2329; }
.page-desc { margin: 4px 0 0; font-size: 13px; color: #8a9099; }
.card { background: #fff; border: 1px solid #eceff3; border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); padding: 18px 20px; }
.card-title { margin: 0 0 12px; font-size: 15px; color: #1f2329; }
.text { font-size: 13px; color: #4e5969; line-height: 1.8; margin: 0; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.list { margin: 0; padding-left: 18px; font-size: 13px; color: #4e5969; line-height: 1.9; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { background: #f7f9fc; text-align: left; padding: 10px 12px; color: #4e5969; font-weight: 600; border-bottom: 1px solid #eceff3; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid #eceff3; color: #1f2329; }
.tbl tbody tr:nth-child(even) { background: #fafbfc; }
</style>
