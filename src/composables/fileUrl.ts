import { ref, watchEffect, type Ref } from 'vue'
import { bzr } from '@/bazaar'
import { creatorData } from '@/lib/data'
import { useAuthStore } from '@/stores/auth'

const urls = new Map<string, Promise<string>>()

/** Object URL for a file in a creator's storage */
export function fileUrl(creatorId: string, fileId: string): Promise<string> {
  let url = urls.get(fileId)
  if (!url) {
    url = (async () => {
      const own = creatorId === useAuthStore().me?.id
      const files = own ? bzr.files : (await creatorData(creatorId)).ctx.files
      return URL.createObjectURL(await files.download(fileId))
    })()
    urls.set(fileId, url)
    url.catch(() => urls.delete(fileId))
  }
  return url
}

/** Reactive object URL, empty while loading or without a file */
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
