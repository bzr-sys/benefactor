import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/memberships',
      name: 'memberships',
      component: () => import('../views/MembershipsView.vue'),
    },
    { path: '/studio', name: 'studio', component: () => import('../views/StudioView.vue') },
    {
      path: '/studio/:pageId',
      name: 'studio-page',
      component: () => import('../views/StudioPageView.vue'),
    },
    {
      path: '/studio/:pageId/posts/new',
      name: 'post-new',
      component: () => import('../views/PostEditorView.vue'),
    },
    {
      path: '/studio/:pageId/posts/:postId',
      name: 'post-edit',
      component: () => import('../views/PostEditorView.vue'),
    },
    {
      path: '/u/:handle/:slug?',
      name: 'creator',
      component: () => import('../views/CreatorPageView.vue'),
    },
    {
      path: '/u/:handle/:slug/p/:postId',
      name: 'post',
      component: () => import('../views/PostView.vue'),
    },
  ],
})

export default router
