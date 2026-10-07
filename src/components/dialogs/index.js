// 弹窗组件统一聚合出口：全局弹窗 + 数据库管理弹窗
// 需要弹窗的页面统一从本目录引用，组件各自自持弹窗逻辑，仅通过 props / emits 与页面协调层通信
export { default as AppDialog } from './AppDialog.vue'
export { default as BaseConfig } from './BaseConfig.vue'
export { default as DbSwitch } from './DbSwitch.vue'
export { default as DbAdd } from './DbAdd.vue'
export { default as DbEdit } from './DbEdit.vue'
export { default as DbDeleteConfirm } from './DbDeleteConfirm.vue'
