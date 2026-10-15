<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { loadCreatorPage, type CreatorPage } from '@/lib/creator'
import {
  currentMembership,
  loadPosts,
  loadTiers,
  toggleLike,
  type PostView,
  type Tier,
} from '@/lib/posts'
import { formatDate } from '@/lib/format'
import type { Comment } from '@/types'
import PostCard from '@/components/PostCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'

const route = useRoute()
const auth = useAuthStore()

const state: Ref<CreatorPage | undefined> = ref()
const view: Ref<PostView | undefined> = ref()
const tiers: Ref<Tier[]> = ref([])
const comments: Ref<Comment[]> = ref([])
const error = ref('')
const draft = ref('')
const sending = ref(false)

const membership = computed(() => currentMembership(tiers.value))
const isOwner = computed(() => state.value?.creator.id === auth.me?.id)

async function load() {
  error.value = ''
  view.value = undefined
  try {
    state.value = await loadCreatorPage(route.params.handle as string, route.params.slug as string)
    await reload()
    if (!view.value) error.value = 'This post does not exist.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function reload() {
  if (!state.value || !auth.me) return
  const { creator, page, data } = state.value
  const postId = route.params.postId as string
  const [views, t, c] = await Promise.all([
    loadPosts(creator.id, [page.id], auth.me.id, { postId }),
    loadTiers(creator.id, page.id),
    data.comments.getAll({ postId }),
  ])
  view.value = views[0]
  tiers.value = t
  comments.value = c.sort((a, b) => a.created.localeCompare(b.created))
}

function unlock(tier: Tier) {
  const current = membership.value
  if (current && current.purchase.type === 'subscription') {
    bzr.monetization.purchases.openPopup({ purchaseId: current.purchase.id }, () => void reload())
  } else {
    bzr.monetization.purchases.openPopup({ productId: tier.id }, () => void reload())
  }
}

async function addComment() {
  const text = draft.value.trim()
  if (!text || !state.value || !auth.me || !view.value) return
  sending.value = true
  try {
    const comment: Comment = {
      id: crypto.randomUUID(),
      postId: view.value.post.id,
      authorId: auth.me.id,
      authorName: auth.me.name,
      authorHandle: auth.me.handle,
      text,
      created: new Date().toISOString(),
    }
    await state.value.data.comments.insertOne(comment)
    comments.value.push(comment)
    view.value.commentCount++
    draft.value = ''
  } finally {
    sending.value = false
  }
}

async function deleteComment(comment: Comment) {
  if (!state.value || !view.value) return
  await state.value.data.comments.deleteOne(comment.id)
  comments.value = comments.value.filter((c) => c.id !== comment.id)
  view.value.commentCount--
}

watch(() => route.params.postId, load, { immediate: true })
</script>

<template>
  <div
    class="mx-auto max-w-[760px] px-4 pb-16 pt-6 sm:px-6"
    :style="{ '--accent': state?.page.accent }"
  >
    <div v-if="error" class="py-10">
      <p class="text-lg">{{ error }}</p>
      <RouterLink :to="{ name: 'home' }" class="mt-4 inline-block text-accent hover:underline">
        Back to your feed
      </RouterLink>
    </div>
    <div v-else-if="!view || !state" class="flex justify-center py-24">
      <LoaderSVG width="32px" />
    </div>
    <template v-else>
      <RouterLink
        :to="{ name: 'creator', params: { handle: state.creator.handle, slug: state.page.slug } }"
        class="mb-4 inline-flex items-center gap-2 py-2 font-medium text-muted hover:text-ink"
      >
        <AppIcon name="back" /> {{ state.page.name }}
      </RouterLink>
      <PostCard
        :view="view"
        full
        :is-member="!!membership"
        @like="toggleLike(view, auth.me!.id)"
        @unlock="view.minTier && unlock(view.minTier)"
      />

      <section class="mt-8" aria-labelledby="comments-heading">
        <h2 id="comments-heading" class="mb-4 text-lg font-semibold">
          Comments <span class="text-muted">{{ comments.length }}</span>
        </h2>
        <form
          v-if="view.body"
          class="card mb-5 flex flex-col gap-3 p-4"
          @submit.prevent="addComment"
        >
          <label for="comment" class="sr-only">Write a comment</label>
          <textarea
            id="comment"
            v-model="draft"
            rows="3"
            maxlength="2000"
            class="input resize-y"
            placeholder="Write a comment"
          ></textarea>
          <div class="flex justify-end">
            <button class="btn-primary" :disabled="sending || !draft.trim()">Post comment</button>
          </div>
        </form>
        <p v-else class="card mb-5 p-4 text-muted">Unlock this post to join the conversation.</p>

        <ul class="flex flex-col gap-3">
          <li v-for="comment in comments" :key="comment.id" class="card flex gap-3 p-4">
            <UserAvatar :name="comment.authorName" :size="36" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 text-sm">
                <strong class="text-base">{{ comment.authorName }}</strong>
                <span class="text-muted">@{{ comment.authorHandle }}</span>
                <span class="text-muted">{{ formatDate(comment.created) }}</span>
                <span v-if="comment.authorId === state.creator.id" class="pill bg-ink text-white">
                  Creator
                </span>
              </div>
              <p class="mt-1 whitespace-pre-line break-words text-body">{{ comment.text }}</p>
            </div>
            <button
              v-if="comment.authorId === auth.me?.id || isOwner"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper hover:text-ink"
              aria-label="Delete comment"
              @click="deleteComment(comment)"
            >
              <AppIcon name="trash" />
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
