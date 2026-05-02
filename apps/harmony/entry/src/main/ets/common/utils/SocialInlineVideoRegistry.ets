import { PictureCarouselMediaItem } from './PictureGallery'

/**
 * Caches per-section VideoController instances for inline social-tweet videos.
 * The active key (which item is currently expanded) is owned by the page
 * (because @State must live on the @Component); this registry only owns
 * the controller cache and key formatting.
 */
export class SocialInlineVideoRegistry {
  private readonly controllers: Map<string, VideoController> = new Map<string, VideoController>()

  static keyFor(section: string, item: PictureCarouselMediaItem, index: number): string {
    return `${section}_${index}_${item.imageUrl}_${item.videoUrl}`
  }

  controllerFor(section: string, item: PictureCarouselMediaItem, index: number): VideoController {
    const key = SocialInlineVideoRegistry.keyFor(section, item, index)
    const existing = this.controllers.get(key)
    if (existing) {
      return existing
    }
    const controller = new VideoController()
    this.controllers.set(key, controller)
    return controller
  }
}
