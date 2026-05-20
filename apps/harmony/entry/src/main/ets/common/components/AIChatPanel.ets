import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  BlurStrategy,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { runChatCompletion } from '../services/article-assist/ChatCompletionRunner'
import { AIAssistantSettingsStore } from '../services/AIAssistantSettingsStore'
import { AIAssistantSettings, HarmonySettings } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import { showToast } from '../utils/PageToastHelper'
import { AIAssistantSettingsPanel } from './AIAssistantSettingsPanel'
import { AIChatHistoryPanel } from './AIChatHistoryPanel'
import { Typewriter } from '../utils/Typewriter'
import { ChatHistoryStore, ChatMessage, ChatSession } from '../services/ChatHistoryStore'

@Component
export struct AIChatPanel {
  @Prop theme: ThemePalette
  @Prop context: string = ''
  onClose: () => void = () => {}

  @State messages: ChatMessage[] = []
  @State inputContent: string = ''
  @State isLoading: boolean = false
  @State aiSettings: AIAssistantSettings | null = null
  @State showAISettings: boolean = false
  @State streamingContent: string = ''
  @State streamingMessageId: string = ''
  @State showHistory: boolean = false
  @State currentSessionId: string = ''

  private scroller: Scroller = new Scroller()
  private inputController: TextAreaController = new TextAreaController()
  private typewriter: Typewriter = new Typewriter()

  aboutToAppear() {
    this.currentSessionId = Date.now().toString()
    this.loadSettings()
  }

  aboutToDisappear() {
    this.typewriter.cancel()
    this.saveCurrentSession()
  }

  private async loadSettings() {
    try {
      this.aiSettings = await AIAssistantSettingsStore.load()
    } catch (e) {
      showToast(this.getUIContext(), '加载 AI 助理设置失败', 2000)
    }
  }

  private async handleSend() {
    const text = this.inputContent.trim()
    if (!text) {
      return
    }
    if (this.isLoading) {
      return
    }
    if (!this.aiSettings || !this.aiSettings.model) {
      showToast(this.getUIContext(), '请先在「设置 > AI助手」中配置 AI 接口', 2000)
      return
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      id: Date.now().toString()
    }

    // 打字机动画互斥：新消息到达时取消当前打字
    this.typewriter.cancel()
    this.streamingContent = ''
    this.streamingMessageId = ''

    this.messages.push(userMsg)
    this.inputContent = ''
    this.isLoading = true

    try {
      this.inputController.stopEditing()
    } catch (e) {}

    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 100)

    try {
      const assistantText = await runChatCompletion(text, this.aiSettings, this.context, 1500)
      const assistMsgId = (Date.now() + 1).toString()
      const assistMsg: ChatMessage = {
        role: 'assistant',
        content: typeof assistantText === 'string' ? assistantText : String(assistantText),
        id: assistMsgId
      }
      this.messages.push(assistMsg)
      this.isLoading = false

      // 启动打字机动画
      this.streamingMessageId = assistMsgId
      this.typewriter.start(assistantText, {
        onTick: (displayed: string) => {
          this.streamingContent = displayed
        },
        onDone: () => {
          this.streamingContent = ''
          this.streamingMessageId = ''
        }
      })
    } catch (err) {
      this.isLoading = false
      const errMsg: ChatMessage = {
        role: 'system',
        content: err instanceof Error ? err.message : String(err),
        id: (Date.now() + 1).toString()
      }
      this.messages.push(errMsg)
    } finally {
      setTimeout(() => {
        this.scroller.scrollEdge(Edge.Bottom)
      }, 100)
    }
  }

  private handleSuggestionClick(text: string) {
    this.inputContent = text
    this.handleSend()
  }

  private saveCurrentSession(): void {
    if (this.messages.length === 0) {
      return
    }
    const title = this.messages.find((m: ChatMessage) => m.role === 'user')?.content.slice(0, 40) || '新对话'
    const session: ChatSession = {
      id: this.currentSessionId || Date.now().toString(),
      title,
      messages: this.messages.slice(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    void ChatHistoryStore.save(session)
  }

  private startNewConversation(): void {
    this.saveCurrentSession()
    this.messages = []
    this.currentSessionId = Date.now().toString()
    this.streamingContent = ''
    this.streamingMessageId = ''
  }

  private loadSessionFromHistory(session: ChatSession): void {
    this.saveCurrentSession()
    this.typewriter.cancel()
    this.messages = session.messages.slice()
    this.currentSessionId = session.id
    this.streamingContent = ''
    this.streamingMessageId = ''
    this.showHistory = false
    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 200)
  }

  private safeDisplayText(value: string): string {
    if (typeof value !== 'string') {
      return ''
    }
    const lower = value.toLowerCase()
    if (lower.includes('[object object]')) {
      return '...'
    }
    return value
  }

  @Builder
  private SettingsSheetOverlay() {
    Column() {
      AIAssistantSettingsPanel({
        onSettingsChange: (settings: HarmonySettings) => {
          void this.loadSettings()
        }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private HistorySheetOverlay() {
    Column() {
      AIChatHistoryPanel({
        theme: this.theme,
        onLoadSession: (session: ChatSession) => {
          this.loadSessionFromHistory(session)
        },
        onClose: () => {
          this.showHistory = false
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  private chatTitleMenus(): HdsNavigationMenuContentOptions {
    return {
      value: [
        {
          content: {
            label: '新对话',
            icon: $r('sys.symbol.plus'),
            isEnabled: true,
            action: () => {
              this.startNewConversation()
            },
          },
        },
        {
          content: {
            label: '历史对话',
            icon: $r('sys.symbol.arrow_counterclockwise_clock'),
            isEnabled: true,
            action: () => {
              this.showHistory = true
            },
          },
        },
        {
          content: {
            label: 'AI助手设置',
            icon: $r('sys.symbol.gearshape'),
            isEnabled: true,
            action: () => {
              this.showAISettings = true
            },
          },
        },
      ],
    }
  }

  build() {
    HdsNavigation() {
      Column() {
        // Chat Content Area
        Column() {
          if (this.messages.length === 0) {
            Scroll() {
              Column() {
                Blank()
                  .height(90)

                // Robot Brand Logo
                Image($r('app.media.ri_ai'))
                  .width(64)
                  .height(64)
                  .objectFit(ImageFit.Contain)
                  .fillColor('#7A5AF8')
                  .margin({ bottom: 18 })

                // Brand Title
                Text('Livo AI')
                  .fontSize(26)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)
                  .margin({ bottom: 8 })

                // Sub-intro
                Text('您好，有什么可以帮您的？')
                  .fontSize(15)
                  .fontColor(this.theme.textSecondary)
                  .textAlign(TextAlign.Center)
                  .lineHeight(20)
                  .margin({ bottom: 32 })

                // Suggestions List
                Column({ space: 10 }) {
                  Row() {
                    SymbolGlyph($r('sys.symbol.bolt_fill'))
                      .fontSize(14)
                      .fontColor(['#7A5AF8'])
                      .margin({ right: 8 })
                    Text('帮我写一段代码')
                      .fontSize(14)
                      .fontColor(this.theme.textPrimary)
                  }
                  .width('100%')
                  .padding(14)
                  .backgroundColor(this.theme.surface)
                  .borderRadius(10)
                  .border({ width: 1, color: this.theme.divider })
                  .onClick(() => {
                    this.handleSuggestionClick('请帮我写一段代码')
                  })

                  Row() {
                    SymbolGlyph($r('sys.symbol.doc_plaintext'))
                      .fontSize(14)
                      .fontColor(['#7A5AF8'])
                      .margin({ right: 8 })
                    Text('解释一个概念')
                      .fontSize(14)
                      .fontColor(this.theme.textPrimary)
                  }
                  .width('100%')
                  .padding(14)
                  .backgroundColor(this.theme.surface)
                  .borderRadius(10)
                  .border({ width: 1, color: this.theme.divider })
                  .onClick(() => {
                    this.handleSuggestionClick('请帮我解释一个概念')
                  })
                }
                .width('100%')
                .margin({ bottom: 40 })

                Blank()
                  .height(40)
              }
              .width('100%')
              .padding({ left: 24, right: 24 })
            }
            .width('100%')
            .scrollBar(BarState.Off)
          } else {
            Scroll(this.scroller) {
              Column() {
                Blank()
                  .layoutWeight(1)

                ForEach(this.messages, (item: ChatMessage) => {
                  Column() {
                    if (item.role === 'user') {
                      Row() {
                        Blank()
                        Row() {
                          Text(this.safeDisplayText(item.content))
                            .fontSize(15)
                            .fontColor('#FFFFFF')
                            .lineHeight(20)
                        }
                        .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                        .backgroundColor('#7A5AF8')
                        .borderRadius(16)
                        .constraintSize({ maxWidth: '80%' })

                        Image($r('app.media.ri_ai'))
                          .width(32)
                          .height(32)
                          .objectFit(ImageFit.Contain)
                          .fillColor('#7A5AF8')
                          .borderRadius(16)
                          .backgroundColor(this.theme.surface)
                          .padding(4)
                          .margin({ left: 10 })
                      }
                      .width('100%')
                      .margin({ bottom: 14 })
                      .alignItems(VerticalAlign.Top)
                    } else {
                      Row() {
                        Image($r('app.media.ri_ai'))
                          .width(32)
                          .height(32)
                          .objectFit(ImageFit.Contain)
                          .fillColor('#7A5AF8')
                          .borderRadius(16)
                          .backgroundColor(this.theme.surface)
                          .padding(4)
                          .margin({ right: 10 })

                        Column() {
                          Text(item.role === 'system' ? '系统错误' : 'Livo AI')
                            .fontSize(11)
                            .fontColor(this.theme.textMuted)
                            .fontWeight(FontWeight.Medium)
                            .margin({ bottom: 4 })

                          Row() {
                            Text(this.safeDisplayText(item.id === this.streamingMessageId && this.streamingContent
                              ? this.streamingContent
                              : item.content))
                              .fontSize(15)
                              .fontColor(item.role === 'system' ? '#DC2626' : this.theme.textPrimary)
                              .lineHeight(20)
                          }
                          .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                          .backgroundColor(this.theme.surface)
                          .borderRadius(16)
                          .border({ width: 1, color: this.theme.divider })
                          .constraintSize({ maxWidth: '85%' })
                        }
                        .alignItems(HorizontalAlign.Start)

                        Blank()
                      }
                      .width('100%')
                      .margin({ bottom: 14 })
                      .alignItems(VerticalAlign.Top)
                    }
                  }
                }, (item: ChatMessage) => item.id)

                if (this.isLoading) {
                  Row() {
                    Image($r('app.media.ri_ai'))
                      .width(32)
                      .height(32)
                      .objectFit(ImageFit.Contain)
                      .fillColor('#7A5AF8')
                      .borderRadius(16)
                      .backgroundColor(this.theme.surface)
                      .padding(4)
                      .margin({ right: 10 })

                    Column() {
                      Text('Livo AI')
                        .fontSize(11)
                        .fontColor(this.theme.textMuted)
                        .fontWeight(FontWeight.Medium)
                        .margin({ bottom: 4 })

                      Row() {
                        Text('正在思考，请稍等...')
                          .fontSize(14)
                          .fontColor(this.theme.textMuted)
                      }
                      .padding({ left: 16, right: 16, top: 10, bottom: 10 })
                      .backgroundColor(this.theme.surface)
                      .borderRadius(16)
                      .border({ width: 1, color: this.theme.divider })
                    }
                    .alignItems(HorizontalAlign.Start)

                    Blank()
                  }
                  .width('100%')
                  .margin({ bottom: 14 })
                  .alignItems(VerticalAlign.Top)
                }
              }
              .width('100%')
              .padding({ left: 16, right: 16 })
              .constraintSize({ minHeight: '100%' })
            }
            .width('100%')
            .layoutWeight(1)
            .scrollBar(BarState.Off)
            .edgeEffect(EdgeEffect.Spring)
          }
        }
        .width('100%')
        .layoutWeight(1)

        // Footer / Chat Input Card
        Column() {
          Column() {
            Row() {
              TextArea({
                text: this.inputContent,
                placeholder: '输入您想了解的内容...',
                controller: this.inputController
              })
                .layoutWeight(1)
                .placeholderColor(this.theme.textMuted)
                .fontColor(this.theme.textPrimary)
                .backgroundColor('#00000000')
                .fontSize(15)
                .maxLines(5)
                .onChange((val: string) => {
                  this.inputContent = val
                })
                .onSubmit(() => {
                  this.handleSend()
                })

              Row() {
                SymbolGlyph($r('sys.symbol.paperplane_fill'))
                  .fontSize(16)
                  .fontColor([this.inputContent.trim() ? '#FFFFFF' : this.theme.textMuted])
              }
              .width(36)
              .height(36)
              .borderRadius(18)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              .backgroundColor(this.inputContent.trim() ? '#7A5AF8' : this.theme.divider)
              .onClick(() => {
                this.handleSend()
              })
            }
            .width('100%')
            .alignItems(VerticalAlign.Bottom)

            Row() {
              Row() {
                SymbolGlyph($r('sys.symbol.at'))
                  .fontSize(18)
                  .fontColor([this.theme.textMuted])
                  .margin({ right: 16 })

                SymbolGlyph($r('sys.symbol.paperclip'))
                  .fontSize(18)
                  .fontColor([this.theme.textMuted])
                  .margin({ right: 16 })

                Row() {
                  SymbolGlyph($r('sys.symbol.doc_plaintext'))
                    .fontSize(12)
                    .fontColor([this.theme.textPrimary])
                    .margin({ right: 4 })
                  Text('文章')
                    .fontSize(12)
                    .fontColor(this.theme.textPrimary)
                }
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .borderRadius(12)
                .backgroundColor(this.theme.elevated)
                .border({ width: 1, color: this.theme.divider })
                .onClick(() => {
                  this.inputContent += ' [当前文章] '
                })
              }
              .alignItems(VerticalAlign.Center)

              Blank()

              Row() {
                SymbolGlyph($r('sys.symbol.bolt_fill'))
                  .fontSize(12)
                  .fontColor(['#7A5AF8'])
                  .margin({ right: 4 })

                Text('智能')
                  .fontSize(12)
                  .fontColor(this.theme.textPrimary)

                SymbolGlyph($r('sys.symbol.chevron_down'))
                  .fontSize(10)
                  .fontColor([this.theme.textMuted])
                  .margin({ left: 4 })
              }
              .padding({ left: 10, right: 10, top: 4, bottom: 4 })
              .borderRadius(14)
              .backgroundColor(this.theme.elevated)
              .border({ width: 1, color: this.theme.divider })
              .alignItems(VerticalAlign.Center)
            }
            .width('100%')
            .margin({ top: 12 })
          }
          .width('100%')
          .padding(12)
          .borderRadius(16)
          .backgroundColor(this.theme.surface)
          .border({ width: 1, color: this.theme.divider })
        }
        .width('100%')
        .padding({ left: 16, right: 16, bottom: 20, top: 12 })
        .backgroundColor(this.theme.background)
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
    .bindSheet($$this.showAISettings, this.SettingsSheetOverlay(), {
      detents: [SheetSize.MEDIUM],
      dragBar: false,
      showClose: false,
      backgroundColor: this.theme.background,
      preferType: SheetType.CENTER,
    })
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
