<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { useMemberStore } from '@/stores/member'
import { loadCreatorPage, type CreatorPage } from '@/lib/creator'
import {
  currentMembership,
  loadPosts,
  loadTiers,
  toggleLike,
  type PostView,
  type Tier,
} from '@/lib/posts'
import { useFileUrl } from '@/composables/fileUrl'
import UserAvatar from '@/components/UserAvatar.vue'
import PostCard from '@/components/PostCard.vue'
import TierCard from '@/components/TierCard.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'

const route = useRoute()
const auth = useAuthStore()
const member = useMemberStore()

const state: Ref<CreatorPage | undefined> = ref()
const error = ref('')
const tiers: Ref<Tier[]> = ref([])
const posts: Ref<PostView[]> = ref([])
const tab: Ref<'posts' | 'about'> = ref('posts')
const busy = ref(false)

const page = computed(() => state.value?.page)
const creator = computed(() => state.value?.creator)
const isOwner = computed(() => creator.value?.id === auth.me?.id)
const membership = computed(() => currentMembership(tiers.value))
const following = computed(() => (page.value ? member.isFollowing(page.value.id) : false))
const otherPages = computed(() => state.value?.pages.filter((p) => p.id !== page.value?.id) ?? [])
const coverUrl = useFileUrl(
  () => creator.value?.id,
  () => page.value?.coverFileId,
)
// Highlight the middle tier, like most membership pages
const highlightId = computed(() => tiers.value[Math.floor((tiers.value.length - 1) / 2)]?.id)

async function load() {
  error.value = ''
  state.value = undefined
  try {
    state.value = await loadCreatorPage(
      route.params.handle as string,
      (route.params.slug as string) || undefined,
    )
    tab.value = 'posts'
    await Promise.all([reloadAccess(), member.load()])
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

/** Tiers and posts depend on what the viewer bought */
async function reloadAccess() {
  if (!state.value || !auth.me) return
  const { creator, page } = state.value
  const [t, p] = await Promise.all([
    loadTiers(creator.id, page.id),
    loadPosts(creator.id, [page.id], auth.me.id),
  ])
  tiers.value = t
  posts.value = p
}

function join(tier: Tier) {
  const current = membership.value
  const onClose = () => {
    void reloadAccess()
    void member.load()
  }
  if (current && current.purchase.type === 'subscription') {
    bzr.monetization.purchases.openPopup({ purchaseId: current.purchase.id }, onClose)
  } else {
    bzr.monetization.purchases.openPopup({ productId: tier.id }, onClose)
  }
}

async function toggleFollow() {
  if (!state.value || !auth.me) return
  busy.value = true
  try {
    if (following.value) {
      await member.unfollow(state.value.page.id, state.value.creator.id, auth.me)
    } else {
      await member.follow(state.value.page, state.value.creator, auth.me)
    }
  } finally {
    busy.value = false
  }
}

function scrollToTiers() {
  document.getElementById('membership')?.scrollIntoView({ behavior: 'smooth' })
}

watch(() => [route.params.handle, route.params.slug], load, { immediate: true })
</script>

<template>
  <div v-if="error" class="mx-auto max-w-[1160px] px-4 py-16 sm:px-6">
    <p class="text-lg">{{ error }}</p>
    <RouterLink :to="{ name: 'home' }" class="mt-4 inline-block text-accent hover:underline">
      Back to your feed
    </RouterLink>
  </div>
  <div v-else-if="!state || !page || !creator" class="flex justify-center py-24">
    <LoaderSVG width="32px" />
  </div>
  <div v-else :style="{ '--accent': page.accent }">
    <div
      class="flex h-[200px] items-end justify-end bg-accent bg-cover bg-center sm:h-[260px]"
      :style="coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}"
    ></div>

    <div class="mx-auto max-w-[1160px] px-4 sm:px-6">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="flex flex-wrap items-end gap-5">
          <div class="-mt-14 rounded-full border-[5px] border-paper">
            <UserAvatar :name="page.name" :size="110" />
          </div>
          <div class="pb-1.5">
            <h1 class="text-[32px] font-extrabold leading-tight tracking-tight sm:text-4xl">
              {{ page.name }}
            </h1>
            <p class="mt-1 text-muted">
              <template v-if="page.tagline">{{ page.tagline }} · </template>@{{ creator.handle }}
            </p>
          </div>
        </div>
        <div class="flex gap-2.5 pb-1.5">
          <RouterLink
            v-if="isOwner"
            :to="{ name: 'studio-page', params: { pageId: page.id } }"
            class="btn-secondary"
          >
            Edit page
          </RouterLink>
          <template v-else>
            <button class="btn-secondary" :disabled="busy" @click="toggleFollow">
              {{ following ? 'Following' : 'Follow' }}
            </button>
            <button v-if="tiers.length > 0" class="btn-primary" @click="scrollToTiers">
              {{ membership ? 'Your membership' : 'Become a member' }}
            </button>
          </template>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-7 border-b border-line" role="tablist">
        <button
          v-for="t in ['posts', 'about'] as const"
          :key="t"
          role="tab"
          :aria-selected="tab === t"
          class="-mb-px border-b-2 py-3 capitalize"
          :class="
            tab === t ? 'border-ink font-semibold' : 'border-transparent text-muted hover:text-ink'
          "
          @click="tab = t"
        >
          {{ t }}
        </button>
      </div>

      <div class="flex flex-wrap items-start gap-8 pb-16 pt-7">
        <main class="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <template v-if="tab === 'posts'">
            <p v-if="posts.length === 0" class="card p-6 text-muted">No posts yet.</p>
            <PostCard
              v-for="view in posts"
              :key="view.post.id"
              :view="view"
              :is-member="!!membership"
              @like="toggleLike(view, auth.me!.id)"
              @unlock="view.minTier && join(view.minTier)"
            />
          </template>
          <div v-else class="card p-6">
            <p v-if="page.about" class="whitespace-pre-line text-[17px] leading-relaxed text-body">
              {{ page.about }}
            </p>
            <p v-else class="text-muted">{{ page.name }} hasn't written an about section yet.</p>
            <div v-if="otherPages.length > 0" class="mt-6 border-t border-line pt-5">
              <h2 class="mb-2 font-semibold">More from @{{ creator.handle }}</h2>
              <ul class="flex flex-wrap gap-2">
                <li v-for="p in otherPages" :key="p.id">
                  <RouterLink
                    :to="{ name: 'creator', params: { handle: creator.handle, slug: p.slug } }"
                    class="btn-secondary btn-sm"
                  >
                    {{ p.name }}
                  </RouterLink>
                </li>
              </ul>
            </div>
          </div>
        </main>

        <aside id="membership" class="flex flex-[1_1_320px] flex-col gap-3.5">
          <h2 class="text-lg font-semibold">
            {{ membership ? 'Your membership' : 'Choose a membership' }}
          </h2>
          <p v-if="tiers.length === 0" class="card p-5 text-muted">
            {{
              isOwner
                ? 'Add tiers in the creator studio.'
                : 'No memberships yet. Follow to get updates.'
            }}
          </p>
          <TierCard
            v-for="tier in tiers"
            :key="tier.id"
            :tier="tier"
            :highlight="!membership && tier.id === highlightId"
            :current="membership?.tier.id === tier.id"
            :switching="!!membership"
            :disabled="isOwner"
            @join="join(tier)"
          />
          <p v-if="membership" class="text-sm text-muted">
            <template
              v-if="membership.purchase.type === 'subscription' && membership.purchase.canceled"
            >
              Ends on your next billing date.
            </template>
            <RouterLink :to="{ name: 'memberships' }" class="text-accent hover:underline">
              Manage memberships
            </RouterLink>
          </p>
        </aside>
      </div>
    </div>
  </div>
</template>
