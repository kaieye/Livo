import { ThemePalette, ThemeService } from '../services/ThemeService'

@Component
export struct AvatarTile {
  @Prop @Watch('handleImageUrlChange') imageUrl: string = ''
  @Prop @Watch('handleImageSourcesChange') fallbackImageUrls: string[] = []
  @Prop @Watch('handleRefreshTokenChange') refreshToken: number = 0
  @Prop fallbackLabel: string = ''
  @Prop accent: string = '#FF6A00'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop avatarSize: number = 38
  @Prop radius: number = 10
  @Prop textSize: number = 14
  @Prop showFallbackLabel: boolean = true
  @State private currentImageIndex: number = 0

  aboutToAppear(): void {
    this.currentImageIndex = 0
  }

  private handleImageUrlChange(): void {
    this.currentImageIndex = 0
  }

  private handleImageSourcesChange(): void {
    this.currentImageIndex = 0
  }

  private handleRefreshTokenChange(): void {
    this.currentImageIndex = 0
  }

  private candidateImageUrls(): string[] {
    const result: string[] = []
    const pushCandidate = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || result.includes(trimmed)) {
        return
      }
      result.push(trimmed)
    }

    pushCandidate(this.imageUrl)
    ;(this.fallbackImageUrls || []).forEach((value: string) => pushCandidate(value))
    return result
  }

  private currentCandidateImageUrl(): string {
    return this.candidateImageUrls()[this.currentImageIndex] ?? ''
  }

  private advanceImageCandidate(): void {
    const candidates = this.candidateImageUrls()
    if (this.currentImageIndex + 1 < candidates.length) {
      this.currentImageIndex += 1
      return
    }

    this.currentImageIndex = candidates.length
  }

  private initialsLabel(): string {
    const trimmed = this.fallbackLabel.trim()
    if (!trimmed) {
      return '?'
    }
    return trimmed.substring(0, 1).toUpperCase()
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.currentCandidateImageUrl() && this.currentImageIndex < this.candidateImageUrls().length) {
        Image(this.currentCandidateImageUrl())
          .width(this.avatarSize)
          .height(this.avatarSize)
          .borderRadius(this.radius)
          .backgroundColor(this.theme.elevated)
          .objectFit(ImageFit.Cover)
          .onError(() => {
            this.advanceImageCandidate()
          })
      } else {
        Row()
          .width(this.avatarSize)
          .height(this.avatarSize)
          .borderRadius(this.radius)
          .backgroundColor(this.theme.elevated)
          .border({
            width: 0.8,
            color: this.theme.divider,
          })

        if (this.showFallbackLabel) {
          Text(this.initialsLabel())
            .fontSize(this.textSize)
            .fontWeight(FontWeight.Bold)
            .fontColor('#FFFFFF')
        }
      }
    }
  }
}
