import { AppRepository } from '../data/AppRepository'
import { AccountProvider, AccountStatusResult } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { openAccountLogin } from '../navigation/AppRouter'
import { accountCardRenderKey } from '../utils/AccountCardRenderKey'
import { resolveExternalBrowserCheckMessage } from '../utils/AccountBrowserCheckMessage'
import { resolveAccountLoginWebPolicy } from '../utils/AccountLoginWebPolicy'
import { buildLinkNavigationFailureStatus } from '../utils/AccountNavigationError'
import { AccountLinkResultState, mergeStatusWithAccountLinkResult } from '../utils/AccountLinkResult'
import {
  AccountProviderDefinition,
  accountProviderTitle,
  listAccountProviderDefinitions,
} from '../utils/AccountProviderCatalog'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { AccountProviderRow } from './AccountProviderRow'
import {
  PANEL_SECTION_SPACING,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

const PROVIDER_CARD_GAP: number = 10

interface AccountProviderState {
  provider: AccountProvider
  status: AccountStatusResult
}

interface ProviderDraft {
  provider: AccountProvider
  value: string
}

const ACCOUNT_PROVIDER_DEFINITIONS: AccountProviderDefinition[] = listAccountProviderDefinitions()

function createEmptyStatus(provider: AccountProvider): AccountStatusResult {
  const status: AccountStatusResult = {
    provider,
    linked: false,
    displayName: '',
    error: '',
  }
  return status
}

function createProviderState(provider: AccountProvider, status: AccountStatusResult): AccountProviderState {
  const state: AccountProviderState = {
    provider,
    status,
  }
  return state
}

function createProviderDraft(provider: AccountProvider, value: string): ProviderDraft {
  const draft: ProviderDraft = {
    provider,
    value,
  }
  return draft
}

function createInitialCards(): AccountProviderState[] {
  return ACCOUNT_PROVIDER_DEFINITIONS.map((definition: AccountProviderDefinition) => {
    return createProviderState(definition.provider, createEmptyStatus(definition.provider))
  })
}

function createInitialProviderDrafts(): ProviderDraft[] {
  return ACCOUNT_PROVIDER_DEFINITIONS.map((definition: AccountProviderDefinition) => {
    return createProviderDraft(definition.provider, '')
  })
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
  @State providerCards: AccountProviderState[] = createInitialCards()
  @State providerDrafts: ProviderDraft[] = createInitialProviderDrafts()
  @State providerMessages: ProviderDraft[] = createInitialProviderDrafts()
  @State activeProvider: AccountProvider | '' = ''

  aboutToAppear(): void {
    this.theme = this.inheritedTheme
    this.applyLatestAccountLinkResult()
    void this.loadProviderStatuses()
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

    this.replaceCard(provider, (current: AccountStatusResult): AccountStatusResult => {
      return {
        provider,
        linked,
        displayName: linked
          ? (displayName || current.displayName || `${accountProviderTitle(provider)} 已关联`)
          : '',
        error: '',
      }
    })
    if (linked) {
      this.syncProviderDraft(provider, displayName)
    }
  }

  private isProviderLoading(provider: AccountProvider): boolean {
    return this.activeProvider === provider
  }

  private replaceCard(
    provider: AccountProvider,
    statusUpdater: (current: AccountStatusResult) => AccountStatusResult,
  ): void {
    this.providerCards = this.providerCards.map((card: AccountProviderState) => {
      if (card.provider !== provider) {
        return card
      }
      return createProviderState(card.provider, statusUpdater(card.status))
    })
  }

  private setCardStatus(provider: AccountProvider, status: AccountStatusResult): void {
    this.replaceCard(provider, (_current: AccountStatusResult): AccountStatusResult => status)
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
    this.providerCards = ACCOUNT_PROVIDER_DEFINITIONS.map((definition: AccountProviderDefinition) => {
      return createProviderState(definition.provider, createEmptyStatus(definition.provider))
    })

    const refreshedCards: AccountProviderState[] = []
    const linkResult = this.currentAccountLinkResult()
    for (const definition of ACCOUNT_PROVIDER_DEFINITIONS) {
      try {
        let status = await AppRepository.accountStatus(definition.provider)
        const merged = mergeStatusWithAccountLinkResult(
          definition.provider,
          {
            linked: status.linked,
            displayName: status.displayName,
            error: status.error,
          },
          definition.title,
          linkResult,
        )
        status = {
          provider: definition.provider,
          linked: merged.linked,
          displayName: merged.displayName,
          error: merged.error,
        }
        console.info(
          `AccountsSettingsPanel status provider=${definition.provider} linked=${status.linked} displayName=${status.displayName} error=${status.error} resultProvider=${linkResult.provider || ''} resultLinked=${linkResult.linked} resultDisplayName=${linkResult.displayName}`,
        )
        refreshedCards.push(createProviderState(definition.provider, status))
        this.syncProviderDraft(definition.provider, status.displayName)
        if (status.linked) {
          this.updateProviderMessage(definition.provider, '')
        }
      } catch (error) {
        const status: AccountStatusResult = {
          provider: definition.provider,
          linked: false,
          displayName: '',
          error: error instanceof Error ? error.message : '状态刷新失败',
        }
        refreshedCards.push(createProviderState(definition.provider, status))
      }
    }

    this.providerCards = refreshedCards
  }

  private async beginLink(provider: AccountProvider): Promise<void> {
    const card = this.providerCards.find((item: AccountProviderState) => item.provider === provider)
    const loginUrl = AppRepository.accountLoginUrl(provider)
    if (!loginUrl) {
      this.replaceCard(provider, (current: AccountStatusResult): AccountStatusResult => {
        return {
          provider,
          linked: current.linked,
          displayName: current.displayName,
          error: '未找到登录入口',
        }
      })
      return
    }

    this.activeProvider = provider
    try {
      await openAccountLogin(provider, accountProviderTitle(provider), loginUrl)
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
      this.setCardStatus(provider, failedStatus)
    } finally {
      this.activeProvider = ''
    }
  }

  private async refreshOrUnlink(provider: AccountProvider, action: 'unlink' | 'refresh'): Promise<void> {
    this.activeProvider = provider
    this.replaceCard(provider, (current: AccountStatusResult): AccountStatusResult => {
      return {
        provider: current.provider,
        linked: current.linked,
        displayName: current.displayName,
        error: '',
      }
    })

    try {
      const nextStatus = action === 'unlink'
        ? await AppRepository.unlinkAccount(provider)
        : await AppRepository.accountStatus(provider)

      if (provider === 'youtube' && action === 'refresh') {
        if (!nextStatus.linked) {
          nextStatus.error = ''
        }
        this.updateProviderMessage(
          provider,
          resolveExternalBrowserCheckMessage(provider, nextStatus.linked, nextStatus.displayName),
        )
      }
      const isYoutubeRefresh = provider === 'youtube' && action === 'refresh'
      if ((action === 'unlink' || nextStatus.linked) && !isYoutubeRefresh) {
        this.updateProviderMessage(provider, '')
      }

      this.setCardStatus(provider, nextStatus)
      this.updateProviderDraft(provider, nextStatus.displayName)
    } catch (error) {
      const status: AccountStatusResult = {
        provider,
        linked: false,
        displayName: '',
        error: error instanceof Error ? error.message : '账号状态更新失败',
      }
      this.setCardStatus(provider, status)
    } finally {
      this.activeProvider = ''
    }
  }

  private async updateProviderStatus(
    provider: AccountProvider,
    action: 'link' | 'unlink' | 'refresh',
  ): Promise<void> {
    if (action === 'link') {
      await this.beginLink(provider)
      return
    }
    await this.refreshOrUnlink(provider, action)
  }

  private secondaryActionLabel(provider: AccountProvider): string {
    return provider === 'youtube' ? '检查' : ''
  }

  private async handleSaveDisplayName(provider: AccountProvider): Promise<void> {
    this.activeProvider = provider
    try {
      const nextStatus = await AppRepository.setAccountDisplayName(provider, this.providerDraftValue(provider))
      this.updateProviderMessage(provider, '')
      this.setCardStatus(provider, nextStatus)
      this.updateProviderDraft(provider, nextStatus.displayName)
    } catch (error) {
      const failedStatus: AccountStatusResult = {
        provider,
        linked: false,
        displayName: this.providerDraftValue(provider),
        error: error instanceof Error ? error.message : '保存账号名失败',
      }
      this.setCardStatus(provider, failedStatus)
    } finally {
      this.activeProvider = ''
    }
  }

  private shouldShowSecondaryAction(provider: AccountProvider): boolean {
    return this.usesExternalBrowser(provider) && provider === 'youtube'
  }

  private shouldShowManualSave(provider: AccountProvider, status: AccountStatusResult): boolean {
    return this.usesExternalBrowser(provider) && provider === 'youtube' && !status.linked
  }

  private providerDetailText(card: AccountProviderState): string {
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

  private handlePrimary(provider: AccountProvider): void {
    const card = this.providerCards.find((item: AccountProviderState) => item.provider === provider)
    const linked = card ? card.status.linked : false
    void this.updateProviderStatus(provider, linked ? 'unlink' : 'link')
  }

  private handleSecondary(provider: AccountProvider): void {
    void this.updateProviderStatus(provider, 'refresh')
  }

  private handleDraftChange(provider: AccountProvider, value: string): void {
    this.updateProviderDraft(provider, value)
  }

  private handleSaveDraft(provider: AccountProvider): void {
    void this.handleSaveDisplayName(provider)
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        SettingsPanelSheetHandle({ theme: this.theme })
        SettingsPanelTitle({ title: '账户关联', theme: this.theme })

        Column({ space: PROVIDER_CARD_GAP }) {
          ForEach(this.providerCards, (card: AccountProviderState) => {
            AccountProviderRow({
              title: accountProviderTitle(card.provider),
              status: card.status,
              detailMessage: this.providerDetailText(card),
              draftValue: this.providerDraftValue(card.provider),
              loading: this.isProviderLoading(card.provider),
              showSecondaryAction: this.shouldShowSecondaryAction(card.provider),
              secondaryActionLabel: this.secondaryActionLabel(card.provider),
              showManualSave: this.shouldShowManualSave(card.provider, card.status),
              theme: this.theme,
              onPrimary: (provider: AccountProvider) => this.handlePrimary(provider),
              onSecondary: (provider: AccountProvider) => this.handleSecondary(provider),
              onDraftChange: (provider: AccountProvider, value: string) =>
                this.handleDraftChange(provider, value),
              onSaveDraft: (provider: AccountProvider) => this.handleSaveDraft(provider),
            })
          }, (card: AccountProviderState) => accountCardRenderKey(
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
