<script setup lang="ts">
import { onMounted, ref, type Ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Purchase, User } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { useAuthStore } from '@/stores/auth'
import { useMemberStore } from '@/stores/member'
import { creatorData } from '@/lib/data'
import { ACTIVE_STATUSES, getUser } from '@/lib/posts'
import { formatDate, formatPrice } from '@/lib/format'
import type { Page } from '@/types'
import LoaderSVG from '@/components/LoaderSVG.vue'
import UserAvatar from '@/components/UserAvatar.vue'

type Membership = { purchase: Purchase; creator?: User; page?: Page }

const auth = useAuthStore()
const member = useMemberStore()
const active: Ref<Membership[]> = ref([])
const past: Ref<Membership[]> = ref([])
const loading = ref(true)

async function describe(purchase: Purchase): Promise<Membership> {
  const sellerId = purchase.product.sellerId
  const [creator, page] = await Promise.allSettled([
    getUser(sellerId),
    creatorData(sellerId).then((d) => d.pages.getOne(purchase.product.group)),
  ])
  return {
    purchase,
    creator: creator.status === 'fulfilled' ? creator.value : undefined,
    page: page.status === 'fulfilled' ? (page.value ?? undefined) : undefined,
  }
}

async function load() {
  await member.load()
  const all = await Promise.all(member.purchases.map(describe))
  active.value = all.filter((m) => ACTIVE_STATUSES.includes(m.purchase.status))
  past.value = all.filter((m) => !ACTIVE_STATUSES.includes(m.purchase.status))
  loading.value = false
}

function manage(purchase: Purchase) {
  bzr.monetization.purchases.openPopup({ purchaseId: purchase.id }, () => void load())
}

onMounted(load)
</script>

<template>
  <div class="mx-auto flex max-w-[860px] flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
    <h1 class="text-[28px] font-extrabold tracking-tight">Memberships</h1>
    <div v-if="loading" class="flex justify-center py-16"><LoaderSVG width="32px" /></div>
    <template v-else>
      <section aria-labelledby="active-heading">
        <h2 id="active-heading" class="mb-3 text-lg font-semibold">Active</h2>
        <p v-if="active.length === 0" class="card p-5 text-muted">
          You're not a member anywhere yet. Join a tier on a creator's page to support them.
        </p>
        <ul class="flex flex-col gap-3">
          <li
            v-for="m in active"
            :key="m.purchase.id"
            class="card flex flex-wrap items-center gap-4 p-5"
          >
            <UserAvatar :name="m.page?.name ?? m.creator?.name ?? ''" :size="48" />
            <div class="min-w-0 flex-[1_1_240px]">
              <RouterLink
                v-if="m.creator && m.page"
                :to="{ name: 'creator', params: { handle: m.creator.handle, slug: m.page.slug } }"
                class="text-lg font-semibold hover:underline"
              >
                {{ m.page.name }}
              </RouterLink>
              <div v-else class="text-lg font-semibold">
                {{ m.creator?.name ?? 'Unknown creator' }}
              </div>
              <div class="text-[15px] text-body">
                {{ m.purchase.product.name }} ·
                {{ formatPrice(m.purchase.product.costInCents) }}/month
              </div>
              <div class="text-sm text-muted">
                <template v-if="m.purchase.status === 'past_due'">
                  Payment failed. Update your payment method to keep access.
                </template>
                <template v-else-if="m.purchase.type === 'subscription' && m.purchase.canceled">
                  Ends {{ formatDate(m.purchase.nextInvoice) }}
                </template>
                <template v-else-if="m.purchase.type === 'subscription'">
                  Renews {{ formatDate(m.purchase.nextInvoice) }}
                </template>
              </div>
            </div>
            <button
              v-if="m.purchase.type === 'subscription'"
              class="btn-secondary"
              @click="manage(m.purchase)"
            >
              Change or cancel
            </button>
          </li>
        </ul>
      </section>

      <section aria-labelledby="following-heading">
        <h2 id="following-heading" class="mb-3 text-lg font-semibold">Following</h2>
        <p v-if="member.following.length === 0" class="card p-5 text-muted">
          Follow a page for free to see its public posts in your feed.
        </p>
        <ul class="card divide-y divide-line">
          <li
            v-for="f in member.following"
            :key="f.id"
            class="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
          >
            <RouterLink
              :to="{ name: 'creator', params: { handle: f.creatorHandle, slug: f.pageSlug } }"
              class="hover:underline"
            >
              <span class="font-medium">{{ f.pageName }}</span>
              <span class="text-sm text-muted"> @{{ f.creatorHandle }}</span>
            </RouterLink>
            <button
              class="btn-ghost btn-sm"
              @click="member.unfollow(f.pageId, f.creatorId, auth.me!)"
            >
              Unfollow
            </button>
          </li>
        </ul>
      </section>

      <section v-if="past.length > 0" aria-labelledby="past-heading">
        <h2 id="past-heading" class="mb-3 text-lg font-semibold">Past</h2>
        <ul class="card divide-y divide-line">
          <li v-for="m in past" :key="m.purchase.id" class="px-5 py-3 text-[15px]">
            <span class="font-medium">{{
              m.page?.name ?? m.creator?.name ?? 'Unknown creator'
            }}</span>
            <span class="text-muted">
              · {{ m.purchase.product.name }} · {{ m.purchase.status }}</span
            >
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
