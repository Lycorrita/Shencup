import { createRouter, createWebHashHistory } from 'vue-router'

// 用 hash 路由：CloudBase 静态托管子路径下刷新不 404
const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/play', name: 'play', component: () => import('@/views/PlayView.vue') },
  { path: '/rank', name: 'rank', component: () => import('@/views/RankView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
