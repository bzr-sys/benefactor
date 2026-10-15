<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import { slugify } from '@/lib/format'
import AppIcon from '@/components/AppIcon.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const auth = useAuthStore()
const studio = useStudioStore()
const router = useRouter()

const name = ref('')
const slug = ref('')
const slugEdited = ref(false)
const tagline = ref('')
const creating = ref(false)
const showForm = ref(false)
const error = ref('')

watch(name, (n) => {
  if (!slugEdited.value) slug.value = slugify(n)
})

function setUpPayments() {
  bzr.monetization.openPopup(() => void studio.refreshStatus())
}

async function createPage() {
  error.value = ''
  const s = slugify(slug.value)
  if (!name.value.trim() || !s) {
    error.value = 'Give your page a name and an address.'
    return
  }
  if (studio.pages.some((p) => p.slug === s)) {
    error.value = 'You already have a page at this address.'
    return
  }
  creating.value = true
  try {
    const page = await studio.createPage({
      name: name.value.trim(),
      slug: s,
      tagline: tagline.value.trim(),
    })
    await router.push({ name: 'studio-page', params: { pageId: page.id } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    creating.value = false
  }
}

onMounted(() => studio.load())
</script>

<template>
  <div class="mx-auto flex max-w-[1160px] flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
    <h1 class="text-[28px] font-extrabold tracking-tight">Creator studio</h1>
    <div v-if="!studio.loaded" class="flex justify-center py-16"><LoaderSVG width="32px" /></div>
    <template v-else>
      <section
        v-if="!studio.status.canMonetize || !studio.status.paymentsEnabled"
        class="card p-6"
        aria-labelledby="setup-heading"
      >
        <h2 id="setup-heading" class="text-lg font-bold">Get ready to earn</h2>
        <p class="mt-1 text-body">
          You can post and gain followers right away. To sell memberships, finish these steps in
          Bazaar.
        </p>
        <ol class="mt-4 flex flex-col gap-2.5">
          <li class="flex items-center gap-3">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full"
              :class="
                studio.status.canMonetize ? 'bg-accent text-white' : 'border border-edge text-muted'
              "
            >
              <AppIcon v-if="studio.status.canMonetize" name="check" :size="16" />
              <template v-else>1</template>
            </span>
            Bazaar Creator plan
          </li>
          <li class="flex items-center gap-3">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full"
              :class="
                studio.status.paymentsEnabled
                  ? 'bg-accent text-white'
                  : 'border border-edge text-muted'
              "
            >
              <AppIcon v-if="studio.status.paymentsEnabled" name="check" :size="16" />
              <template v-else>2</template>
            </span>
            Payout account with Stripe
          </li>
        </ol>
        <button class="btn-primary mt-5" @click="setUpPayments">
          Set up in Bazaar <AppIcon name="external" />
        </button>
      </section>

      <section aria-labelledby="pages-heading">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="pages-heading" class="text-lg font-semibold">Your pages</h2>
          <button
            v-if="studio.pages.length > 0 && !showForm"
            class="btn-secondary btn-sm"
            @click="showForm = true"
          >
            <AppIcon name="plus" /> New page
          </button>
        </div>

        <ul v-if="studio.pages.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="page in studio.pages"
            :key="page.id"
            class="card flex flex-col gap-4 p-5"
            :style="{ '--accent': page.accent }"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :name="page.name" :size="48" />
              <div class="min-w-0">
                <div class="truncate text-lg font-semibold">{{ page.name }}</div>
                <div class="truncate text-sm text-muted">
                  /u/{{ auth.me?.handle }}/{{ page.slug }}
                </div>
              </div>
            </div>
            <div class="mt-auto flex gap-2">
              <RouterLink
                :to="{ name: 'studio-page', params: { pageId: page.id } }"
                class="btn-primary btn-sm flex-1"
              >
                Manage
              </RouterLink>
              <RouterLink
                :to="{ name: 'creator', params: { handle: auth.me?.handle, slug: page.slug } }"
                class="btn-secondary btn-sm flex-1"
              >
                View
              </RouterLink>
            </div>
          </li>
        </ul>

        <form
          v-if="studio.pages.length === 0 || showForm"
          class="card mt-4 flex max-w-xl flex-col gap-4 p-6"
          @submit.prevent="createPage"
        >
          <div>
            <h3 class="text-lg font-bold">
              {{ studio.pages.length === 0 ? 'Create your page' : 'Create another page' }}
            </h3>
            <p class="mt-1 text-[15px] text-body">
              One page per project or offering. Each page has its own tiers, posts and members.
            </p>
          </div>
          <div>
            <label for="page-name" class="label">Name</label>
            <input
              id="page-name"
              v-model="name"
              class="input"
              maxlength="80"
              placeholder="Your name or project"
            />
          </div>
          <div>
            <label for="page-slug" class="label">Address</label>
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-muted">/u/{{ auth.me?.handle }}/</span>
              <input
                id="page-slug"
                v-model="slug"
                class="input"
                maxlength="40"
                @input="slugEdited = true"
              />
            </div>
          </div>
          <div>
            <label for="page-tagline" class="label">Tagline</label>
            <input
              id="page-tagline"
              v-model="tagline"
              class="input"
              maxlength="140"
              placeholder="What you make, in one line"
            />
          </div>
          <p v-if="error" class="text-[15px] text-[#B42318]" role="alert">{{ error }}</p>
          <div class="flex gap-2">
            <button class="btn-primary" :disabled="creating">Create page</button>
            <button
              v-if="studio.pages.length > 0"
              type="button"
              class="btn-secondary"
              @click="showForm = false"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>
