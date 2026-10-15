<script setup lang="ts">
import { RouterView } from 'vue-router'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import LoaderSVG from './components/LoaderSVG.vue'
import NavBar from './components/NavBar.vue'
import BaseLogin from './components/BaseLogin.vue'

const authStore = useAuthStore()
void authStore.loadState()

bzr.onLogin(async () => {
  await authStore.loadState()
})
</script>

<template>
  <div v-if="!authStore.loaded" class="flex min-h-screen items-center justify-center">
    <LoaderSVG width="40px" />
  </div>
  <template v-else-if="authStore.authenticated">
    <NavBar />
    <RouterView />
  </template>
  <BaseLogin v-else />
</template>
