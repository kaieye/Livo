import { curves } from '@kit.ArkUI'
import { getStringParams, goBack } from '../common/navigation/AppRouter'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct ImageViewer {
  @StorageProp('topAvoidArea') topAvoidArea: number = 0
  @StorageProp('bottomAvoidArea') bottomAvoidArea: number = 0
  @State title: string = '图片预览'
  @State imageUrl: string = ''
  @State theme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    const params = getStringParams()
    this.title = params.title || '图片预览'
    this.imageUrl = params.imageUrl || ''
    this.theme = ThemeService.currentPalette()
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (this.imageUrl) {
          Image(this.imageUrl)
            .width('100%')
            .height('100%')
            .objectFit(ImageFit.Contain)
        } else {
          Column({ space: 8 }) {
            Text('图片加载失败')
              .fontSize(16)
              .fontWeight(FontWeight.Medium)
              .fontColor('#FFFFFF')

            Text('未找到可预览的图片地址')
              .fontSize(13)
              .fontColor('rgba(255,255,255,0.68)')
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#000000')

      Row({ space: 10 }) {
        Row() {
          SymbolGlyph($r('sys.symbol.chevron_backward'))
            .fontSize(20)
            .fontColor(['#FFFFFF'])
        }
        .width(42)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .backgroundColor('rgba(0,0,0,0.42)')
        .borderRadius(999)
        .onClick(() => {
          void goBack()
        })

        Text(this.title)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor('#FFFFFF')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .margin({ left: 16, top: 16 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
    .padding({
      top: this.topAvoidArea,
      bottom: this.bottomAvoidArea,
    })
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: curves.springMotion(0.82, 0.94) })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
