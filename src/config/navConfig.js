// 左侧导航配置（数据驱动：父项 / 子项 / 顶部项的数量均可自由增减）
//
// - 顶部项（topItem）：直接跳转的独立导航（如「首页」）；
// - 父项（group）：下拉分组标题，点击展开 / 收起其子项；分组 key 用于大导航点击跳转到分组落地页；
// - 子项（child）：实际可点击路由，页面位于 pages 对应的文件夹里的 vue。
//
// 想加导航，只改这个文件即可：
//   新增顶部项 → 往 navTopItems 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   新增父项   → 往 navGroups 加一个 { key, title, children: [...] }，并建 pages/<大组文件夹>/index.vue 落地页
//   新增子项   → 往对应父项的 children 加一个 { key, title }，并在 pages 对应的文件夹里面建页面
//   key 会同时用作路由 path（如 home → /home），需保持唯一并与页面文件夹名一致。

// 顶部独立导航项（直接跳转，非下拉分组）
export const navTopItems = [
  { key: 'home', title: '首页' }
]

// 下拉分组：业务模块占位（模块一 / 模块二 / 模块三）+ 应急疏散
// 子项 key 与页面文件一一对应：pages/<大组文件夹>/<语义名>.vue
export const navGroups = [
  {
    key: 'module-a',
    title: '模块一',
    children: [
      { key: 'mod-a-1', title: '页面一' },
      { key: 'mod-a-2', title: '页面二' }
    ]
  },
  {
    key: 'module-b',
    title: '模块二',
    children: [
      { key: 'mod-b-1', title: '页面一' }
    ]
  },
  {
    key: 'module-c',
    title: '模块三',
    children: [
      { key: 'mod-c-1', title: '页面一' },
      { key: 'mod-c-2', title: '页面二' }
    ]
  },
  {
    key: 'evac',
    title: '应急疏散',
    children: [
      { key: 'evac-sim', title: '仿真模拟' }
    ]
  },
  {
    key: 'about',
    title: '关于平台',
    children: [
      { key: 'about-intro', title: '系统介绍' },
      { key: 'about-guide', title: '使用指南' },
      { key: 'about-feedback', title: '意见反馈' },
      { key: 'about-contact', title: '联系我们' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则回退到个人主页
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : '/profile'
