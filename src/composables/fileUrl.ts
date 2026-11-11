import { ref, watchEffect, type Ref } from 'vue'
import { bzr } from '@/bazaar'
import { creatorData } from '@/lib/data'
import { useAuthStore } from '@/stores/auth'

/** File URLs last 1 h or a bit more; renew before that */
const TTL = 50 * 60 * 1000

const urls = new Map<string, { url: Promise<string>; expires: number }>()

/** URL for a file in a creator's storage, usable in <img> */
export function fileUrl(creatorId: string, fileId: string): Promise<string> {
  const cached = urls.get(fileId)
  if (cached && cached.expires > Date.now()) return cached.url
  const url = (async () => {
    const own = creatorId === useAuthStore().me?.id
    const files = own ? bzr.files : (await creatorData(creatorId)).ctx.files
    return files.getUrl(fileId)
  })()
  const entry = { url, expires: Date.now() + TTL }
  urls.set(fileId, entry)
  url.catch(() => {
    if (urls.get(fileId) === entry) urls.delete(fileId)
  })
  return url
}

/** Reactive file URL, empty while loading or without a file */
export function useFileUrl(creatorId: () => string | undefined, fileId: () => string | undefined) {
  const url: Ref<string> = ref('')
  watchEffect(async () => {
    url.value = ''
    const c = creatorId()
    const f = fileId()
    if (!c || !f) return
    try {
      url.value = await fileUrl(c, f)
    } catch (err) {
      console.error('Failed to load file', err)
    }
  })
  return url
}
