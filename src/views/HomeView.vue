<script setup lang="ts">
import { computed, onMounted, ref, type Ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { useMemberStore } from '@/stores/member'
import { loadPosts, toggleLike, type PostView, type Tier } from '@/lib/posts'
import PostCard from '@/components/PostCard.vue'
import AppIcon from '@/components/AppIcon.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'

const auth = useAuthStore()
const member = useMemberStore()
const router = useRouter()

const posts: Ref<PostView[]> = ref([])
const loading = ref(true)
const failed: Ref<string[]> = ref([])
const handle = ref('')

const memberPages = computed(() => new Set(member.activePurchases().map((p) => p.product.group)))

async function load() {
  loading.value = true
  failed.value = []
  await member.load()
  const sources = [...member.feedSources()]
  const results = await Promise.allSettled(
    sources.map(([creatorId, pageIds]) => loadPosts(creatorId, [...pageIds], auth.me!.id)),
  )
  const views: PostView[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') views.push(...result.value)
    else failed.value.push(sources[i]![0])
  })
  posts.value = views.sort((a, b) => b.post.created.localeCompare(a.post.created)).slice(0, 50)
  loading.value = false
}

function unlock(view: PostView, tier: Tier) {
  const purchase = member.activePurchases().find((p) => p.product.group === view.page.id)
  if (purchase && purchase.type === 'subscription') {
    bzr.monetization.purchases.openPopup({ purchaseId: purchase.id }, () => void load())
  } else {
    bzr.monetization.purchases.openPopup({ productId: tier.id }, () => void load())
  }
}

function findCreator() {
  const h = handle.value.trim().replace(/^@/, '')
  if (h) void router.push({ name: 'creator', params: { handle: h } })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto flex max-w-[1160px] flex-wrap items-start gap-8 px-4 pb-16 pt-8 sm:px-6">
    <main class="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
      <h1 class="text-[28px] font-extrabold tracking-tight">Your feed</h1>
      <div v-if="loading" class="flex justify-center py-16"><LoaderSVG width="32px" /></div>
      <div v-else-if="posts.length === 0" class="card p-8">
        <h2 class="text-xl font-bold">Nothing here yet</h2>
        <p class="mt-2 text-body">
          Posts from creators you support or follow show up here. Find a creator by their Bazaar
          handle to get started.
        </p>
      </div>
      <PostCard
        v-for="view in posts"
        :key="view.post.id"
        :view="view"
        show-source
        :is-member="memberPages.has(view.page.id)"
        @like="toggleLike(view, auth.me!.id)"
        @unlock="view.minTier && unlock(view, view.minTier)"
      />
      <p v-if="failed.length > 0" class="text-sm text-muted">
        Some creators could not be loaded. Try again later.
      </p>
    </main>

    <aside class="flex flex-[1_1_300px] flex-col gap-4">
      <form class="card p-5" @submit.prevent="findCreator">
        <label for="handle" class="label">Find a creator</label>
        <div class="flex gap-2">
          <input
            id="handle"
            v-model="handle"
            class="input"
            placeholder="@handle"
            autocomplete="off"
          />
          <button class="btn-primary shrink-0 px-3" aria-label="Go to creator">
            <AppIcon name="search" />
          </button>
        </div>
      </form>

      <div v-if="member.following.length > 0" class="card p-5">
        <h2 class="mb-2 font-semibold">Following</h2>
        <ul class="flex flex-col">
          <li v-for="f in member.following" :key="f.id">
            <RouterLink
              :to="{ name: 'creator', params: { handle: f.creatorHandle, slug: f.pageSlug } }"
              class="flex flex-wrap items-baseline gap-x-2 rounded-lg py-2 hover:underline"
            >
              <span class="font-medium">{{ f.pageName }}</span>
              <span class="text-sm text-muted">@{{ f.creatorHandle }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="card p-5">
        <h2 class="font-semibold">Make things?</h2>
        <p class="mt-1 text-[15px] text-body">
          Start a page, offer memberships and get paid by the people who follow your work.
        </p>
        <RouterLink :to="{ name: 'studio' }" class="btn-secondary mt-4 w-full">
          Open creator studio
        </RouterLink>
      </div>
    </aside>
  </div>
</template>
