import {
  BazaarError,
  ErrorTypes,
  isNoAppUserError,
  isUserDoesNotExistError,
  type User,
} from '@bzr/bazaar'
import { bzr } from '@/bazaar'
import { creatorData, type CreatorData } from '@/lib/data'
import { listPages } from '@/lib/posts'
import type { Page } from '@/types'

export type CreatorPage = {
  creator: User
  data: CreatorData
  pages: Page[]
  page: Page
}

/** A creator's page by handle and slug (default: first page). Throws a readable message. */
export async function loadCreatorPage(handle: string, slug?: string): Promise<CreatorPage> {
  let creator: User
  try {
    creator = await bzr.social.getUser({ handle })
  } catch (err) {
    if (isUserDoesNotExistError(err)) throw new Error(`There is no one called @${handle}.`)
    throw err
  }
  const data = await creatorData(creator.id)
  let pages: Page[]
  try {
    pages = await listPages(data.pages)
  } catch (err) {
    // No Benefactor DB or no pages collection yet
    if (
      isNoAppUserError(err) ||
      (err instanceof BazaarError && err.type === ErrorTypes.CollectionDoesNotExist)
    ) {
      throw new Error(`@${handle} has no Benefactor page yet.`)
    }
    throw err
  }
  const page = slug ? pages.find((p) => p.slug === slug) : pages[0]
  if (!page) {
    throw new Error(
      pages.length === 0 ? `@${handle} has no Benefactor page yet.` : 'This page does not exist.',
    )
  }
  return { creator, data, pages, page }
}
