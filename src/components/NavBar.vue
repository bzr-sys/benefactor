<script setup lang="ts">
import { onMounted, ref, type Ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Notification } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/lib/format'
import AppIcon from './AppIcon.vue'
import UserAvatar from './UserAvatar.vue'

const auth = useAuthStore()
const menu: Ref<'' | 'account' | 'notifications'> = ref('')
const notifications: Ref<Notification[]> = ref([])

async function loadNotifications() {
  notifications.value = (await bzr.notifications.list()).sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  )
}

async function clearNotifications() {
  await Promise.all(notifications.value.map((n) => bzr.notifications.hide(n.id)))
  notifications.value = []
}

function toggle(name: 'account' | 'notifications') {
  menu.value = menu.value === name ? '' : name
  if (menu.value === 'notifications') void loadNotifications()
}

onMounted(loadNotifications)

const links = [
  { to: { name: 'home' }, label: 'Feed' },
  { to: { name: 'memberships' }, label: 'Memberships' },
  { to: { name: 'studio' }, label: 'Creator studio' },
]
</script>

<template>
  <header class="border-b border-line bg-white">
    <div
      class="mx-auto flex min-h-16 max-w-[1160px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 sm:px-6"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2 py-3 text-xl font-extrabold tracking-tight"
      >
        <span class="inline-block h-[22px] w-[22px] rounded-md bg-accent"></span>Benefactor
      </RouterLink>
      <nav class="flex flex-wrap items-center gap-1" @keydown.esc="menu = ''">
        <RouterLink
          v-for="link in links"
          :key="link.label"
          :to="link.to"
          class="rounded-lg px-3.5 py-2.5 font-medium hover:bg-paper"
          active-class="bg-paper"
        >
          {{ link.label }}
        </RouterLink>
        <div class="relative">
          <button
            class="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-paper"
            aria-label="Notifications"
            :aria-expanded="menu === 'notifications'"
            @click="toggle('notifications')"
          >
            <AppIcon name="bell" :size="20" />
            <span
              v-if="notifications.length > 0"
              class="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent"
            ></span>
          </button>
          <div
            v-if="menu === 'notifications'"
            class="card absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] p-2 shadow-lg"
          >
            <div class="flex items-center justify-between px-2 py-1">
              <strong>Notifications</strong>
              <button
                v-if="notifications.length > 0"
                class="text-sm text-muted hover:text-ink"
                @click="clearNotifications"
              >
                Clear all
              </button>
            </div>
            <p v-if="notifications.length === 0" class="px-2 py-4 text-sm text-muted">
              Nothing new. Posts from creators you support or follow show up here.
            </p>
            <ul v-else class="max-h-80 overflow-y-auto">
              <li v-for="n in notifications" :key="n.id" class="rounded-lg px-2 py-2 text-sm">
                <p>{{ n.message }}</p>
                <p class="text-muted">{{ formatDate(n.ts) }}</p>
              </li>
            </ul>
          </div>
        </div>
        <div class="relative ml-1">
          <button
            class="rounded-full"
            aria-label="Account"
            :aria-expanded="menu === 'account'"
            @click="toggle('account')"
          >
            <UserAvatar :name="auth.me?.name ?? ''" />
          </button>
          <div v-if="menu === 'account'" class="card absolute right-0 z-20 mt-2 w-56 p-2 shadow-lg">
            <div class="px-2 py-1.5">
              <div class="font-semibold">{{ auth.me?.name }}</div>
              <div class="text-sm text-muted">@{{ auth.me?.handle }}</div>
            </div>
            <button
              class="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-paper"
              @click="bzr.logOut()"
            >
              <AppIcon name="signout" /> Sign out
            </button>
          </div>
        </div>
      </nav>
    </div>
  </header>
</template>
