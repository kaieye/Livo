import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_SM, CHIP_RADIUS } from '../ui/UiTokens'

export type ContentMode = 'articles' | 'social' | 'pictures' | 'videos'

@Component
export struct ContentModeRail {
  @Prop mode: ContentMode = 'articles'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onChange: (mode: ContentMode) => void = () => {}

  private labelFor(mode: ContentMode): string {
    switch (mode) {
      case 'articles':
        return '文章'
      case 'social':
        return '社交'
      case 'pictures':
        return '图片'
      case 'videos':
        return '视频'
      default:
        return ''
    }
  }

  @Builder
  private ModeIcon(mode: ContentMode, active: boolean) {
    if (mode === 'articles') {
      Image(active ? $r('app.media.sub_articles_active') : $r('app.media.sub_articles_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else if (mode === 'social') {
      Image(active ? $r('app.media.sub_social_active') : $r('app.media.sub_social_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else if (mode === 'pictures') {
      Image(active ? $r('app.media.sub_pictures_active') : $r('app.media.sub_pictures_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    } else {
      Image(active ? $r('app.media.sub_videos_active') : $r('app.media.sub_videos_inactive'))
        .width(16)
        .height(16)
        .objectFit(ImageFit.Contain)
    }
  }

  @Builder
  private ModeTab(mode: ContentMode) {
    Row({ space: 6 }) {
      this.ModeIcon(mode, this.mode === mode)

      Text(this.labelFor(mode))
        .fontSize(14)
        .fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(this.mode === mode ? this.theme.textPrimary : this.theme.textSecondary)
        .animation({ duration: 160, curve: Curve.EaseOut })
    }
    .layoutWeight(1)
    .height(38)
    .justifyContent(FlexAlign.Center)
    .backgroundColor(this.mode === mode ? this.theme.surface : Color.Transparent)
    .borderRadius(CHIP_RADIUS)
    .opacity(this.mode === mode ? 1 : 0.92)
    .animation({ duration: 160, curve: Curve.EaseOut })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.onChange(mode)
    })
  }

  build() {
    Row({ space: 6 }) {
      Row() {
        this.ModeTab('articles')
        this.ModeTab('social')
        this.ModeTab('pictures')
        this.ModeTab('videos')
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(46)
    .padding(4)
    .backgroundColor(this.theme.elevated)
    .borderRadius(CARD_RADIUS_SM)
    .border({ width: 0.8, color: this.theme.divider })
    .transition(livoMotion.enterScale(30))
  }
}
