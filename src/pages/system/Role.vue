<template>
  <InfoPage title="角色权限" :items="items" />
</template>

<script setup>
import InfoPage from '../../components/InfoPage.vue'

const items = [
  {
    title: '三级角色',
    body: '系统内置三级角色：管理员（admin）、导师（mentor）、学生（student），另有 user 兼容历史数据（按学生处理）。角色值统一定义在 shared/constants.js。'
  },
  {
    title: '导航可见性',
    body: '左侧各菜单的可见角色由 src/config/navConfig.js 中各导航项的 roles 字段控制（子项未填则继承所属一级导航）。系统设置仅管理员可见，统计报表、经费管理等仅导师/管理员可见。'
  },
  {
    title: '写权限',
    body: '后端按 write 三级权限控制写操作：manager（仅导师/管理员）、member（所有登录用户）、self（仅本人）。管理类数据（项目/经费/工位/设备等）仅导师/管理员可写。'
  }
]
</script>
