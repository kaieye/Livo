import type { Entry } from '../../../shared/types'

function isEmbeddableVideoUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/|b23\.tv\/|vimeo\.com\/\d+|ted\.com\/talks\/|download\.ted\.com\/)/i.test(
    url,
  )
}

export function resolvePreferredEntryVideo(
  entry: Pick<Entry, 'url'> & { media?: Entry['media'] },
): { url: string; type: 'video' } | null {
  const attachedVideo = entry.media?.find((media) => media.type === 'video')
  if (attachedVideo?.url) {
    return {
      url: attachedVideo.url,
      type: 'video',
    }
  }

  if (entry.url && isEmbeddableVideoUrl(entry.url)) {
    return {
      url: entry.url,
      type: 'video',
    }
  }

  return null
}
