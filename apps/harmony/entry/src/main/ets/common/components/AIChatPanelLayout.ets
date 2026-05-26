import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  BlurStrategy,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { ChatMessage, ChatSession } from '../services/ChatHistoryStore'
import { HarmonySettings } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import { AIChatEmptyState } from './AIChatEmptyState'
import { AIChatConversationList } from './AIChatConversationList'
import { AIChatInputComposer } from './AIChatInputComposer'
import { AIChatRunStatusBar } from './AIChatRunStatusBar'
import { PendingAgentConfirmationView, ToolStatusItem } from './AIChatPanelTypes'
import { buildAIChatTitleMenus } from './AIChatNavigationMenus'
import { AIChatHistorySheet, AIChatSettingsSheet } from './AIChatSheets'

@Component
export struct AIChatPanelLayout {
  @Prop theme: ThemePalette = {} as ThemePalette
  @Prop messages: ChatMessage[] = []
  @Prop streamingContent: string = ''
  @Prop isLoading: boolean = false
  @Prop isConfirming: boolean = false
  @Prop pendingConfirmation: PendingAgentConfirmationView | null = null
  @Prop showToolBanner: boolean = false
  @Prop toolBannerOpacity: number = 0
  @Prop toolStatusItems: ToolStatusItem[] = []
  @Prop timerVisible: boolean = false
  @Prop timerOpacity: number = 0
  @Prop elapsedTime: string = ''
  @Link inputContent: string
  @Link showAISettings: boolean
  @Link showHistory: boolean
  scroller: Scroller = new Scroller()
  inputController: TextAreaController = new TextAreaController()
  onSuggestionClick: (text: string) => void = () => {}
  onEditMessage: (messageId: string) => void = () => {}
  onSend: () => void = () => {}
  onStop: () => void = () => {}
  onConfirmPendingTool: () => void = () => {}
  onCancelPendingTool: () => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onLoadSession: (session: ChatSession) => void = () => {}
  onStartNewConversation: () => void = () => {}

  @Builder
  private SettingsSheetOverlay() {
    AIChatSettingsSheet({
      theme: this.theme,
      onSettingsChange: (settings: HarmonySettings) => {
        this.onSettingsChange(settings)
      },
    })
  }

  @Builder
  private HistorySheetOverlay() {
    AIChatHistorySheet({
      theme: this.theme,
      onLoadSession: (session: ChatSession) => {
        this.onLoadSession(session)
      },
      onClose: () => {
        this.showHistory = false
      },
    })
  }

  private chatTitleMenus() {
    return buildAIChatTitleMenus(
      () => {
        this.onStartNewConversation()
      },
      () => {
        this.showHistory = true
      },
      () => {
        this.showAISettings = true
      },
    )
  }

  build() {
    HdsNavigation() {
      Column() {
        Column() {
          if (this.messages.length === 0) {
            AIChatEmptyState({
              theme: this.theme,
              onSuggestionClick: (text: string) => {
                this.onSuggestionClick(text)
              },
            })
              .layoutWeight(1)
          } else {
            AIChatConversationList({
              theme: this.theme,
              messages: this.messages,
              streamingContent: this.streamingContent,
              isLoading: this.isLoading,
              pendingConfirmation: this.pendingConfirmation,
              isConfirming: this.isConfirming,
              scroller: this.scroller,
              onEditMessage: (messageId: string) => {
                this.onEditMessage(messageId)
              },
              onConfirmPendingTool: () => {
                this.onConfirmPendingTool()
              },
              onCancelPendingTool: () => {
                this.onCancelPendingTool()
              },
            })
          }
          if (this.showToolBanner || this.timerVisible) {
            AIChatRunStatusBar({
              theme: this.theme,
              showToolBanner: this.showToolBanner,
              toolBannerOpacity: this.toolBannerOpacity,
              toolStatusItems: this.toolStatusItems,
              timerVisible: this.timerVisible,
              timerOpacity: this.timerOpacity,
              elapsedTime: this.elapsedTime,
            })
          }
          AIChatInputComposer({
            theme: this.theme,
            inputContent: $inputContent,
            isLoading: this.isLoading,
            inputController: this.inputController,
            onSend: () => {
              this.onSend()
            },
            onStop: () => {
              this.onStop()
            },
          })
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
        .bindSheet($$this.showAISettings, this.SettingsSheetOverlay(), {
          detents: [SheetSize.MEDIUM],
          dragBar: false,
          showClose: false,
          backgroundColor: this.theme.background,
          preferType: SheetType.CENTER,
        })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
    .mode(NavigationMode.Stack)
    .titleBar({
      content: {
        title: {
          mainTitle: '',
        },
        menu: this.chatTitleMenus(),
      },
      style: {
        scrollEffectOpts: {
          enableScrollEffect: false,
          scrollEffectType: ScrollEffectType.GRADIENT_BLUR,
          blurEffectiveStartOffset: LengthMetrics.vp(0),
          blurEffectiveEndOffset: LengthMetrics.vp(30),
        },
        blurStrategy: BlurStrategy.ENABLE,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
        },
        originalStyle: {
          backgroundStyle: {
            backgroundColor: '#00000000',
            maskExtraHeight: 0,
            blurRadius: 28,
          },
          contentStyle: {
            titleStyle: {
              mainTitleColor: $r('sys.color.font_primary'),
              subTitleColor: $r('sys.color.font_secondary'),
            },
            menuStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
            backIconStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
          },
        },
        scrollEffectStyle: undefined,
      },
      avoidLayoutSafeArea: true,
      enableComponentSafeArea: false,
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideBackButton(false)
    .bindSheet($$this.showHistory, this.HistorySheetOverlay(), {
      detents: [SheetSize.MEDIUM],
      dragBar: false,
      showClose: false,
      backgroundColor: this.theme.background,
      preferType: SheetType.CENTER,
    })
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}
