import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@bzr/bazaar'
import { bzr } from '@/bazaar'

export const useAuthStore = defineStore('auth', () => {
  const authenticated = ref(false)
  const loaded = ref(false)
  const me: Ref<User | undefined> = ref()

  async function loadState() {
    if (!bzr.isLoggedIn()) {
      loaded.value = true
      return
    }
    me.value = await bzr.social.getUser()
    authenticated.value = true
    loaded.value = true
  }

  return { authenticated, loaded, me, loadState }
})
