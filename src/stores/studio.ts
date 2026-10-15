import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import {
  ProductRepeatInterval,
  SendNotification,
  type MonetizationStatus,
  type Sale,
  type User,
} from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { ensureCreatorSetup, mine, PUBLIC_DIR } from '@/lib/data'
import { ACTIVE_STATUSES, listPages, loadTiers, type Tier } from '@/lib/posts'
import { ACCENTS } from '@/lib/format'
import type { Page, Post } from '@/types'

export type PostDraft = {
  title: string
  teaser: string
  body: string
  minTierId?: string
  imageFileId?: string
}

/** The signed-in user as a creator */
export const useStudioStore = defineStore('studio', () => {
  const status: Ref<MonetizationStatus> = ref({ canMonetize: false, paymentsEnabled: false })
  const pages: Ref<Page[]> = ref([])
  const loaded = ref(false)

  async function load() {
    await ensureCreatorSetup()
    const [s, p] = await Promise.all([bzr.monetization.status(), listPages(mine.pages)])
    status.value = s
    pages.value = p
    loaded.value = true
  }

  async function refreshStatus() {
    status.value = await bzr.monetization.status()
  }

  async function createPage(input: { name: string; slug: string; tagline: string }) {
    await ensureCreatorSetup()
    const page: Page = {
      id: crypto.randomUUID(),
      ...input,
      about: '',
      accent: ACCENTS[0]!,
      created: new Date().toISOString(),
    }
    await mine.pages.insertOne(page)
    pages.value.push(page)
    return page
  }

  async function updatePage(pageId: string, update: Partial<Omit<Page, 'id'>>) {
    await mine.pages.updateOne(pageId, update)
    const page = pages.value.find((p) => p.id === pageId)
    if (page) Object.assign(page, update)
  }

  async function uploadCover(pageId: string, file: File) {
    const uploaded = await bzr.files.upload(file, { path: PUBLIC_DIR })
    await updatePage(pageId, { coverFileId: uploaded.id })
  }

  async function uploadImage(file: File) {
    const uploaded = await bzr.files.upload(file, { path: PUBLIC_DIR })
    return uploaded.id
  }

  async function deletePage(pageId: string, me: User) {
    const posts = await mine.posts.getAll({ pageId })
    for (const post of posts) await deletePost(post.id)
    for (const tier of await loadTiers(me.id, pageId)) {
      await bzr.monetization.products.delete(tier.id)
    }
    await mine.followers.deleteAll({ pageId })
    await mine.pages.deleteOne(pageId)
    pages.value = pages.value.filter((p) => p.id !== pageId)
  }

  /** Monthly tier. New tiers also unlock posts of cheaper tiers. */
  async function createTier(
    pageId: string,
    input: { name: string; description: string; costInCents: number },
  ) {
    const tier = await bzr.monetization.products.create({
      ...input,
      repeatInterval: ProductRepeatInterval.MONTH,
      group: pageId,
    })
    const posts = await mine.posts.getAll({ pageId })
    for (const post of posts) {
      if (post.minCostInCents != null && post.minCostInCents <= tier.costInCents) {
        const body = await mine.bodies.getOne(post.id)
        if (body) await mine.bodies.updateOne(post.id, { tiers: [...body.tiers, tier.id] })
      }
    }
    return tier
  }

  async function savePost(pageId: string, tiers: Tier[], draft: PostDraft, postId?: string) {
    const minTier = tiers.find((t) => t.id === draft.minTierId)
    const unlocking = minTier ? tiers.filter((t) => t.costInCents >= minTier.costInCents) : []
    const id = postId ?? crypto.randomUUID()
    const post: Post = {
      id,
      pageId,
      title: draft.title,
      teaser: draft.teaser,
      created: new Date().toISOString(),
      ...(draft.imageFileId ? { imageFileId: draft.imageFileId } : {}),
      ...(minTier ? { minTierId: minTier.id, minCostInCents: minTier.costInCents } : {}),
    }
    const body = {
      id,
      pageId,
      body: draft.body,
      public: !minTier,
      tiers: unlocking.map((t) => t.id),
    }
    if (postId) {
      const existing = await mine.posts.getOne(postId)
      if (existing) post.created = existing.created
      await mine.posts.replaceOne(id, post)
      await mine.bodies.replaceOne(id, body)
    } else {
      await mine.posts.insertOne(post)
      await mine.bodies.insertOne(body)
    }
    return post
  }

  async function deletePost(postId: string) {
    await Promise.all([
      mine.posts.deleteOne(postId),
      mine.bodies.deleteOne(postId),
      mine.comments.deleteAll({ postId }),
      mine.likes.deleteAll({ postId }),
    ])
  }

  async function listSales(pageId: string): Promise<Sale[]> {
    return bzr.monetization.sales.list({ group: pageId })
  }

  /** Tell members and followers about a new post */
  async function notify(page: Page, post: Post, me: User, email: boolean) {
    const [sales, followers] = await Promise.all([
      listSales(page.id),
      mine.followers.getAll({ pageId: page.id }),
    ])
    const recipients = new Set([
      ...sales.filter((s) => ACTIVE_STATUSES.includes(s.status)).map((s) => s.buyerId),
      ...followers.map((f) => f.userId),
    ])
    recipients.delete(me.id)
    const message = `${page.name} posted “${post.title}” on Benefactor`.slice(0, 250)
    const results = await Promise.allSettled(
      [...recipients].map((recipientId) =>
        bzr.notifications.create({
          recipientId,
          message,
          sendMessage: email ? SendNotification.ALWAYS : SendNotification.NEVER,
        }),
      ),
    )
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) console.error('Failed to notify', ...failed.map((r) => String(r.reason)))
    return results.length - failed.length
  }

  return {
    status,
    pages,
    loaded,
    load,
    refreshStatus,
    createPage,
    updatePage,
    uploadCover,
    uploadImage,
    deletePage,
    createTier,
    savePost,
    deletePost,
    listSales,
    notify,
  }
})
