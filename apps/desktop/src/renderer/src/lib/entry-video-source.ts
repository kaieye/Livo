import { isEmbeddableVideoUrl } from '@livo/utils'
import type { Entry } from '../../../shared/types'

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
