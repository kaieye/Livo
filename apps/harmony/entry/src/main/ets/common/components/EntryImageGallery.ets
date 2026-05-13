import { display } from '@kit.ArkUI'
import { ImageModel } from '../models/ImageModel'

@Reusable
@Component
struct GalleryImageSlide {
  @Prop imageUrl: string = ''
  @State imageModel: ImageModel = new ImageModel()
  @Consume @Watch('onImageReset') isImageReset: boolean = false
  close: () => void = () => {}
  onSwipeDisableChange: (disabled: boolean) => void = () => {}
  private imageAspect: number = 0

  private get isZoomed(): boolean {
    return this.imageModel.curScale > 1.01
  }

  aboutToAppear(): void {
    try {
      const info = display.getDefaultDisplaySync()
      this.imageModel.componentWidth = this.getUIContext().px2vp(info.width)
      this.imageModel.componentHeight = this.getUIContext().px2vp(info.height)
    } catch (_) {
      this.imageModel.componentWidth = this.getUIContext().px2vp(360)
      this.imageModel.componentHeight = this.getUIContext().px2vp(780)
    }
    this.syncImageDisplaySize()
  }

  onImageReset(): void {
    if (this.isImageReset) {
      this.imageModel.imageReset()
    }
  }

  private animateFrame(duration: number, curve: Curve, fn: () => void): void {
    this.getUIContext().animateTo({ duration, curve }, fn)
  }

  private syncImageDisplaySize(): void {
    let w = this.imageModel.componentWidth
    let h = this.imageModel.componentHeight
    if (this.imageAspect > 1e-6) {
      const containerAspect = this.imageModel.componentWidth / this.imageModel.componentHeight
      if (this.imageAspect > containerAspect) {
        h = this.imageModel.componentWidth / this.imageAspect
      } else {
        w = this.imageModel.componentHeight * this.imageAspect
      }
    }
    this.imageModel.imageDisplayWidth = w
    this.imageModel.imageDisplayHeight = h
  }

  build() {
    Stack() {
      Image(this.imageUrl)
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Contain)
        .draggable(false)
        .transform(this.imageModel.matrix)
        .translate({
          x: this.imageModel.curOffsetX,
          y: this.imageModel.curOffsetY
        })
        .onComplete((event) => {
          if (event && event.width > 0 && event.height > 0) {
            this.imageAspect = event.width / event.height
            this.syncImageDisplaySize()
            this.imageModel.maxScale = this.imageModel.calcFitScaleRatio(
              this.imageModel.imageDisplayWidth,
              this.imageModel.imageDisplayHeight
            )
          }
        })
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .parallelGesture(
      GestureGroup(GestureMode.Exclusive,
        PanGesture({ fingers: 1, distance: this.isZoomed ? 3 : 50 })
          .onActionUpdate((event) => {
            if (event) {
              this.imageModel.panGestureUpdate(event)
              this.onSwipeDisableChange(this.imageModel.isDisableSwipe)
            }
          })
          .onActionEnd(() => {
            this.imageModel.gestureEnd()
          })
          .onActionCancel(() => {
            this.imageModel.gestureEnd()
          }),

        PinchGesture({ fingers: 2, distance: 1 })
          .onActionStart((event) => {
            if (event) this.imageModel.pinchGestureStart(event)
          })
          .onActionUpdate((event) => {
            if (event) {
              this.imageModel.pinchGestureUpdate(event)
              this.onSwipeDisableChange(this.imageModel.isDisableSwipe)
            }
          })
          .onActionEnd(() => {
            if (this.imageModel.curScale <= this.imageModel.defaultScaleValue) {
              this.animateFrame(300, Curve.Smooth, () => {
                this.imageModel.pictureScaling(this.imageModel.defaultScaleValue)
                this.imageModel.imageReset()
                this.imageModel.gestureEnd()
              })
            } else if (this.imageModel.curScale >= this.imageModel.maxScale) {
              this.animateFrame(300, Curve.Smooth, () => {
                this.imageModel.curScale -= 0.1
                this.imageModel.pictureScaling(this.imageModel.curScale)
                this.imageModel.gestureEnd()
              })
            } else {
              this.imageModel.gestureEnd()
            }
            this.onSwipeDisableChange(this.imageModel.isDisableSwipe)
          }),

        TapGesture({ count: 2 }).onAction((event) => {
          if (event) {
            this.animateFrame(300, Curve.Smooth, () => {
              this.imageModel.doubleTapGesture(event)
            })
            this.onSwipeDisableChange(this.imageModel.isDisableSwipe)
          }
        }),

        TapGesture({ count: 1 }).onAction(() => {
          if (this.isZoomed) {
            this.animateFrame(200, Curve.FastOutSlowIn, () => {
              this.imageModel.pictureScaling(1)
              this.imageModel.offsetReset()
            })
            this.imageModel.lastScale = 1
            this.imageModel.isArriveBoundary = false
            this.onSwipeDisableChange(false)
          } else {
            this.close()
          }
        }),
      ), GestureMask.Normal
    )
  }
}

@Component
export struct EntryImageGallery {
  @Prop imageUrls: string[] = []
  @Prop initialIndex: number = 0
  @State currentIndex: number = 0
  @State private isSwipeDisabled: boolean = false
  @Provide isImageReset: boolean = false
  private swiperController: SwiperController = new SwiperController()
  onClose: () => void = () => {}

  aboutToAppear(): void {
    this.currentIndex = this.initialIndex
  }

  build() {
    Stack() {
      Swiper(this.swiperController) {
        ForEach(this.imageUrls, (url: string) => {
          GalleryImageSlide({
            imageUrl: url,
            close: () => { this.onClose() },
            onSwipeDisableChange: (disabled: boolean) => { this.isSwipeDisabled = disabled },
          })
        }, (url: string) => url)
      }
      .width('100%')
      .height('100%')
      .index(this.currentIndex)
      .disableSwipe(this.isSwipeDisabled)
      .onChange((index: number) => { this.currentIndex = index })
      .onGestureSwipe(() => {
        this.isImageReset = false
      })
      .onAnimationStart((index: number, targetIndex: number) => {
        if (index !== targetIndex) {
          this.isImageReset = true
        }
      })
      .autoPlay(false)
      .loop(false)
      .indicator(false)

      if (this.imageUrls.length > 1) {
        Row() {
          Text(`${this.currentIndex + 1} / ${this.imageUrls.length}`)
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor('rgba(255,255,255,0.85)')
        }
        .padding({ left: 14, right: 14, top: 5, bottom: 5 })
        .backgroundColor('rgba(0,0,0,0.35)')
        .borderRadius(999)
        .position({ bottom: 48 })
        .alignSelf(ItemAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#000000')
  }
}
