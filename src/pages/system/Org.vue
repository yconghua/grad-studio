<template>
  <InfoPage title="组织架构" :items="items" />
</template>

<script setup>
import InfoPage from '../../components/InfoPage.vue'

const items = [
  {
    title: '成员组织信息',
    body: '成员的组织信息（学院 college、院系 department、专业 major、年级 grade、学位类型 degree_type、职务职称 position、导师 advisor_id）直接存储在 user 表中。'
  },
  {
    title: '导师关系',
    body: '学生的导师通过 user 表的 advisor_id 字段指向导师用户 id（自关联，软关联不加外键）。在「成员管理」中编辑成员即可维护其组织与导师信息。'
  }
]
</script>
