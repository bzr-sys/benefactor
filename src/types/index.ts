import type { Doc } from '@bzr/bazaar'

/** A creator page. Tiers are products with `group` = page ID. */
export type Page = Doc & {
  slug: string
  name: string
  tagline: string
  about: string
  accent: string
  coverFileId?: string
  created: string
}

/** Public part of a post: everyone sees it, locked or not */
export type Post = Doc & {
  pageId: string
  title: string
  teaser: string
  imageFileId?: string
  /** Cheapest tier that unlocks the post. Unset = public. */
  minTierId?: string
  minCostInCents?: number
  created: string
}

/** Gated part of a post, same ID as the post */
export type PostBody = Doc & {
  pageId: string
  body: string
  public: boolean
  /** Product IDs that unlock this body */
  tiers: string[]
}

export type Comment = Doc & {
  postId: string
  authorId: string
  authorName: string
  authorHandle: string
  text: string
  created: string
}

/** ID is `${postId}_${userId}` */
export type Like = Doc & {
  postId: string
  userId: string
}

/** In the creator's DB. ID is `${pageId}_${userId}` */
export type Follower = Doc & {
  pageId: string
  userId: string
  name: string
  handle: string
}

/** In the follower's own DB. ID is the page ID */
export type Following = Doc & {
  creatorId: string
  creatorHandle: string
  pageId: string
  pageName: string
  pageSlug: string
}
