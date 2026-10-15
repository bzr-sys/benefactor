<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore, type PostDraft } from '@/stores/studio'
import { mine } from '@/lib/data'
import { loadTiers, type Tier } from '@/lib/posts'
import { formatPrice } from '@/lib/format'
import { useFileUrl } from '@/composables/fileUrl'
import AppIcon from '@/components/AppIcon.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studio = useStudioStore()

const pageId = computed(() => route.params.pageId as string)
const postId = computed(() => (route.params.postId as string) || undefined)
const page = computed(() => studio.pages.find((p) => p.id === pageId.value))

const draft: Ref<PostDraft> = ref({ title: '', teaser: '', body: '' })
const tiers: Ref<Tier[]> = ref([])
const notify = ref(true)
const email = ref(false)
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')

const imageUrl = useFileUrl(
  () => auth.me?.id,
  () => draft.value.imageFileId,
)

async function load() {
  loading.value = true
  try {
    if (!studio.loaded) await studio.load()
    tiers.value = await loadTiers(auth.me!.id, pageId.value)
    if (postId.value) {
      const [post, body] = await Promise.all([
        mine.posts.getOne(postId.value),
        mine.bodies.getOne(postId.value),
      ])
      if (post) {
        draft.value = {
          title: post.title,
          teaser: post.teaser,
          body: body?.body ?? '',
          minTierId: post.minTierId,
          imageFileId: post.imageFileId,
        }
      }
    }
  } finally {
    loading.value = false
  }
}

async function uploadImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    draft.value.imageFileId = await studio.uploadImage(file)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    uploading.value = false
  }
}

async function save() {
  error.value = ''
  if (!draft.value.title.trim()) {
    error.value = 'Give your post a title.'
    return
  }
  if (!page.value || !auth.me) return
  saving.value = true
  try {
    const post = await studio.savePost(
      pageId.value,
      tiers.value,
      { ...draft.value, title: draft.value.title.trim() },
      postId.value,
    )
    const query: Record<string, string> = { tab: 'posts' }
    if (!postId.value && notify.value) {
      query.notified = String(await studio.notify(page.value, post, auth.me, email.value))
    }
    await router.push({ name: 'studio-page', params: { pageId: pageId.value }, query })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

watch([pageId, postId], load, { immediate: true })
</script>

<template>
  <div class="mx-auto max-w-[760px] px-4 pb-16 pt-6 sm:px-6" :style="{ '--accent': page?.accent }">
    <RouterLink
      :to="{ name: 'studio-page', params: { pageId } }"
      class="mb-2 inline-flex items-center gap-2 py-2 font-medium text-muted hover:text-ink"
    >
      <AppIcon name="back" /> {{ page?.name ?? 'Back' }}
    </RouterLink>
    <h1 class="mb-5 text-[28px] font-extrabold tracking-tight">
      {{ postId ? 'Edit post' : 'New post' }}
    </h1>

    <div v-if="loading" class="flex justify-center py-16"><LoaderSVG width="32px" /></div>
    <form v-else class="card flex flex-col gap-5 p-6" @submit.prevent="save">
      <div>
        <label for="title" class="label">Title</label>
        <input id="title" v-model="draft.title" class="input text-lg" maxlength="140" />
      </div>
      <div>
        <label for="teaser" class="label">Teaser</label>
        <input id="teaser" v-model="draft.teaser" class="input" maxlength="280" />
        <p class="hint">Everyone sees the title and teaser, even on locked posts.</p>
      </div>
      <div>
        <label for="body" class="label">Post</label>
        <textarea
          id="body"
          v-model="draft.body"
          rows="10"
          class="input resize-y leading-relaxed"
        ></textarea>
      </div>
      <div>
        <span class="label">Image</span>
        <div v-if="draft.imageFileId" class="mb-2 overflow-hidden rounded-[10px] bg-well">
          <img v-if="imageUrl" :src="imageUrl" alt="" class="max-h-72 w-full object-cover" />
        </div>
        <div class="flex gap-2">
          <label class="btn-secondary btn-sm cursor-pointer">
            <AppIcon name="image" />
            {{ uploading ? 'Uploading…' : draft.imageFileId ? 'Replace image' : 'Add image' }}
            <input
              type="file"
              accept="image/*"
              class="sr-only"
              :disabled="uploading"
              @change="uploadImage"
            />
          </label>
          <button
            v-if="draft.imageFileId"
            type="button"
            class="btn-ghost btn-sm"
            @click="draft.imageFileId = undefined"
          >
            Remove
          </button>
        </div>
        <p class="hint">
          Images are stored publicly; only members see them in the app on locked posts.
        </p>
      </div>
      <div>
        <label for="access" class="label">Who can see it</label>
        <select id="access" v-model="draft.minTierId" class="input">
          <option :value="undefined">Everyone (public)</option>
          <option v-for="tier in tiers" :key="tier.id" :value="tier.id">
            {{ tier.name }} ({{ formatPrice(tier.costInCents) }}) and above
          </option>
        </select>
      </div>
      <fieldset v-if="!postId" class="flex flex-col gap-2">
        <legend class="label">Notify</legend>
        <label class="flex items-center gap-3">
          <input v-model="notify" type="checkbox" class="h-5 w-5 accent-[var(--accent)]" />
          Tell members and followers about this post
        </label>
        <label class="flex items-center gap-3" :class="notify ? '' : 'opacity-50'">
          <input
            v-model="email"
            type="checkbox"
            class="h-5 w-5 accent-[var(--accent)]"
            :disabled="!notify"
          />
          Also send an email
        </label>
      </fieldset>
      <p v-if="error" class="text-[15px] text-[#B42318]" role="alert">{{ error }}</p>
      <div class="flex gap-2">
        <button class="btn-primary" :disabled="saving || uploading">
          {{ postId ? 'Save changes' : 'Publish' }}
        </button>
        <RouterLink :to="{ name: 'studio-page', params: { pageId } }" class="btn-secondary"
          >Cancel</RouterLink
        >
      </div>
    </form>
  </div>
</template>
