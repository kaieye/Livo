import {
  ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { SettingListRow } from './SettingListRow'
import { SettingsSheetRouter } from './SettingsSheetRouter'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  SETTINGS_FOURTH_GROUP,
  SETTINGS_PRIMARY_GROUP,
  SETTINGS_SECOND_GROUP,
  SETTINGS_THIRD_GROUP,
  SettingItem,
  SettingsSheetKey,
  resolveInitialSheetHeight,
} from '../utils/SettingsCatalog'
import {
  ROOT_TAB_SCROLL_TO_TOP_AT_KEY,
  ROOT_TAB_SCROLL_TO_TOP_TAB_KEY,
  scrollScrollerToTop,
} from '../coordinators/index-home/RootTabScrollToTopSignal'
import {
  SETTINGS_ACTIVE_SHEET_KEY,
  settingsActiveSheet,
  settingsOverlayLevel,
} from '../utils/AppSignals'

const SETTINGS_TITLE_BAR_MINI_HEIGHT: number = 56
const SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const SETTINGS_TITLE_BAR_OVERLAY_SPACER: number =
  SETTINGS_TITLE_BAR_MINI_HEIGHT + SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET

@Component
export struct SettingsContent {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State activeSheet: SettingsSheetKey = ''
  @State showSettingsSheet: boolean = false
  @StorageProp(SETTINGS_ACTIVE_SHEET_KEY) @Watch('handleStoredActiveSheetChange') storedActiveSheet: SettingsSheetKey = ''
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_AT_KEY) @Watch('handleRootTabScrollToTopSignal') rootTabScrollToTopAt: number = 0
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_TAB_KEY) rootTabScrollToTopTab: string = ''
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  @Prop @Watch('syncInheritedSettings') inheritedSettings: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  private readonly contentScroller: Scroller = new Scroller()
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onContentScrollerReady: (scroller: Scroller) => void = () => {}
  onReady: () => void = () => {}

  aboutToAppear(): void {
    this.onContentScrollerReady(this.contentScroller)
    const restoreSheet = this.storedActiveSheet || AppStorage.get<SettingsSheetKey>(SETTINGS_ACTIVE_SHEET_KEY)
    if (restoreSheet && !this.showSettingsSheet) {
      this.activeSheet = restoreSheet
      this.showSettingsSheet = true
      settingsOverlayLevel.write(1)
    }

    this.theme = this.inheritedTheme
    this.config = this.inheritedSettings
    this.onReady()
  }

  private handleStoredActiveSheetChange(): void {
    if (this.storedActiveSheet && !this.showSettingsSheet) {
      this.activeSheet = this.storedActiveSheet
      this.showSettingsSheet = true
      settingsOverlayLevel.write(1)
      return
    }

    if (!this.storedActiveSheet && this.showSettingsSheet && this.activeSheet === '') {
      this.showSettingsSheet = false
      settingsOverlayLevel.write(0)
    }
  }

  private syncInheritedTheme(): void {
    this.theme = this.inheritedTheme
  }

  private syncInheritedSettings(): void {
    this.config = this.inheritedSettings
  }

  private handleRootTabScrollToTopSignal(): void {
    if (this.rootTabScrollToTopTab !== 'settings' || this.showSettingsSheet) {
      return
    }

    scrollScrollerToTop(this.contentScroller, '设置')
  }

  private propagateSettings(settings: HarmonySettings): void {
    this.config = settings
    this.onSettingsChange(settings)
  }

  private openSheet(sheet: SettingsSheetKey): void {
    if (!sheet) {
      return
    }
    if (this.showSettingsSheet && this.activeSheet === sheet) {
      return
    }

    this.activeSheet = sheet
    this.showSettingsSheet = true
    settingsOverlayLevel.write(1)
    settingsActiveSheet.write(sheet)
  }

  private closeSheet(): void {
    this.showSettingsSheet = false
    this.activeSheet = ''
    settingsOverlayLevel.write(0)
    settingsActiveSheet.write('')
  }

  private resolveSubtitle(item: SettingItem): string {
    if (item.title === 'AI助手') {
      return `${item.subtitle} · ${this.config.aiSummaryEnabled ? '已开启' : '已关闭'}`
    }
    return item.subtitle
  }

  private resolveHint(item: SettingItem): string {
    return item.hint ?? ''
  }

  @Builder
  private SettingsLowerTitleBuilder() {
    Row() {
      Text('设置')
        .fontSize(ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  @Builder
  private SettingRow(item: SettingItem) {
    SettingListRow({
      title: item.title,
      symbol: item.symbol,
      symbolIsImage: item.symbolIsImage ?? false,
      symbolColor: item.symbolColor,
      subtitle: this.resolveSubtitle(item),
      hint: this.resolveHint(item),
      theme: this.theme,
      enableEnterTransition: false,
      onTap: () => this.openSheet(item.sheet),
    })
  }

  @Builder
  private Group(items: SettingItem[]) {
    Column({ space: 8 }) {
      ForEach(items, (item: SettingItem) => {
        this.SettingRow(item)
      }, (item: SettingItem) => item.title)
    }
    .width('100%')
  }

  @Builder
  private SettingsRootContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.contentScroller) {
        Column({ space: 18 }) {
          Blank()
            .height(SETTINGS_TITLE_BAR_OVERLAY_SPACER)

          Column({ space: 8 }) {
            this.Group(SETTINGS_PRIMARY_GROUP)
            this.Group(SETTINGS_SECOND_GROUP)
            this.Group(SETTINGS_THIRD_GROUP)
            this.Group(SETTINGS_FOURTH_GROUP)
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, bottom: 8 })

          Row().height(100).width('100%')
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)
      .edgeEffect(EdgeEffect.Spring)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private SettingsSheetOverlay() {
    Column() {
      SettingsSheetRouter({
        activeSheet: this.activeSheet,
        theme: this.theme,
        config: this.config,
        onSettingsChange: (settings: HarmonySettings) => {
          this.propagateSettings(settings)
        },
        onThemeChange: (theme: ThemePalette) => {
          this.theme = theme
          this.onThemeChange(theme)
        },
        onClose: () => {
          this.closeSheet()
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  build() {
    Stack() {
      this.SettingsRootContent()
    }
    .bindSheet($$this.showSettingsSheet, this.SettingsSheetOverlay(), {
      detents: [resolveInitialSheetHeight(this.activeSheet), SheetSize.LARGE],
      dragBar: false,
      showClose: false,
      backgroundColor: this.theme.background,
      keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
      scrollSizeMode: ScrollSizeMode.CONTINUOUS,
      preferType: SheetType.CENTER,
      onWillDismiss: () => {
        this.closeSheet()
      },
    })
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
