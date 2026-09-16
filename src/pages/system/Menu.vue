<template>
  <InfoPage title="菜单配置" :items="items" />
</template>

<script setup>
import InfoPage from '../../components/InfoPage.vue'

const items = [
  {
    title: '数据驱动导航',
    body: '左侧导航由 src/config/navConfig.js 单一数据源驱动，路由由 navGroups 自动生成，页面标题取导航项 title。'
  },
  {
    title: '如何调整菜单',
    body: '新增/删除/改名菜单项，只需修改 navConfig.js 中的 navGroups（左侧导航）与 profileNavItems（个人主页页签），并在 src/pages/ 下对应目录添加页面组件、在 src/router/index.js 的页面映射中登记即可。'
  }
]
</script>
