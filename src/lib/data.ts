import { GranteeType, PermissionType, type BazaarContext, type NewPermission } from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import type { Comment, Follower, Following, Like, Page, Post, PostBody } from '@/types'

export const PAGES = 'pages'
export const POSTS = 'posts'
export const POST_BODIES = 'post_bodies'
export const COMMENTS = 'comments'
export const LIKES = 'likes'
export const FOLLOWERS = 'followers'
export const FOLLOWING = 'following'

/** Folder for files everyone may read (covers, post previews) */
export const PUBLIC_DIR = 'public'

/** Who may do what in a creator's collections */
const creatorPermissions: Record<string, Omit<NewPermission, 'collectionName'>[]> = {
  [PAGES]: [{ granteeType: GranteeType.ANY, types: [PermissionType.READ] }],
  [POSTS]: [{ granteeType: GranteeType.ANY, types: [PermissionType.READ] }],
  [POST_BODIES]: [
    {
      granteeType: GranteeType.ANY,
      types: [PermissionType.READ],
      filter: { $or: [{ public: true }, { tiers: { $containsAny: '$purchases' } }] },
    },
  ],
  [COMMENTS]: [
    { granteeType: GranteeType.ANY, types: [PermissionType.READ] },
    {
      granteeType: GranteeType.ANY,
      types: [PermissionType.INSERT, PermissionType.DELETE],
      filter: { authorId: '$user' },
    },
  ],
  [LIKES]: [
    { granteeType: GranteeType.ANY, types: [PermissionType.READ] },
    {
      granteeType: GranteeType.ANY,
      types: [PermissionType.INSERT, PermissionType.DELETE],
      filter: { userId: '$user' },
    },
  ],
  [FOLLOWERS]: [
    {
      granteeType: GranteeType.ANY,
      types: [PermissionType.READ, PermissionType.INSERT, PermissionType.DELETE],
      filter: { userId: '$user' },
    },
  ],
}

function grant(collectionName: string) {
  return async () => {
    for (const permission of creatorPermissions[collectionName] ?? []) {
      await bzr.permissions.create({ collectionName, ...permission } as NewPermission)
    }
  }
}

/** The signed-in user's own collections */
export const mine = {
  pages: bzr.collection<Page>(PAGES, { onCreate: grant(PAGES) }),
  posts: bzr.collection<Post>(POSTS, { onCreate: grant(POSTS) }),
  bodies: bzr.collection<PostBody>(POST_BODIES, { onCreate: grant(POST_BODIES) }),
  comments: bzr.collection<Comment>(COMMENTS, { onCreate: grant(COMMENTS) }),
  likes: bzr.collection<Like>(LIKES, { onCreate: grant(LIKES) }),
  followers: bzr.collection<Follower>(FOLLOWERS, { onCreate: grant(FOLLOWERS) }),
  following: bzr.collection<Following>(FOLLOWING),
}

/**
 * Creates every creator collection (with permissions) and lets everyone read public files.
 * Visitors cannot create collections in someone else's DB, so this runs before a first page exists.
 */
export async function ensureCreatorSetup() {
  await Promise.all([
    mine.pages.getAll({ id: '' }),
    mine.posts.getAll({ id: '' }),
    mine.bodies.getAll({ id: '' }),
    mine.comments.getAll({ id: '' }),
    mine.likes.getAll({ id: '' }),
    mine.followers.getAll({ id: '' }),
  ])
  const filePermissions = await bzr.permissions.list({ collectionName: '_files' })
  if (!filePermissions.some((p) => p.granteeType === GranteeType.ANY)) {
    await bzr.permissions.create({
      collectionName: '_files',
      granteeType: GranteeType.ANY,
      types: [PermissionType.READ],
      filter: { path: { $startsWith: `${PUBLIC_DIR}/` } },
    })
  }
}

export type CreatorData = ReturnType<typeof creatorCollections>

/** A creator's collections, seen by the signed-in user */
export function creatorCollections(ctx: BazaarContext) {
  return {
    ctx,
    pages: ctx.collection<Page>(PAGES),
    posts: ctx.collection<Post>(POSTS),
    bodies: ctx.collection<PostBody>(POST_BODIES),
    comments: ctx.collection<Comment>(COMMENTS),
    likes: ctx.collection<Like>(LIKES),
    followers: ctx.collection<Follower>(FOLLOWERS),
  }
}

const contexts = new Map<string, Promise<CreatorData>>()

/** Cached access to a creator's data by user ID */
export function creatorData(creatorId: string): Promise<CreatorData> {
  let data = contexts.get(creatorId)
  if (!data) {
    data = bzr.createContext({ ownerId: creatorId }).then(creatorCollections)
    contexts.set(creatorId, data)
    data.catch(() => contexts.delete(creatorId))
  }
  return data
}
