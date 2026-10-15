<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { Sale } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import { mine } from '@/lib/data'
import { ACTIVE_STATUSES, loadTiers, type Tier } from '@/lib/posts'
import { ACCENTS, formatDate, formatPrice, slugify } from '@/lib/format'
import { useFileUrl } from '@/composables/fileUrl'
import type { Follower, Post } from '@/types'
import AppIcon from '@/components/AppIcon.vue'
import LoaderSVG from '@/components/LoaderSVG.vue'

type Tab = 'posts' | 'tiers' | 'supporters' | 'settings'
const tabs: { id: Tab; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'tiers', label: 'Tiers' },
  { id: 'supporters', label: 'Supporters' },
  { id: 'settings', label: 'Page settings' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studio = useStudioStore()

const pageId = computed(() => route.params.pageId as string)
const page = computed(() => studio.pages.find((p) => p.id === pageId.value))
const tab = computed<Tab>(() =>
  tabs.some((t) => t.id === route.query.tab) ? (route.query.tab as Tab) : 'posts',
)
const notice = computed(() =>
  route.query.notified != null ? Number(route.query.notified) : undefined,
)

const posts: Ref<Post[]> = ref([])
const tiers: Ref<Tier[]> = ref([])
const sales: Ref<Sale[]> = ref([])
const followers: Ref<Follower[]> = ref([])
const loading = ref(true)
const error = ref('')

const activeSales = computed(() => sales.value.filter((s) => ACTIVE_STATUSES.includes(s.status)))
const monthlyRevenue = computed(() =>
  activeSales.value
    .filter((s) => s.type === 'subscription' && !s.canceled)
    .reduce((sum, s) => sum + s.product.costInCents, 0),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!studio.loaded) await studio.load()
    if (!page.value || !auth.me) return
    const [p, t, s, f] = await Promise.all([
      mine.posts.getAll({ pageId: pageId.value }),
      loadTiers(auth.me.id, pageId.value),
      studio.listSales(pageId.value),
      mine.followers.getAll({ pageId: pageId.value }),
    ])
    posts.value = p.sort((a, b) => b.created.localeCompare(a.created))
    tiers.value = t
    sales.value = s
    followers.value = f
    resetSettings()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function tierName(tierId?: string) {
  if (!tierId) return 'Public'
  return tiers.value.find((t) => t.id === tierId)?.name ?? 'Archived tier'
}

// Posts
async function deletePost(post: Post) {
  if (!confirm(`Delete “${post.title}”? Comments and likes are deleted too.`)) return
  await studio.deletePost(post.id)
  posts.value = posts.value.filter((p) => p.id !== post.id)
}

// Tiers
const newTier = ref({ name: '', price: '', description: '' })
const tierError = ref('')
const savingTier = ref(false)
const editing: Ref<{ id: string; name: string; description: string } | undefined> = ref()

async function addTier() {
  tierError.value = ''
  const costInCents = Math.round(Number(newTier.value.price) * 100)
  if (newTier.value.name.trim().length < 3) {
    tierError.value = 'Tier names need at least 3 characters.'
    return
  }
  if (!Number.isFinite(costInCents) || costInCents < 100) {
    tierError.value = 'Tiers cost at least $1 per month.'
    return
  }
  savingTier.value = true
  try {
    await studio.createTier(pageId.value, {
      name: newTier.value.name.trim(),
      description: newTier.value.description.trim(),
      costInCents,
    })
    newTier.value = { name: '', price: '', description: '' }
    tiers.value = await loadTiers(auth.me!.id, pageId.value)
  } catch (err) {
    tierError.value = err instanceof Error ? err.message : String(err)
  } finally {
    savingTier.value = false
  }
}

async function saveTier() {
  if (!editing.value) return
  const { id, name, description } = editing.value
  await bzr.monetization.products.update(id, { name: name.trim(), description: description.trim() })
  const tier = tiers.value.find((t) => t.id === id)
  if (tier) Object.assign(tier, { name: name.trim(), description: description.trim() })
  editing.value = undefined
}

async function archiveTier(tier: Tier) {
  if (
    !confirm(
      `Archive ${tier.name}? Nobody can join it anymore. Current members keep paying until they cancel.`,
    )
  )
    return
  await bzr.monetization.products.delete(tier.id)
  tiers.value = tiers.value.filter((t) => t.id !== tier.id)
}

function membersOf(tierId: string) {
  return activeSales.value.filter((s) => s.productId === tierId).length
}

// Settings
const settings = ref({ name: '', slug: '', tagline: '', about: '', accent: ACCENTS[0]! })
const settingsSaved = ref(false)
const settingsError = ref('')
const uploading = ref(false)
const coverUrl = useFileUrl(
  () => auth.me?.id,
  () => page.value?.coverFileId,
)

function resetSettings() {
  if (!page.value) return
  const { name, slug, tagline, about, accent } = page.value
  settings.value = { name, slug, tagline, about, accent }
}

async function saveSettings() {
  settingsSaved.value = false
  settingsError.value = ''
  const slug = slugify(settings.value.slug)
  if (!settings.value.name.trim() || !slug) {
    settingsError.value = 'Your page needs a name and an address.'
    return
  }
  if (studio.pages.some((p) => p.slug === slug && p.id !== pageId.value)) {
    settingsError.value = 'Another of your pages uses this address.'
    return
  }
  await studio.updatePage(pageId.value, {
    ...settings.value,
    name: settings.value.name.trim(),
    slug,
  })
  settings.value.slug = slug
  settingsSaved.value = true
}

async function uploadCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    await studio.uploadCover(pageId.value, file)
  } catch (err) {
    settingsError.value = err instanceof Error ? err.message : String(err)
  } finally {
    uploading.value = false
  }
}

async function deletePage() {
  if (!page.value || !auth.me) return
  if (
    !confirm(
      `Delete ${page.value.name}? Posts are deleted and all tiers are archived. This cannot be undone.`,
    )
  )
    return
  await studio.deletePage(pageId.value, auth.me)
  await router.push({ name: 'studio' })
}

watch(pageId, load, { immediate: true })
</script>

<template>
  <div class="mx-auto max-w-[1160px] px-4 pb-16 pt-6 sm:px-6" :style="{ '--accent': page?.accent }">
    <RouterLink
      :to="{ name: 'studio' }"
      class="mb-2 inline-flex items-center gap-2 py-2 font-medium text-muted hover:text-ink"
    >
      <AppIcon name="back" /> Creator studio
    </RouterLink>

    <div v-if="loading" class="flex justify-center py-16"><LoaderSVG width="32px" /></div>
    <p v-else-if="error" class="card p-6" role="alert">{{ error }}</p>
    <p v-else-if="!page" class="card p-6">This page does not exist.</p>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-[28px] font-extrabold tracking-tight">{{ page.name }}</h1>
        <div class="flex gap-2">
          <RouterLink
            :to="{ name: 'creator', params: { handle: auth.me?.handle, slug: page.slug } }"
            class="btn-secondary"
          >
            View page
          </RouterLink>
          <RouterLink :to="{ name: 'post-new', params: { pageId: page.id } }" class="btn-primary">
            <AppIcon name="plus" /> New post
          </RouterLink>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="card p-4">
          <div class="text-sm text-muted">Members</div>
          <div class="text-2xl font-bold">{{ activeSales.length }}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-muted">Monthly revenue</div>
          <div class="text-2xl font-bold">{{ formatPrice(monthlyRevenue) }}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-muted">Followers</div>
          <div class="text-2xl font-bold">{{ followers.length }}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-muted">Posts</div>
          <div class="text-2xl font-bold">{{ posts.length }}</div>
        </div>
      </div>

      <nav class="mt-6 flex flex-wrap gap-x-7 border-b border-line" aria-label="Page sections">
        <RouterLink
          v-for="t in tabs"
          :key="t.id"
          :to="{ query: { tab: t.id } }"
          class="-mb-px border-b-2 py-3"
          :class="
            tab === t.id
              ? 'border-ink font-semibold'
              : 'border-transparent text-muted hover:text-ink'
          "
        >
          {{ t.label }}
        </RouterLink>
      </nav>

      <!-- Posts -->
      <section v-if="tab === 'posts'" class="pt-6">
        <p v-if="notice != null" class="card mb-4 p-4" role="status">
          Published. {{ notice === 1 ? '1 person was' : `${notice} people were` }} notified.
        </p>
        <p v-if="posts.length === 0" class="card p-6 text-muted">
          No posts yet. Your first post shows up on your page and in your followers' feeds.
        </p>
        <ul v-else class="card divide-y divide-line">
          <li
            v-for="post in posts"
            :key="post.id"
            class="flex flex-wrap items-center gap-3 px-5 py-4"
          >
            <div class="min-w-0 flex-[1_1_260px]">
              <div class="font-semibold">{{ post.title }}</div>
              <div class="text-sm text-muted">
                {{ formatDate(post.created) }} · {{ tierName(post.minTierId)
                }}{{ post.minTierId ? ' and above' : '' }}
              </div>
            </div>
            <RouterLink
              :to="{ name: 'post-edit', params: { pageId: page.id, postId: post.id } }"
              class="btn-secondary btn-sm"
            >
              Edit
            </RouterLink>
            <button class="btn-ghost btn-sm" @click="deletePost(post)">Delete</button>
          </li>
        </ul>
      </section>

      <!-- Tiers -->
      <section v-else-if="tab === 'tiers'" class="flex flex-wrap items-start gap-8 pt-6">
        <div class="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
          <p v-if="tiers.length === 0" class="card p-6 text-muted">
            No tiers yet. Most creators start with two or three, from a small thank-you to a premium
            tier.
          </p>
          <div v-for="tier in tiers" :key="tier.id" class="card p-5">
            <form
              v-if="editing?.id === tier.id"
              class="flex flex-col gap-3"
              @submit.prevent="saveTier"
            >
              <div>
                <label :for="`tier-name-${tier.id}`" class="label">Name</label>
                <input
                  :id="`tier-name-${tier.id}`"
                  v-model="editing.name"
                  class="input"
                  minlength="3"
                  required
                />
              </div>
              <div>
                <label :for="`tier-desc-${tier.id}`" class="label">Benefits</label>
                <textarea
                  :id="`tier-desc-${tier.id}`"
                  v-model="editing.description"
                  rows="3"
                  class="input"
                ></textarea>
              </div>
              <p class="hint">
                Prices can't change. Archive the tier and create a new one instead.
              </p>
              <div class="flex gap-2">
                <button class="btn-primary btn-sm">Save</button>
                <button type="button" class="btn-secondary btn-sm" @click="editing = undefined">
                  Cancel
                </button>
              </div>
            </form>
            <template v-else>
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <strong class="text-[17px]">{{ tier.name }}</strong>
                <span
                  ><strong class="text-lg">{{ formatPrice(tier.costInCents) }}</strong
                  ><span class="text-muted"> /mo</span></span
                >
              </div>
              <p v-if="tier.description" class="mt-1.5 whitespace-pre-line text-[15px] text-body">
                {{ tier.description }}
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span class="mr-auto text-sm text-muted">{{ membersOf(tier.id) }} members</span>
                <button
                  class="btn-secondary btn-sm"
                  @click="editing = { id: tier.id, name: tier.name, description: tier.description }"
                >
                  Edit
                </button>
                <button class="btn-ghost btn-sm" @click="archiveTier(tier)">Archive</button>
              </div>
            </template>
          </div>
        </div>

        <form class="card flex flex-[1_1_320px] flex-col gap-4 p-5" @submit.prevent="addTier">
          <h2 class="text-lg font-bold">Add a tier</h2>
          <p v-if="!studio.status.canMonetize" class="text-[15px] text-body">
            Tiers need a Bazaar Creator plan.
            <RouterLink :to="{ name: 'studio' }" class="text-accent hover:underline"
              >Set it up</RouterLink
            >
          </p>
          <p v-else-if="!studio.status.paymentsEnabled" class="text-[15px] text-body">
            Nobody can join until your payout account is set up.
            <RouterLink :to="{ name: 'studio' }" class="text-accent hover:underline"
              >Finish setup</RouterLink
            >
          </p>
          <fieldset
            :disabled="!studio.status.canMonetize || savingTier"
            class="flex flex-col gap-4"
          >
            <div>
              <label for="tier-name" class="label">Name</label>
              <input
                id="tier-name"
                v-model="newTier.name"
                class="input"
                placeholder="Supporter"
                maxlength="60"
              />
            </div>
            <div>
              <label for="tier-price" class="label">Price per month (USD)</label>
              <input
                id="tier-price"
                v-model="newTier.price"
                class="input"
                type="number"
                min="1"
                step="0.01"
                placeholder="5"
              />
            </div>
            <div>
              <label for="tier-desc" class="label">Benefits</label>
              <textarea
                id="tier-desc"
                v-model="newTier.description"
                rows="3"
                class="input"
                placeholder="What members get"
              ></textarea>
            </div>
            <p v-if="tierError" class="text-[15px] text-[#B42318]" role="alert">{{ tierError }}</p>
            <button class="btn-primary">Add tier</button>
          </fieldset>
        </form>
      </section>

      <!-- Supporters -->
      <section v-else-if="tab === 'supporters'" class="flex flex-col gap-6 pt-6">
        <div>
          <h2 class="mb-3 text-lg font-semibold">Members</h2>
          <p v-if="activeSales.length === 0" class="card p-5 text-muted">No members yet.</p>
          <div v-else class="card overflow-x-auto">
            <table class="w-full min-w-[560px] text-left">
              <thead class="text-sm text-muted">
                <tr class="border-b border-line">
                  <th class="px-5 py-3 font-medium">Member</th>
                  <th class="px-5 py-3 font-medium">Tier</th>
                  <th class="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sale in activeSales"
                  :key="sale.id"
                  class="border-b border-line last:border-0"
                >
                  <td class="px-5 py-3">
                    <div class="font-medium">{{ sale.buyer.name }}</div>
                    <div class="text-sm text-muted">@{{ sale.buyer.handle }}</div>
                  </td>
                  <td class="px-5 py-3">
                    {{ sale.product.name }} · {{ formatPrice(sale.product.costInCents) }}
                  </td>
                  <td class="px-5 py-3 text-[15px]">
                    <template v-if="sale.status === 'past_due'">Payment failed</template>
                    <template v-else-if="sale.type === 'subscription' && sale.canceled">
                      Ends {{ formatDate(sale.nextInvoice) }}
                    </template>
                    <template v-else-if="sale.type === 'subscription'">
                      Renews {{ formatDate(sale.nextInvoice) }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="hint">
            Revenue is before fees. Your share reaches your Stripe account after a holding period;
            see it in the payout dashboard via Bazaar.
          </p>
        </div>
        <div>
          <h2 class="mb-3 text-lg font-semibold">Followers</h2>
          <p v-if="followers.length === 0" class="card p-5 text-muted">No followers yet.</p>
          <ul v-else class="card divide-y divide-line">
            <li v-for="f in followers" :key="f.id" class="px-5 py-3">
              <span class="font-medium">{{ f.name }}</span>
              <span class="text-sm text-muted"> @{{ f.handle }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Settings -->
      <section v-else class="flex flex-col gap-6 pt-6">
        <form class="card flex max-w-2xl flex-col gap-4 p-6" @submit.prevent="saveSettings">
          <div>
            <span class="label">Cover image</span>
            <div
              class="flex h-36 items-end justify-end rounded-[10px] bg-accent bg-cover bg-center p-3"
              :style="coverUrl ? { backgroundImage: `url(${coverUrl})` } : {}"
            >
              <label class="btn-secondary btn-sm cursor-pointer">
                <AppIcon name="image" /> {{ uploading ? 'Uploading…' : 'Upload' }}
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  :disabled="uploading"
                  @change="uploadCover"
                />
              </label>
            </div>
            <p class="hint">Visible to everyone. Max 10 MB.</p>
          </div>
          <div>
            <label for="s-name" class="label">Name</label>
            <input id="s-name" v-model="settings.name" class="input" maxlength="80" />
          </div>
          <div>
            <label for="s-slug" class="label">Address</label>
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-muted">/u/{{ auth.me?.handle }}/</span>
              <input id="s-slug" v-model="settings.slug" class="input" maxlength="40" />
            </div>
          </div>
          <div>
            <label for="s-tagline" class="label">Tagline</label>
            <input id="s-tagline" v-model="settings.tagline" class="input" maxlength="140" />
          </div>
          <div>
            <label for="s-about" class="label">About</label>
            <textarea id="s-about" v-model="settings.about" rows="6" class="input"></textarea>
          </div>
          <fieldset>
            <legend class="label">Accent color</legend>
            <div class="flex gap-2">
              <label v-for="color in ACCENTS" :key="color" class="cursor-pointer">
                <input
                  v-model="settings.accent"
                  type="radio"
                  name="accent"
                  :value="color"
                  class="peer sr-only"
                />
                <span
                  class="block h-11 w-11 rounded-full border-4 border-white ring-2 ring-transparent peer-checked:ring-ink peer-focus-visible:ring-accent"
                  :style="{ background: color }"
                ></span>
                <span class="sr-only">{{ color }}</span>
              </label>
            </div>
          </fieldset>
          <p v-if="settingsError" class="text-[15px] text-[#B42318]" role="alert">
            {{ settingsError }}
          </p>
          <p v-if="settingsSaved" class="text-[15px]" role="status">Saved.</p>
          <div><button class="btn-primary">Save changes</button></div>
        </form>

        <div class="card max-w-2xl border-[#F3C5C0] p-6">
          <h2 class="text-lg font-bold">Delete page</h2>
          <p class="mt-1 text-[15px] text-body">
            Deletes all posts and archives every tier on this page.
          </p>
          <button
            class="btn mt-4 border border-[#B42318] bg-white text-[#B42318] hover:bg-[#FEF3F2]"
            @click="deletePage"
          >
            Delete page
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
