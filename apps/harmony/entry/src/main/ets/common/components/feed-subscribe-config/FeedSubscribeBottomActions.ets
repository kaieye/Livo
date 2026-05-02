import { ThemePalette } from '../../services/ThemeService'

/**
 * Bottom action row for the feed-subscribe screen.
 *
 * Three states drive the layout:
 *   - Subscribe mode (not editing):       single "订阅" button
 *   - Edit mode + has unsaved changes:    "取消订阅" + "保存" pair
 *   - Edit mode + no changes:             single "取消订阅" button
 *
 * Submitting state disables the relevant buttons and swaps the label.
 */
@Component
export struct FeedSubscribeBottomActions {
  @Prop theme: ThemePalette
  @Prop isEditMode: boolean = false
  @Prop hasChanges: boolean = false
  @Prop isSubmitting: boolean = false
  onSubscribe: () => void = () => {}
  onSave: () => void = () => {}
  onUnsubscribe: () => void = () => {}

  build() {
    if (!this.isEditMode) {
      this.SubscribeButton()
    } else if (this.hasChanges) {
      this.UnsubscribeAndSaveRow()
    } else {
      this.UnsubscribeOnlyButton()
    }
  }

  @Builder
  private SubscribeButton() {
    Button(this.isSubmitting ? '订阅中...' : '订阅')
      .type(ButtonType.Capsule)
      .width('80%')
      .height(50)
      .fontSize(16)
      .fontWeight(FontWeight.Bold)
      .backgroundColor(this.theme.accent)
      .fontColor('#FFFFFF')
      .margin({ bottom: 24 })
      .opacity(0.92)
      .enabled(!this.isSubmitting)
      .onClick(() => {
        this.onSubscribe()
      })
  }

  @Builder
  private UnsubscribeAndSaveRow() {
    Row({ space: 12 }) {
      Button('取消订阅')
        .type(ButtonType.Capsule)
        .layoutWeight(1)
        .height(50)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .backgroundColor(this.theme.elevated)
        .fontColor('#EF4444')
        .onClick(() => {
          this.onUnsubscribe()
        })

      Button(this.isSubmitting ? '保存中...' : '保存')
        .type(ButtonType.Capsule)
        .layoutWeight(1)
        .height(50)
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .backgroundColor(this.theme.accent)
        .fontColor('#FFFFFF')
        .enabled(!this.isSubmitting)
        .onClick(() => {
          this.onSave()
        })
    }
    .width('90%')
    .margin({ bottom: 24 })
    .opacity(0.92)
  }

  @Builder
  private UnsubscribeOnlyButton() {
    Button('取消订阅')
      .type(ButtonType.Capsule)
      .width('80%')
      .height(50)
      .fontSize(16)
      .fontWeight(FontWeight.Bold)
      .backgroundColor(this.theme.elevated)
      .fontColor('#EF4444')
      .margin({ bottom: 24 })
      .opacity(0.92)
      .onClick(() => {
        this.onUnsubscribe()
      })
  }
}
