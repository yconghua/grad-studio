// 应用入口：创建 Vue 实例并挂载到 #app。
// 路由（hash 模式）与登录守卫见 src/router/index.js；根组件见 App.vue（仅承载路由出口）。
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
