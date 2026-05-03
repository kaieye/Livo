import { PictureCarouselMediaItem } from './PictureGallery.ts'

export const LIVE_PHOTO_VISIBILITY_THRESHOLD = 0.35

export function findLivePhotoMediaItem(
  items: PictureCarouselMediaItem[],
  index: number,
): PictureCarouselMediaItem | undefined {
  const item = items[index]
  return item?.kind === 'livePhoto' && item.videoUrl ? item : undefined
}

export function findFirstLivePhotoIndex(
  items: PictureCarouselMediaItem[],
): number {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (item?.kind === 'livePhoto' && item.videoUrl) {
      return index
    }
  }
  return -1
}

export function findMountedLivePhotoIndices(
  items: PictureCarouselMediaItem[],
): number[] {
  const mounted: number[] = []
  items.forEach((item: PictureCarouselMediaItem, index: number) => {
    if (item.kind === 'livePhoto' && item.videoUrl) {
      mounted.push(index)
    }
  })
  return mounted
}

export function resolveCenteredLivePhotoIndex(
  items: PictureCarouselMediaItem[],
  ratios: number[],
): number {
  let bestIndex = -1
  let bestScore = 0

  items.forEach((item: PictureCarouselMediaItem, index: number) => {
    if (item.kind !== 'livePhoto' || !item.videoUrl) {
      return
    }
    const score = ratios[index] ?? 0
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= LIVE_PHOTO_VISIBILITY_THRESHOLD ? bestIndex : -1
}

export function isInitialFirstLivePhoto(
  items: PictureCarouselMediaItem[],
  ratios: number[],
  index: number,
): boolean {
  const allRatiosZero = ratios.every((value: number) => value === 0)
  return allRatiosZero && index === findFirstLivePhotoIndex(items)
}
