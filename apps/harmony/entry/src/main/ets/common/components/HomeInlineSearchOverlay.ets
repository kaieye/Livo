import { EntryCardModel } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { HighlightedInlineText } from './HighlightedInlineText'

const HOME_INLINE_SEARCH_INPUT_HEIGHT: number = 40
const HOME_INLINE_SEARCH_MAX_WIDTH: number = 360
const HOME_INLINE_SEARCH_RESULT_MAX_WIDTH: number = 360

export const HOME_INLINE_SEARCH_MOTION_DURATION: number = 240
export const HOME_INLINE_SEARCH_INPUT_ID: string = 'home-inline-search-input'

@Component
export struct HomeInlineSearchOverlay {
  @Prop visible: boolean = false
  @Prop showSearch: boolean = false
  @Prop query: string = ''
  @Prop placeholder: string = ''
  @Prop topPadding: number = 0
  @Prop horizontalPadding: number = 0
  @Prop searchFieldOffsetY: number = 0
  @Prop isRefreshing: boolean = false
  @Prop refreshTotalCount: number = 0
  @Prop displayRefreshPercent: number = 0
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop resultEntries: EntryCardModel[] = []
  @Prop showEmptyState: boolean = false
  inputController: TextInputController = new TextInputController()

  onQueryChange: (value: string) => void = () => {}
  onClose: (clearQuery: boolean) => void = () => {}
  onEntryClick: (entry: EntryCardModel) => void = () => {}
  onInputAppear: () => void = () => {}
  summaryTextForEntry: (entry: EntryCardModel) => string = () => ''

  private shellBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.74)' : 'rgba(255,255,255,0.84)'
  }

  private shellBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
  }

  private shellBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
  }

  private shellShadow(): ShadowOptions {
    return {
      radius: 10,
      color: this.theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.12)',
      offsetX: 0,
      offsetY: 2,
    }
  }

  @Builder
  private SearchField() {
    Row({ space: 8 }) {
      SymbolGlyph($r('sys.symbol.magnifyingglass'))
        .fontSize(16)
        .fontColor([this.theme.textSecondary])

      TextInput({
        text: this.query,
        placeholder: this.placeholder,
        controller: this.inputController,
      })
        .layoutWeight(1)
        .backgroundColor('transparent')
        .fontColor(this.theme.textPrimary)
        .placeholderColor(this.theme.textMuted)
        .caretColor(this.theme.accent)
        .padding(0)
        .id(HOME_INLINE_SEARCH_INPUT_ID)
        .focusable(true)
        .defaultFocus(this.visible)
        .onAppear(() => {
          this.onInputAppear()
        })
        .onChange((value: string) => {
          this.onQueryChange(value)
        })
        .onEditChange((isEditing: boolean) => {
          if (!isEditing && this.visible) {
            this.onClose(false)
          }
        })

      Text('×')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textMuted)
        .width(24)
        .height(24)
        .textAlign(TextAlign.Center)
        .borderRadius(999)
        .onClick(() => {
          this.onClose(true)
        })
    }
    .width('100%')
    .height(HOME_INLINE_SEARCH_INPUT_HEIGHT)
    .constraintSize({ maxWidth: HOME_INLINE_SEARCH_MAX_WIDTH })
    .padding({ left: 12, right: 8 })
    .backgroundColor(this.shellBackgroundColor())
    .backdropBlur(this.shellBackdropBlur())
    .borderRadius(HOME_INLINE_SEARCH_INPUT_HEIGHT)
    .border({ width: 0.8, color: this.shellBorderColor() })
    .shadow(this.shellShadow())
    .clip(true)
    .opacity(this.showSearch ? 1 : 0)
    .scale({
      x: this.showSearch ? 1 : 0.12,
      y: this.showSearch ? 1 : 0.88,
    })
    .translate({
      x: 0,
      y: this.searchFieldOffsetY,
    })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
  }

  @Builder
  private SearchResults() {
    List({ space: 0 }) {
      if (this.resultEntries.length > 0) {
        ForEach(this.resultEntries, (entry: EntryCardModel, index: number) => {
          ListItem() {
            Column({ space: 0 }) {
              Column({ space: 6 }) {
                Flex({ justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start }) {
                  HighlightedInlineText({
                    text: entry.title,
                    query: this.query,
                    theme: this.theme,
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: FontWeight.Bold,
                    defaultColor: this.theme.textPrimary,
                    maxLines: 2,
                  })

                  Text(entry.feedTitle || entry.author || '')
                    .fontSize(11)
                    .fontColor(this.theme.textMuted)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                    .flexShrink(0)
                    .margin({ left: 8, top: 2 })
                }
                .width('100%')

                if (this.summaryTextForEntry(entry)) {
                  HighlightedInlineText({
                    text: this.summaryTextForEntry(entry),
                    query: this.query,
                    theme: this.theme,
                    fontSize: 12,
                    lineHeight: 18,
                    fontWeight: FontWeight.Regular,
                    defaultColor: this.theme.textSecondary,
                    maxLines: 2,
                  })
                }
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
              .padding({ left: 16, right: 16, top: 10, bottom: 10 })
              .backgroundColor(this.theme.surface)
              .borderRadius(12)
              .clickEffect({ level: ClickEffectLevel.LIGHT })
              .onClick(() => {
                this.onEntryClick(entry)
              })

              if (index < this.resultEntries.length - 1) {
                Row()
                  .width('100%')
                  .height(0.5)
                  .margin({ left: 16, right: 16 })
                  .backgroundColor(this.theme.divider)
                  .opacity(this.theme.isDark ? 0.36 : 0.6)
              }
            }
            .width('100%')
          }
        }, (entry: EntryCardModel) => `${entry.id}_${this.query}`)
      } else if (this.showEmptyState) {
        ListItem() {
          Column({ space: 8 }) {
            Text('当前分段没有匹配内容')
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)

            Text('试试标题、摘要、来源或作者相关关键词')
              .fontSize(12)
              .lineHeight(18)
              .fontColor(this.theme.textSecondary)
              .textAlign(TextAlign.Center)
              .maxLines(2)
          }
          .width('100%')
          .padding({ left: 20, right: 20, top: 24, bottom: 24 })
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .backgroundColor(this.theme.surface)
          .borderRadius(12)
        }
      }
    }
    .width('100%')
    .constraintSize({ maxWidth: HOME_INLINE_SEARCH_RESULT_MAX_WIDTH })
    .backgroundColor(this.theme.surface)
    .borderRadius(20)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.08)',
      offsetY: 2,
    })
    .padding({ left: 8, right: 8, top: 8, bottom: 8 })
    .scrollBar(BarState.On)
    .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
    .alignListItem(ListItemAlign.Start)
    .clip(true)
  }

  build() {
    if (this.visible) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor(this.showSearch ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.001)')
          .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
          .onClick(() => {
            this.onClose(true)
          })
          .zIndex(125)

        Column({ space: 10 }) {
          this.SearchField()
          if (this.resultEntries.length > 0 || this.showEmptyState) {
            this.SearchResults()
          }
        }
        .width('100%')
        .align(Alignment.Top)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .padding({
          top: this.topPadding,
          left: this.horizontalPadding,
          right: this.horizontalPadding,
        })
        .zIndex(131)
      }
      .width('100%')
      .height('100%')
      // 整个搜索浮层需要作为同级顶层，避免被首页其它悬浮层压住。
      .zIndex(220)
    } else {
      Row()
        .width(0)
        .height(0)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
