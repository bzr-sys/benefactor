import type { Product, User } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { creatorData, type CreatorData } from '@/lib/data'
import type { Page, Post, PostBody } from '@/types'

export type Tier = Product

/** Purchase statuses that still give access */
export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export type PostView = {
  post: Post
  /** Missing when the viewer cannot unlock the post */
  body?: PostBody
  page: Page
  creator: User
  /** Cheapest tier that unlocks a locked post */
  minTier?: Tier
  likeCount: number
  liked: boolean
  commentCount: number
}

/** Active tiers of a page, cheapest first, with the viewer's purchases attached */
export async function loadTiers(creatorId: string, pageId: string): Promise<Tier[]> {
  const tiers = await bzr.monetization.products.list({ sellerId: creatorId, group: pageId })
  return tiers.sort((a, b) => a.costInCents - b.costInCents)
}

/** The viewer's active membership among these tiers */
export function currentMembership(tiers: Tier[]) {
  for (const tier of tiers) {
    const purchase = tier.purchases.find((p) => ACTIVE_STATUSES.includes(p.status))
    if (purchase) return { tier, purchase }
  }
  return undefined
}

const users = new Map<string, Promise<User>>()

export function getUser(userId: string): Promise<User> {
  let user = users.get(userId)
  if (!user) {
    user = bzr.social.getUser({ userId })
    users.set(userId, user)
    user.catch(() => users.delete(userId))
  }
  return user
}

/** Posts of some pages of one creator, newest first, with bodies the viewer may read */
export async function loadPosts(
  creatorId: string,
  pageIds: string[],
  meId: string,
  filter: { postId?: string } = {},
): Promise<PostView[]> {
  if (pageIds.length === 0) return []
  const data = await creatorData(creatorId)
  const [creator, pages, posts] = await Promise.all([
    getUser(creatorId),
    data.pages.getAll({ id: { $in: pageIds } }),
    filter.postId != null
      ? data.posts.getAll({ id: filter.postId })
      : data.posts.getAll({ pageId: { $in: pageIds } }),
  ])
  return enrichPosts(data, creator, pages, posts, meId)
}

async function enrichPosts(
  data: CreatorData,
  creator: User,
  pages: Page[],
  posts: Post[],
  meId: string,
): Promise<PostView[]> {
  if (posts.length === 0) return []
  const postIds = posts.map((p) => p.id)
  const tierLists = await Promise.all(pages.map((p) => loadTiers(creator.id, p.id)))
  const [bodies, likes, comments] = await Promise.all([
    data.bodies.getAll({ id: { $in: postIds } }),
    data.likes.getAll({ postId: { $in: postIds } }),
    data.comments.getAll({ postId: { $in: postIds } }),
  ])

  const views: PostView[] = []
  for (const post of posts) {
    const pageIndex = pages.findIndex((p) => p.id === post.pageId)
    if (pageIndex < 0) continue
    views.push({
      post,
      body: bodies.find((b) => b.id === post.id),
      page: pages[pageIndex]!,
      creator,
      minTier: tierLists[pageIndex]!.find((t) => t.id === post.minTierId),
      likeCount: likes.filter((l) => l.postId === post.id).length,
      liked: likes.some((l) => l.postId === post.id && l.userId === meId),
      commentCount: comments.filter((c) => c.postId === post.id).length,
    })
  }
  return views.sort((a, b) => b.post.created.localeCompare(a.post.created))
}

/** Like or unlike a post, returns the new state */
export async function toggleLike(view: PostView, meId: string) {
  const data = await creatorData(view.creator.id)
  const id = `${view.post.id}_${meId}`
  if (view.liked) {
    await data.likes.deleteOne(id)
    view.liked = false
    view.likeCount--
  } else {
    await data.likes.insertOne({ id, postId: view.post.id, userId: meId })
    view.liked = true
    view.likeCount++
  }
}

/** A creator's pages, oldest first */
export async function listPages(collection: { getAll: () => Promise<Page[]> }): Promise<Page[]> {
  const pages = await collection.getAll()
  return pages.sort((a, b) => a.created.localeCompare(b.created))
}
