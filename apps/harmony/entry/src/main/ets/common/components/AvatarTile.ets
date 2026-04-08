import { ThemePalette, ThemeService } from '../services/ThemeService'

@Component
export struct AvatarTile {
  @Prop @Watch('handleImageUrlChange') imageUrl: string = ''
  @Prop fallbackLabel: string = ''
  @Prop accent: string = '#FF6A00'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop avatarSize: number = 38
  @Prop radius: number = 10
  @Prop textSize: number = 14
  @Prop showFallbackLabel: boolean = true
  @State private imageLoadFailed: boolean = false

  aboutToAppear(): void {
    this.imageLoadFailed = false
  }

  private handleImageUrlChange(): void {
    this.imageLoadFailed = false
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
      if (this.imageUrl && !this.imageLoadFailed) {
        Image(this.imageUrl)
          .width(this.avatarSize)
          .height(this.avatarSize)
          .borderRadius(this.radius)
          .backgroundColor(this.theme.elevated)
          .objectFit(ImageFit.Cover)
          .onError(() => {
            this.imageLoadFailed = true
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
