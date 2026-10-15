<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatDate, formatPrice } from '@/lib/format'
import type { PostView } from '@/lib/posts'
import { useFileUrl } from '@/composables/fileUrl'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  view: PostView
  /** Show the full body instead of a preview */
  full?: boolean
  /** Show which page the post is from (feed) */
  showSource?: boolean
  /** The viewer already has a membership on this page */
  isMember?: boolean
}>()
defineEmits<{ like: []; unlock: [] }>()

const imageUrl = useFileUrl(
  () => props.view.creator.id,
  () => (props.view.body ? props.view.post.imageFileId : undefined),
)
const postLink = computed(() => ({
  name: 'post',
  params: {
    handle: props.view.creator.handle,
    slug: props.view.page.slug,
    postId: props.view.post.id,
  },
}))
const pageLink = computed(() => ({
  name: 'creator',
  params: { handle: props.view.creator.handle, slug: props.view.page.slug },
}))
</script>

<template>
  <article class="card overflow-hidden">
    <template v-if="view.body">
      <div v-if="view.post.imageFileId" class="aspect-[16/9] bg-well">
        <img v-if="imageUrl" :src="imageUrl" alt="" class="h-full w-full object-cover" />
      </div>
    </template>
    <div
      v-else
      class="flex min-h-[200px] flex-col items-center justify-center gap-3 bg-ink p-6 text-center text-white"
    >
      <AppIcon name="lock" :size="28" />
      <div class="font-semibold">
        Unlock with {{ view.minTier?.name ?? 'a membership' }}{{ view.minTier ? ' or above' : '' }}
      </div>
      <button v-if="view.minTier" class="btn-primary" @click="$emit('unlock')">
        <template v-if="isMember">Upgrade to {{ view.minTier.name }}</template>
        <template v-else>Join for {{ formatPrice(view.minTier.costInCents) }}/month</template>
      </button>
    </div>

    <div class="px-6 pb-5 pt-5">
      <div class="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <RouterLink v-if="showSource" :to="pageLink" class="font-semibold text-ink hover:underline">
          {{ view.page.name }}
        </RouterLink>
        <span v-if="!view.post.minTierId" class="pill bg-[#EEF0FF] text-[#1F35C9]">Public</span>
        <span v-else class="pill bg-ink text-white">{{ view.minTier?.name ?? 'Members' }}</span>
        <span>{{ formatDate(view.post.created) }}</span>
      </div>
      <h2 class="mb-1.5 mt-2.5 text-[22px] font-bold leading-tight tracking-tight">
        <RouterLink v-if="!full" :to="postLink" class="hover:underline">{{
          view.post.title
        }}</RouterLink>
        <template v-else>{{ view.post.title }}</template>
      </h2>
      <p v-if="view.post.teaser" class="text-body">{{ view.post.teaser }}</p>
      <div
        v-if="view.body?.body"
        class="mt-3 whitespace-pre-line text-body"
        :class="full ? 'text-[17px] leading-relaxed' : 'line-clamp-4'"
      >
        {{ view.body.body }}
      </div>
      <div class="mt-4 flex gap-2">
        <button
          class="btn-secondary btn-sm"
          :class="view.liked ? 'border-accent text-accent' : ''"
          :aria-pressed="view.liked"
          :aria-label="view.liked ? 'Unlike' : 'Like'"
          @click="$emit('like')"
        >
          <AppIcon name="heart" />{{ view.likeCount }}
        </button>
        <RouterLink :to="postLink" class="btn-secondary btn-sm" aria-label="Comments">
          <AppIcon name="comment" />{{ view.commentCount }}
        </RouterLink>
      </div>
    </div>
  </article>
</template>
