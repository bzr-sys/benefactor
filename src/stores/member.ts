import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { Purchase, User } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { creatorData, mine } from '@/lib/data'
import { ACTIVE_STATUSES } from '@/lib/posts'
import type { Following, Page } from '@/types'

/** What the signed-in user supports and follows */
export const useMemberStore = defineStore('member', () => {
  const purchases: Ref<Purchase[]> = ref([])
  const following: Ref<Following[]> = ref([])

  async function load() {
    const [p, f] = await Promise.all([bzr.monetization.purchases.list(), mine.following.getAll()])
    purchases.value = p
    following.value = f
  }

  function activePurchases() {
    return purchases.value.filter((p) => ACTIVE_STATUSES.includes(p.status))
  }

  function isFollowing(pageId: string) {
    return following.value.some((f) => f.pageId === pageId)
  }

  async function follow(page: Page, creator: User, me: User) {
    const data = await creatorData(creator.id)
    await data.followers.insertOne({
      id: `${page.id}_${me.id}`,
      pageId: page.id,
      userId: me.id,
      name: me.name,
      handle: me.handle,
    })
    const entry: Following = {
      id: page.id,
      creatorId: creator.id,
      creatorHandle: creator.handle,
      pageId: page.id,
      pageName: page.name,
      pageSlug: page.slug,
    }
    await mine.following.insertOne(entry)
    following.value.push(entry)
  }

  async function unfollow(pageId: string, creatorId: string, me: User) {
    const data = await creatorData(creatorId)
    await Promise.allSettled([
      data.followers.deleteOne(`${pageId}_${me.id}`),
      mine.following.deleteOne(pageId),
    ])
    following.value = following.value.filter((f) => f.pageId !== pageId)
  }

  /** Creators to show in the feed: creator ID → page IDs */
  function feedSources() {
    const sources = new Map<string, Set<string>>()
    const add = (creatorId: string, pageId: string) => {
      if (!sources.has(creatorId)) sources.set(creatorId, new Set())
      sources.get(creatorId)!.add(pageId)
    }
    for (const f of following.value) add(f.creatorId, f.pageId)
    for (const p of activePurchases()) add(p.product.sellerId, p.product.group)
    return sources
  }

  return { purchases, following, load, activePurchases, isFollowing, follow, unfollow, feedSources }
})
