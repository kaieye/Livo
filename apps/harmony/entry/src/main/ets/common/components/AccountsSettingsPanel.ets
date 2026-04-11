import { AppRepository } from '../data/AppRepository'
import {
  AccountProvider,
  AccountSelfCheckRow,
  AccountStatusResult,
  BilibiliImportProgress,
  FeedViewType,
  PendingBilibiliCreator,
} from '../models/LivoModels'
import { PageHeader } from './PageHeader'
import { AccountSelfCheckService } from '../services/AccountSelfCheckService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { openAccountLogin } from '../navigation/AppRouter'
import { accountCardHeadlineStatus } from '../utils/AccountCardHeadline'
import { accountCardRenderKey } from '../utils/AccountCardRenderKey'
import { resolveExternalBrowserCheckMessage } from '../utils/AccountBrowserCheckMessage'
import { resolveAccountLoginWebPolicy } from '../utils/AccountLoginWebPolicy'
import { buildLinkNavigationFailureStatus } from '../utils/AccountNavigationError'
import { AccountLinkResultState, mergeStatusWithAccountLinkResult } from '../utils/AccountLinkResult'
import {
  CARD_RADIUS_MD,
  CHIP_RADIUS,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'

const PANEL_HANDLE_TOP_PADDING: number = 10
const PANEL_HANDLE_BOTTOM_PADDING: number = 8
const PANEL_SECTION_SPACING: number = 2
const ACTION_BUTTON_HEIGHT: number = 32
const INPUT_HEIGHT: number = 42
const PROVIDER_BADGE_SIZE: number = 48
const CARD_INNER_PADDING: number = 12
const PROVIDER_CARD_GAP: number = 10

interface AccountProviderCard {
  provider: AccountProvider
  title: string
  description: string
  status: AccountStatusResult
}

interface AccountProviderCardDefinition {
  provider: AccountProvider
  title: string
  description: string
}

interface ProviderDraft {
  provider: AccountProvider
  value: string
}

const ACCOUNT_PROVIDER_CARDS: AccountProviderCardDefinition[] = [
  {
    provider: 'youtube',
    title: 'YouTube',
    description: '',
  },
  {
    provider: 'x',
    title: 'X / Twitter',
    description: '',
  },
  {
    provider: 'instagram',
    title: 'Instagram',
    description: '',
  },
  {
    provider: 'bilibili',
    title: 'Bilibili',
    description: '',
  },
]

function createEmptyStatus(provider: AccountProvider): AccountStatusResult {
  const status: AccountStatusResult = {
    provider,
    linked: false,
    displayName: '',
    error: '',
  }
  return status
}

function createCardDefinitionStatus(
  provider: AccountProvider,
  title: string,
  description: string,
  status: AccountStatusResult,
): AccountProviderCard {
  const card: AccountProviderCard = {
    provider,
    title,
    description,
    status,
  }
  return card
}

function createProviderDraft(provider: AccountProvider, value: string): ProviderDraft {
  const draft: ProviderDraft = {
    provider,
    value,
  }
  return draft
}

function createInitialCards(): AccountProviderCard[] {
  return ACCOUNT_PROVIDER_CARDS.map((card: AccountProviderCardDefinition) => {
    return createCardDefinitionStatus(card.provider, card.title, card.description, createEmptyStatus(card.provider))
  })
}

function createInitialProviderDrafts(): ProviderDraft[] {
  return ACCOUNT_PROVIDER_CARDS.map((card: AccountProviderCardDefinition) => {
    return createProviderDraft(card.provider, '')
  })
}

function providerBadgeResource(provider: AccountProvider): Resource {
  switch (provider) {
    case 'youtube':
      return $r('app.media.account_youtube')
    case 'x':
      return $r('app.media.account_x')
    case 'instagram':
      return $r('app.media.account_instagram')
    case 'bilibili':
      return $r('app.media.account_bilibili')
    default:
      return $r('app.media.account_x')
  }
}

@Component
export struct AccountsSettingsPanel {
  @StorageProp('accountsStatusRefreshAt') @Watch('handleAccountsRefreshSignal') accountsStatusRefreshAt: number = 0
  @StorageProp('accountLinkResultAt') @Watch('handleAccountLinkResultSignal') accountLinkResultAt: number = 0
  @StorageProp('accountLinkResultProvider') accountLinkResultProvider: AccountProvider | '' = ''
  @StorageProp('accountLinkResultDisplayName') accountLinkResultDisplayName: string = ''
  @StorageProp('accountLinkResultLinked') accountLinkResultLinked: boolean = false
  @State theme: ThemePalette = ThemeService.currentPalette()
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @State providerCards: AccountProviderCard[] = createInitialCards()
  @State providerDrafts: ProviderDraft[] = createInitialProviderDrafts()
  @State providerMessages: ProviderDraft[] = createInitialProviderDrafts()
  @State activeProvider: AccountProvider | '' = ''
  @State selfChecking: boolean = false
  @State selfCheckSummary: string = ''
  @State selfCheckRows: AccountSelfCheckRow[] = []
  @State bilibiliPreviewing: boolean = false
  @State bilibiliImporting: boolean = false
  @State bilibiliFeedback: string = ''
  @State bilibiliPendingCreators: PendingBilibiliCreator[] = []
  @State bilibiliSelectedMids: number[] = []
  @State bilibiliSelectedViews: FeedViewType[] = [FeedViewType.Videos]
  @State bilibiliImportProgressText: string = ''
  @State bilibiliSessData: string = ''

  aboutToAppear(): void {
    this.theme = this.inheritedTheme
    this.applyLatestAccountLinkResult()
    void this.loadProviderStatuses()
    void this.loadBilibiliSessData()
  }

  private syncInheritedTheme(): void {
    this.theme = this.inheritedTheme
  }

  private handleAccountsRefreshSignal(): void {
    void this.loadProviderStatuses()
  }

  private handleAccountLinkResultSignal(): void {
    this.applyLatestAccountLinkResult()
    void this.loadProviderStatuses()
  }

  private applyLatestAccountLinkResult(): void {
    const provider = this.accountLinkResultProvider
    const displayName = this.accountLinkResultDisplayName || ''
    const linked = this.accountLinkResultLinked
    console.info(
      `AccountsSettingsPanel applyLatestAccountLinkResult provider=${provider || ''} linked=${linked} displayName=${displayName}`,
    )
    if (!provider) {
      return
    }

    this.replaceCard(provider, (card: AccountProviderCard) => {
      const status: AccountStatusResult = {
        provider,
        linked,
        displayName: linked ? (displayName || card.status.displayName || `${card.title} 已关联`) : '',
        error: '',
      }
      return createCardDefinitionStatus(card.provider, card.title, card.description, status)
    })
    if (linked) {
      this.syncProviderDraft(provider, displayName)
    }
  }

  private isProviderLoading(provider: AccountProvider): boolean {
    return this.activeProvider === provider
  }

  private replaceCard(provider: AccountProvider, updater: (card: AccountProviderCard) => AccountProviderCard): void {
    this.providerCards = this.providerCards.map((card: AccountProviderCard) => {
      if (card.provider !== provider) {
        return card
      }
      return updater(card)
    })
  }

  private updateProviderDraft(provider: AccountProvider, value: string): void {
    this.providerDrafts = this.providerDrafts.map((draft: ProviderDraft) => {
      if (draft.provider !== provider) {
        return draft
      }
      return createProviderDraft(draft.provider, value)
    })
  }

  private updateProviderMessage(provider: AccountProvider, value: string): void {
    this.providerMessages = this.providerMessages.map((message: ProviderDraft) => {
      if (message.provider !== provider) {
        return message
      }
      return createProviderDraft(message.provider, value)
    })
  }

  private providerDraftValue(provider: AccountProvider): string {
    const matched = this.providerDrafts.find((draft: ProviderDraft) => draft.provider === provider)
    return matched ? matched.value : ''
  }

  private providerMessageValue(provider: AccountProvider): string {
    const matched = this.providerMessages.find((message: ProviderDraft) => message.provider === provider)
    return matched ? matched.value : ''
  }

  private syncProviderDraft(provider: AccountProvider, value: string): void {
    if (!this.providerDraftValue(provider).trim()) {
      this.updateProviderDraft(provider, value)
    }
  }

  private currentAccountLinkResult(): AccountLinkResultState {
    return {
      provider: this.accountLinkResultProvider,
      displayName: this.accountLinkResultDisplayName || '',
      linked: this.accountLinkResultLinked,
    }
  }

  private usesExternalBrowser(provider: AccountProvider): boolean {
    return resolveAccountLoginWebPolicy(provider).usesExternalBrowser
  }

  private async loadProviderStatuses(): Promise<void> {
    const nextCards: AccountProviderCard[] = []

    for (const card of this.providerCards) {
      nextCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, createEmptyStatus(card.provider)))
    }

    this.providerCards = nextCards

    const refreshedCards: AccountProviderCard[] = []
    const linkResult = this.currentAccountLinkResult()
    for (const card of ACCOUNT_PROVIDER_CARDS) {
      try {
        let status = await AppRepository.accountStatus(card.provider)
        const merged = mergeStatusWithAccountLinkResult(
          card.provider,
          {
            linked: status.linked,
            displayName: status.displayName,
            error: status.error,
          },
          card.title,
          linkResult,
        )
        status = {
          provider: card.provider,
          linked: merged.linked,
          displayName: merged.displayName,
          error: merged.error,
        }
        console.info(
          `AccountsSettingsPanel status provider=${card.provider} linked=${status.linked} displayName=${status.displayName} error=${status.error} resultProvider=${linkResult.provider || ''} resultLinked=${linkResult.linked} resultDisplayName=${linkResult.displayName}`,
        )
        refreshedCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, status))
        this.syncProviderDraft(card.provider, status.displayName)
        if (status.linked) {
          this.updateProviderMessage(card.provider, '')
        }
      } catch (error) {
        const status: AccountStatusResult = {
          provider: card.provider,
          linked: false,
          displayName: '',
          error: error instanceof Error ? error.message : '状态刷新失败',
        }
        refreshedCards.push(createCardDefinitionStatus(card.provider, card.title, card.description, status))
      }
    }

    this.providerCards = refreshedCards
  }

  private async updateProviderStatus(provider: AccountProvider, action: 'link' | 'unlink' | 'refresh'): Promise<void> {
    if (action === 'link') {
      const card = this.providerCards.find((item: AccountProviderCard) => item.provider === provider)
      const loginUrl = AppRepository.accountLoginUrl(provider)
      if (!loginUrl) {
        this.replaceCard(provider, (current: AccountProviderCard) => {
          const failedStatus: AccountStatusResult = {
            provider,
            linked: current.status.linked,
            displayName: current.status.displayName,
            error: '未找到登录入口',
          }
          return createCardDefinitionStatus(current.provider, current.title, current.description, failedStatus)
        })
        return
      }

      this.activeProvider = provider
      try {
        await openAccountLogin(provider, card?.title || '账号关联', loginUrl)
      } catch (error) {
        const failedStatus = buildLinkNavigationFailureStatus(
          provider,
          !!card?.status.linked,
          card?.status.displayName || '',
          error instanceof Error ? error.message : '打开账号关联页面失败',
        )
        console.error(
          `AccountsSettingsPanel openAccountLogin failed provider=${provider} error=${failedStatus.error}`,
        )
        this.replaceCard(provider, (current: AccountProviderCard) => {
          return createCardDefinitionStatus(current.provider, current.title, current.description, failedStatus)
        })
      } finally {
        this.activeProvider = ''
      }
      return
    }

    this.activeProvider = provider
    this.replaceCard(provider, (card: AccountProviderCard) => {
      const status: AccountStatusResult = {
        provider: card.provider,
        linked: card.status.linked,
        displayName: card.status.displayName,
        error: '',
      }
      return createCardDefinitionStatus(card.provider, card.title, card.description, status)
    })

    try {
      const nextStatus = action === 'unlink'
        ? await AppRepository.unlinkAccount(provider)
        : await AppRepository.accountStatus(provider)

      if (provider === 'youtube' && action === 'refresh' && !nextStatus.linked) {
        nextStatus.error = ''
        this.updateProviderMessage(
          provider,
          resolveExternalBrowserCheckMessage(provider, nextStatus.linked, nextStatus.displayName),
        )
      } else if (provider === 'youtube' && action === 'refresh') {
        this.updateProviderMessage(
          provider,
          resolveExternalBrowserCheckMessage(provider, nextStatus.linked, nextStatus.displayName),
        )
      }
      if (action === 'unlink' || nextStatus.linked) {
        if (!(provider === 'youtube' && action === 'refresh')) {
          this.updateProviderMessage(provider, '')
        }
      }

      this.replaceCard(provider, (card: AccountProviderCard) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus)
      })
      this.updateProviderDraft(provider, nextStatus.displayName)
    } catch (error) {
      const status: AccountStatusResult = {
        provider,
        linked: false,
        displayName: '',
        error: error instanceof Error ? error.message : '账号状态更新失败',
      }
      this.replaceCard(provider, (card: AccountProviderCard) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, status)
      })
    } finally {
      this.activeProvider = ''
    }
  }

  private statusText(status: AccountStatusResult): string {
    if (status.linked) {
      return status.displayName || '已关联'
    }

    if (status.error) {
      return status.error
    }

    return '未关联'
  }

  private actionLabel(status: AccountStatusResult): string {
    return status.linked ? '断开' : '关联'
  }

  private secondaryActionLabel(provider: AccountProvider): string {
    if (provider === 'youtube') {
      return '检查'
    }
    return ''
  }

  private bilibiliStatus(): AccountStatusResult {
    const card = this.providerCards.find((item: AccountProviderCard) => item.provider === 'bilibili')
    return card ? card.status : createEmptyStatus('bilibili')
  }

  private async loadBilibiliSessData(): Promise<void> {
    this.bilibiliSessData = await AppRepository.bilibiliSessData()
  }

  private async handleSaveDisplayName(provider: AccountProvider): Promise<void> {
    this.activeProvider = provider
    try {
      const nextStatus = await AppRepository.setAccountDisplayName(provider, this.providerDraftValue(provider))
      this.updateProviderMessage(provider, '')
      this.replaceCard(provider, (card: AccountProviderCard) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus)
      })
      this.updateProviderDraft(provider, nextStatus.displayName)
    } catch (error) {
      const failedStatus: AccountStatusResult = {
        provider,
        linked: false,
        displayName: this.providerDraftValue(provider),
        error: error instanceof Error ? error.message : '保存账号名失败',
      }
      this.replaceCard(provider, (card: AccountProviderCard) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, failedStatus)
      })
    } finally {
      this.activeProvider = ''
    }
  }

  private async handleSaveBilibiliSessData(): Promise<void> {
    this.activeProvider = 'bilibili'
    try {
      const nextStatus = await AppRepository.setBilibiliSessData(this.bilibiliSessData)
      this.replaceCard('bilibili', (card: AccountProviderCard) => {
        return createCardDefinitionStatus(card.provider, card.title, card.description, nextStatus)
      })
      this.updateProviderDraft('bilibili', nextStatus.displayName)
      this.bilibiliFeedback = nextStatus.error ? nextStatus.error : 'SESSDATA 已保存'
    } catch (error) {
      this.bilibiliFeedback = error instanceof Error ? error.message : '保存 SESSDATA 失败'
    } finally {
      this.activeProvider = ''
    }
  }

  private async handlePreviewBilibili(): Promise<void> {
    this.bilibiliPreviewing = true
    this.bilibiliFeedback = ''
    this.bilibiliImportProgressText = ''

    try {
      const creators = await AppRepository.previewBilibiliFollowings()
      this.bilibiliPendingCreators = creators
      this.bilibiliSelectedMids = creators.filter((creator: PendingBilibiliCreator) => !creator.exists).map((creator: PendingBilibiliCreator) => creator.mid)
      this.bilibiliFeedback = creators.length > 0
        ? `预览完成：共 ${creators.length} 个关注对象`
        : '未读取到可导入的关注对象'
    } catch (error) {
      this.bilibiliPendingCreators = []
      this.bilibiliSelectedMids = []
      this.bilibiliFeedback = error instanceof Error ? error.message : '预览关注列表失败'
    } finally {
      this.bilibiliPreviewing = false
    }
  }

  private toggleBilibiliCreator(mid: number): void {
    if (this.bilibiliSelectedMids.includes(mid)) {
      this.bilibiliSelectedMids = this.bilibiliSelectedMids.filter((item: number) => item !== mid)
      return
    }
    this.bilibiliSelectedMids = [...this.bilibiliSelectedMids, mid]
  }

  private toggleImportView(view: FeedViewType): void {
    if (this.bilibiliSelectedViews.includes(view)) {
      if (this.bilibiliSelectedViews.length === 1) {
        return
      }
      this.bilibiliSelectedViews = this.bilibiliSelectedViews.filter((item: FeedViewType) => item !== view)
      return
    }
    this.bilibiliSelectedViews = [...this.bilibiliSelectedViews, view]
  }

  private importViewLabel(view: FeedViewType): string {
    switch (view) {
      case FeedViewType.Videos:
        return '视频'
      case FeedViewType.SocialMedia:
        return '社交媒体'
      case FeedViewType.Articles:
        return '文章'
      default:
        return '未知'
    }
  }

  private isImportViewSelected(view: FeedViewType): boolean {
    return this.bilibiliSelectedViews.includes(view)
  }

  private isBilibiliCreatorSelected(mid: number): boolean {
    return this.bilibiliSelectedMids.includes(mid)
  }

  private providerAccent(provider: AccountProvider): string {
    switch (provider) {
      case 'youtube':
        return '#EF4444'
      case 'x':
        return '#111827'
      case 'instagram':
        return '#DB2777'
      case 'bilibili':
        return '#0EA5E9'
      default:
        return this.theme.accent
    }
  }

  private providerBadgeBackground(provider: AccountProvider): string {
    switch (provider) {
      case 'youtube':
        return '#FEE2E2'
      case 'x':
        return this.theme.elevated
      case 'instagram':
        return '#FCE7F3'
      case 'bilibili':
        return '#E0F2FE'
      default:
        return this.theme.elevated
    }
  }

  private providerHint(provider: AccountProvider): string {
    return provider === 'bilibili' ? '支持导入' : ''
  }

  private statusBadgeText(status: AccountStatusResult): string {
    if (status.linked && !status.error) {
      return '已关联'
    }
    if (status.error) {
      return '需处理'
    }
    return '未关联'
  }

  private statusBadgeBackground(status: AccountStatusResult): string {
    if (status.linked && !status.error) {
      return this.theme.accent
    }
    if (status.error) {
      return '#FEE2E2'
    }
    return this.theme.elevated
  }

  private statusBadgeColor(status: AccountStatusResult): string {
    if (status.linked && !status.error) {
      return this.theme.accentText
    }
    if (status.error) {
      return '#DC2626'
    }
    return this.theme.textSecondary
  }

  private statusLineText(status: AccountStatusResult): string {
    if (status.linked && status.displayName.trim()) {
      return status.displayName.trim()
    }
    if (status.error) {
      return status.error
    }
    return '未关联'
  }

  private titleStatusText(status: AccountStatusResult): string {
    return accountCardHeadlineStatus(status.linked, status.displayName, status.error)
  }

  private shouldShowSecondaryAction(provider: AccountProvider): boolean {
    return this.usesExternalBrowser(provider) && provider === 'youtube'
  }

  private shouldShowManualSave(provider: AccountProvider, status: AccountStatusResult): boolean {
    return this.usesExternalBrowser(provider) && provider === 'youtube' && !status.linked
  }

  private providerDetailText(card: AccountProviderCard): string {
    const message = this.providerMessageValue(card.provider).trim()
    if (message) {
      return message
    }
    if (card.status.linked && card.status.displayName.trim()) {
      return `已关联账号：${card.status.displayName.trim()}`
    }
    if (card.status.error.trim()) {
      return card.status.error.trim()
    }
    return ''
  }

  private selfCheckSummaryColor(): string {
    return this.selfCheckSummary.indexOf('通过') >= 0 ? this.theme.accent : '#DC2626'
  }

  private async handleImportBilibili(): Promise<void> {
    const creators = this.bilibiliPendingCreators.filter((creator: PendingBilibiliCreator) =>
      this.bilibiliSelectedMids.includes(creator.mid))

    if (creators.length === 0) {
      this.bilibiliFeedback = '请先选择要导入的关注对象'
      return
    }

    this.bilibiliImporting = true
    this.bilibiliFeedback = ''
    this.bilibiliImportProgressText = ''

    try {
      await AppRepository.importBilibiliFollowings(
        creators,
        this.bilibiliSelectedViews,
        (progress: BilibiliImportProgress) => {
          this.bilibiliImportProgressText =
            `${progress.completed}/${progress.total} · 已导入 ${progress.imported} · 跳过 ${progress.skipped} · 失败 ${progress.failed}`
        },
      )
      this.bilibiliFeedback = '导入完成'
    } catch (error) {
      this.bilibiliFeedback = error instanceof Error ? error.message : '导入关注列表失败'
    } finally {
      this.bilibiliImporting = false
    }
  }

  private async handleSelfCheck(): Promise<void> {
    this.selfChecking = true
    this.selfCheckSummary = ''
    this.selfCheckRows = []

    try {
      const result = await AccountSelfCheckService.run()
      this.selfCheckSummary = result.summary
      this.selfCheckRows = result.rows
    } finally {
      this.selfChecking = false
    }
  }

  @Builder
  private SheetHandle() {
    Column() {
      Row()
        .width(40)
        .height(5)
        .borderRadius(999)
        .backgroundColor(this.theme.dragHandle)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING })
  }

  @Builder
  private PanelHeader() {
    PageHeader({
      title: '账户关联',
      theme: this.theme,
      titleSize: 20,
      topPadding: 0,
      bottomPadding: 0,
    })
      .width('100%')
  }

  @Builder
  private SelfCheckSection() {
    Column()
      .width(0)
      .height(0)
  }

  @Builder
  private ProviderCard(card: AccountProviderCard) {
    Column({ space: 8 }) {
      Row({ space: 12 }) {
        Row({ space: 10 }) {
          Image(providerBadgeResource(card.provider))
            .width(34)
            .height(34)
            .objectFit(ImageFit.Contain)
            .padding(4)
            .backgroundColor(this.providerBadgeBackground(card.provider))
            .borderRadius(17)

          Row() {
            Text(card.title)
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)

            Text(` - ${this.titleStatusText(card.status)}`)
              .fontSize(14)
              .fontColor(card.status.error ? '#DC2626' : this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .layoutWeight(1)
          .alignItems(VerticalAlign.Center)
        }
        .layoutWeight(1)
        .alignItems(VerticalAlign.Center)

        Button(this.isProviderLoading(card.provider) ? '处理中...' : this.actionLabel(card.status))
          .enabled(!this.isProviderLoading(card.provider))
          .height(ACTION_BUTTON_HEIGHT)
          .backgroundColor(card.status.linked ? this.theme.elevated : this.theme.accent)
          .fontColor(card.status.linked ? this.theme.textPrimary : this.theme.accentText)
          .fontSize(13)
          .borderRadius(CHIP_RADIUS)
          .padding({ left: 14, right: 14 })
          .onClick(() => {
            void this.updateProviderStatus(card.provider, card.status.linked ? 'unlink' : 'link')
          })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (this.providerDetailText(card)) {
        Text(this.providerDetailText(card))
          .fontSize(12)
          .lineHeight(18)
          .fontColor(card.status.error ? '#DC2626' : this.theme.textSecondary)
      }

      if (this.shouldShowSecondaryAction(card.provider)) {
        Row() {
          Blank()
            .layoutWeight(1)

          Button(this.secondaryActionLabel(card.provider))
            .enabled(!this.isProviderLoading(card.provider))
            .height(ACTION_BUTTON_HEIGHT)
            .backgroundColor(this.theme.elevated)
            .fontColor(this.theme.textPrimary)
            .fontSize(13)
            .borderRadius(CHIP_RADIUS)
            .padding({ left: 14, right: 14 })
            .onClick(() => {
              void this.updateProviderStatus(card.provider, 'refresh')
            })
        }
        .width('100%')
      }

      if (this.shouldShowManualSave(card.provider, card.status)) {
        Row({ space: 8 }) {
          TextInput({ text: this.providerDraftValue(card.provider), placeholder: '登录后手动输入 YouTube 账号名' })
            .height(INPUT_HEIGHT)
            .layoutWeight(1)
            .backgroundColor(this.theme.elevated)
            .fontColor(this.theme.textPrimary)
            .placeholderColor(this.theme.textMuted)
            .borderRadius(12)
            .padding({ left: 14, right: 14 })
            .onChange((value: string) => {
              this.updateProviderDraft(card.provider, value)
            })

          Button('保存')
            .enabled(!this.isProviderLoading(card.provider) && !!this.providerDraftValue(card.provider).trim())
            .height(INPUT_HEIGHT)
            .backgroundColor(this.theme.accent)
            .fontColor(this.theme.accentText)
            .fontSize(13)
            .borderRadius(CHIP_RADIUS)
            .padding({ left: 14, right: 14 })
            .onClick(() => {
              void this.handleSaveDisplayName(card.provider)
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

  @Builder
  private ImportViewChip(view: FeedViewType) {
    Text(this.importViewLabel(view))
      .fontSize(12)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.isImportViewSelected(view) ? this.theme.accentText : this.theme.textSecondary)
      .padding({ left: 12, right: 12, top: 8, bottom: 8 })
      .backgroundColor(this.isImportViewSelected(view) ? this.theme.accent : this.theme.elevated)
      .borderRadius(999)
      .onClick(() => {
        this.toggleImportView(view)
      })
  }

  @Builder
  private BilibiliSection() {
    Column()
      .width(0)
      .height(0)
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column({ space: PROVIDER_CARD_GAP }) {
          ForEach(this.providerCards, (card: AccountProviderCard) => {
            this.ProviderCard(card)
          }, (card: AccountProviderCard) => accountCardRenderKey(
            card.provider,
            card.status.linked,
            card.status.displayName,
            card.status.error,
          ))
        }
        .width('100%')

        Row()
          .height(24)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({
        left: PAGE_HORIZONTAL_PADDING,
        right: PAGE_HORIZONTAL_PADDING,
        top: 0,
        bottom: 12,
      })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
