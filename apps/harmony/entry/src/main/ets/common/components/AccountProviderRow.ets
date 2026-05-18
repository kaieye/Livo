import { AccountProvider, AccountStatusResult } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { accountCardHeadlineStatus } from '../utils/account/AccountCardHeadline'
import {
  accountProviderBadgeBackground,
  accountProviderBadgeResource,
} from '../utils/account/AccountProviderCatalog'
import { CARD_RADIUS_MD, CHIP_RADIUS } from '../ui/UiTokens'

const ACTION_BUTTON_HEIGHT: number = 32
const INPUT_HEIGHT: number = 42
const CARD_INNER_PADDING: number = 12
const ERROR_TEXT_COLOR: string = '#DC2626'

function emptyRowStatus(): AccountStatusResult {
  const status: AccountStatusResult = {
    provider: 'x',
    linked: false,
    displayName: '',
    error: '',
  }
  return status
}

@Component
export struct AccountProviderRow {
  @Prop title: string = ''
  @Prop status: AccountStatusResult = emptyRowStatus()
  @Prop detailMessage: string = ''
  @Prop draftValue: string = ''
  @Prop loading: boolean = false
  @Prop showSecondaryAction: boolean = false
  @Prop secondaryActionLabel: string = ''
  @Prop showManualSave: boolean = false
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  onPrimary: (provider: AccountProvider) => void = () => {}
  onSecondary: (provider: AccountProvider) => void = () => {}
  onDraftChange: (provider: AccountProvider, value: string) => void = () => {}
  onSaveDraft: (provider: AccountProvider) => void = () => {}

  private headlineText(): string {
    return accountCardHeadlineStatus(this.status.linked, this.status.displayName, this.status.error)
  }

  private primaryActionLabel(): string {
    return this.status.linked ? '断开' : '关联'
  }

  private detailColor(): string {
    return this.status.error ? ERROR_TEXT_COLOR : this.theme.textSecondary
  }

  build() {
    Column({ space: 8 }) {
      Row({ space: 12 }) {
        Row({ space: 10 }) {
          Image(accountProviderBadgeResource(this.status.provider))
            .width(34)
            .height(34)
            .objectFit(ImageFit.Contain)
            .padding(4)
            .backgroundColor(accountProviderBadgeBackground(this.status.provider, this.theme))
            .borderRadius(17)

          Row() {
            Text(this.title)
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)

            Text(` - ${this.headlineText()}`)
              .fontSize(14)
              .fontColor(this.detailColor())
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .layoutWeight(1)
          .alignItems(VerticalAlign.Center)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        Button(this.loading ? '处理中...' : this.primaryActionLabel())
          .enabled(!this.loading)
          .height(ACTION_BUTTON_HEIGHT)
          .backgroundColor(this.status.linked ? this.theme.elevated : this.theme.accent)
          .fontColor(this.status.linked ? this.theme.textPrimary : this.theme.accentText)
          .fontSize(13)
          .borderRadius(CHIP_RADIUS)
          .padding({ left: 14, right: 14 })
          .onClick(() => {
            this.onPrimary(this.status.provider)
          })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (this.detailMessage) {
        Text(this.detailMessage)
          .fontSize(12)
          .lineHeight(18)
          .fontColor(this.detailColor())
      }

      if (this.showSecondaryAction) {
        Row() {
          Blank()
            .layoutWeight(1)

          Button(this.secondaryActionLabel)
            .enabled(!this.loading)
            .height(ACTION_BUTTON_HEIGHT)
            .backgroundColor(this.theme.elevated)
            .fontColor(this.theme.textPrimary)
            .fontSize(13)
            .borderRadius(CHIP_RADIUS)
            .padding({ left: 14, right: 14 })
            .onClick(() => {
              this.onSecondary(this.status.provider)
            })
        }
        .width('100%')
      }

      if (this.showManualSave) {
        Row({ space: 8 }) {
          TextInput({ text: this.draftValue, placeholder: '登录后手动输入 YouTube 账号名' })
            .height(INPUT_HEIGHT)
            .layoutWeight(1)
            .backgroundColor(this.theme.elevated)
            .fontColor(this.theme.textPrimary)
            .placeholderColor(this.theme.textMuted)
            .borderRadius(12)
            .padding({ left: 14, right: 14 })
            .onChange((value: string) => {
              this.onDraftChange(this.status.provider, value)
            })

          Button('保存')
            .enabled(!this.loading && !!this.draftValue.trim())
            .height(INPUT_HEIGHT)
            .backgroundColor(this.theme.accent)
            .fontColor(this.theme.accentText)
            .fontSize(13)
            .borderRadius(CHIP_RADIUS)
            .padding({ left: 14, right: 14 })
            .onClick(() => {
              this.onSaveDraft(this.status.provider)
            })
        }
        .width('100%')
      }
    }
    .width('100%')
    .padding({ left: CARD_INNER_PADDING, right: CARD_INNER_PADDING, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_MD)
    .border({ width: 0.8, color: this.theme.divider })
    .justifyContent(FlexAlign.Center)
    .constraintSize({ minHeight: 64 })
  }
}
