<template>
  <div class="tc-page">
    <div class="tc-card">
      <div class="tc-icon">💡</div>
      <h2 class="tc-title">测试内容</h2>
      <p class="tc-desc">
        当前账号尚未加入任何课题组，暂时只展示测试内容页面。加入课题组后将显示完整的业务菜单。
      </p>
    </div>
  </div>
</template>

<script setup>
// 导师/学生未加入课题组时的兜底页面（对应导航菜单 noGroupOnly 项）
</script>

<style scoped>
.tc-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.tc-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 48px 56px;
  text-align: center;
  max-width: 480px;
  width: 100%;
}
.tc-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: 16px;
}
.tc-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}
.tc-desc {
  margin: 0;
  font-size: 14px;
  color: #8a9099;
  line-height: 1.7;
}
</style>
