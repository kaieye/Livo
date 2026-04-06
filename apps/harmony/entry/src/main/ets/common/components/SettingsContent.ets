import { AppRepository } from '../data/AppRepository'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import {
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { BottomTabs } from './BottomTabs'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { AccountsSettingsPanel } from './AccountsSettingsPanel'
import {
  AboutSettingsPanel,
  DataControlSettingsPanel,
  GeneralSettingsPanel,
  PrivacySettingsPanel,
  FavoritesPanel,
} from './SettingsSecondaryPanels'
import { SettingListRow } from './SettingListRow'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

type SettingsSheetKey = '' | 'appearance' | 'general' | 'data-control' | 'privacy' | 'about' | 'favorites' | 'accounts'
const SETTINGS_ACTIVE_SHEET_KEY: string = 'settingsActiveSheetKey'
const SETTINGS_TITLE_BAR_MINI_HEIGHT: number = 56
const SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const SETTINGS_TITLE_BAR_OVERLAY_SPACER: number = SETTINGS_TITLE_BAR_MINI_HEIGHT + SETTINGS_TITLE_BAR_BOTTOM_TITLE_HEIGHT
interface SettingItem {
  title: string
  symbol: Resource
  symbolColor: string
  subtitle: string
  hint?: string
}

const PRIMARY_GROUP: SettingItem[] = [
  {
    title: '通用',
    symbol: $r('sys.symbol.gearshape'),
    symbolColor: '#4F5D75',
    subtitle: '语言、刷新与基础偏好'
  },
  {
    title: '外观',
    symbol: $r('sys.symbol.brush_fill'),
    symbolColor: '#6C63FF',
    subtitle: '主题、字号与阅读观感'
  },
  {
    title: '数据控制',
    symbol: $r('sys.symbol.externaldrive_fill'),
    symbolColor: '#3D7BFF',
    subtitle: '本地数据、缓存与同步控制'
  },
  {
    title: '账户',
    symbol: $r('sys.symbol.square_and_pencil'),
    symbolColor: '#FF8C42',
    subtitle: '账户连接与个人资料'
  },
]

const SECOND_GROUP: SettingItem[] = [
  {
    title: '收藏',
    symbol: $r('sys.symbol.star_fill'),
    symbolColor: '#F59E0B',
    subtitle: '查看并管理已收藏的推文与内容'
  },
  {
    title: '自动化',
    symbol: $r('sys.symbol.bolt_filled_on_circle'),
    symbolColor: '#7A5AF8',
    subtitle: '自动刷新与智能摘要'
  },
  {
    title: '列表',
    symbol: $r('sys.symbol.list_bullet_square_fill'),
    symbolColor: '#3B82F6',
    subtitle: '列表密度与内容呈现'
  },
]

const THIRD_GROUP: SettingItem[] = [
  {
    title: '订阅',
    symbol: $r('sys.symbol.folder_fill'),
    symbolColor: '#FF8A3D',
    subtitle: '订阅源导入、整理与同步'
  },
]

const FOURTH_GROUP: SettingItem[] = [
  {
    title: '隐私',
    symbol: $r('sys.symbol.person_shield_fill'),
    symbolColor: '#5B6CFF',
    subtitle: '代理、权限与本地隐私'
  },
  {
    title: '关于',
    symbol: $r('sys.symbol.info_circle'),
    symbolColor: '#7B8794',
    subtitle: '版本信息与项目说明'
  },
]

@Component
export struct SettingsContent {
  private static readonly SHEET_MIN_HEIGHT: number = 420
  private static readonly SHEET_COMPACT_HEIGHT: number = 440
  private static readonly SHEET_STANDARD_HEIGHT: number = 500
  private static readonly SHEET_TALL_HEIGHT: number = 600
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State saveHint: string = '设置将写入本地 Preferences'
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @State activeSheet: SettingsSheetKey = ''
  @State showSettingsSheet: boolean = false
  @StorageProp(SETTINGS_ACTIVE_SHEET_KEY) @Watch('handleStoredActiveSheetChange') storedActiveSheet: SettingsSheetKey = ''
  @StorageProp('settingsOverlayLevel') settingsOverlayLevel: number = 0
  @Prop showBottomTabs: boolean = true
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
      AppStorage.setOrCreate('settingsOverlayLevel', 1)
    }

    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      this.config = this.inheritedSettings
      this.hasLoaded = true
      this.onReady()
      return
    }

    void this.loadSettings()
  }

  private handleStoredActiveSheetChange(): void {
    if (this.storedActiveSheet && !this.showSettingsSheet) {
      this.activeSheet = this.storedActiveSheet
      this.showSettingsSheet = true
      AppStorage.setOrCreate('settingsOverlayLevel', 1)
      return
    }

    if (!this.storedActiveSheet && this.showSettingsSheet && this.activeSheet === '') {
      this.showSettingsSheet = false
      AppStorage.setOrCreate('settingsOverlayLevel', 0)
    }
  }

  private async loadSettings(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      this.config = await AppRepository.settings()
      if (this.showBottomTabs) {
        this.theme = await ThemeService.resolvePalette(this.config)
      } else {
        this.theme = this.inheritedTheme
      }
      this.saveHint = '已加载本地配置'
      this.hasLoaded = true
      this.onReady()
    } finally {
      this.isLoading = false
    }
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private syncInheritedSettings(): void {
    if (!this.showBottomTabs) {
      this.config = this.inheritedSettings
    }
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    this.onSettingsChange(next)
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      this.onSettingsChange(saved)
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
        this.onThemeChange(palette)
      })
      this.saveHint = '已保存到本地 Preferences'
    }).catch((error: Error) => {
      this.saveHint = `保存失败：${error.message}`
    })
  }

  private handleAppearanceSettingsChange(settings: HarmonySettings): void {
    this.config = settings
    this.onSettingsChange(settings)
  }

  private openSheet(sheet: SettingsSheetKey): void {
    if (this.showSettingsSheet && this.activeSheet === sheet) {
      return
    }

    this.activeSheet = sheet
    this.showSettingsSheet = true
    AppStorage.setOrCreate('settingsOverlayLevel', 1)
    AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, sheet)
  }

  private closeSheet(): void {
    this.showSettingsSheet = false
    AppStorage.setOrCreate('settingsOverlayLevel', 0)
    AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, '')
  }

  private initialSheetHeight(): number {
    let preferredHeight = SettingsContent.SHEET_STANDARD_HEIGHT
    switch (this.activeSheet) {
      case 'data-control':
        preferredHeight = SettingsContent.SHEET_COMPACT_HEIGHT
        break
      case 'general':
        preferredHeight = 450
        break
      case 'about':
        preferredHeight = 460
        break
      case 'privacy':
        preferredHeight = 520
        break
      case 'accounts':
        preferredHeight = 520
        break
      case 'appearance':
      case 'favorites':
        preferredHeight = SettingsContent.SHEET_TALL_HEIGHT
        break
      default:
        preferredHeight = SettingsContent.SHEET_STANDARD_HEIGHT
        break
    }
    return Math.max(SettingsContent.SHEET_MIN_HEIGHT, preferredHeight)
  }

  private themeLabel(): string {
    switch (this.config.themeMode) {
      case 'light':
        return '浅色'
      case 'dark':
        return '深色'
      default:
        return '跟随系统'
    }
  }

  private rootEnterTransition(delay: number = 0): TransitionEffect {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : TransitionEffect.IDENTITY
  }

  @Builder
  private SettingsLowerTitleBuilder() {
    Row() {
      Text('设置')
        .fontSize(28)
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
  private SettingRow(item: SettingItem, delay: number) {
    SettingListRow({
      title: item.title,
      symbol: item.symbol,
      symbolColor: item.symbolColor,
      subtitle: this.resolveSubtitle(item),
      hint: this.resolveHint(item),
      theme: this.theme,
      enableEnterTransition: this.showBottomTabs,
      onTap: () => this.handleSettingTap(item),
    })
      .transition(this.rootEnterTransition(delay))
  }

  @Builder
  private Group(items: SettingItem[], delay: number) {
    Column({ space: 8 }) {
      ForEach(items, (item: SettingItem, index: number) => {
        this.SettingRow(item, delay + index * 12)
      }, (item: SettingItem) => item.title)
    }
    .width('100%')
  }

  private resolveSubtitle(item: SettingItem): string {
    if (item.title === '外观') {
      return `${item.subtitle} · 当前${this.themeLabel()}`
    }
    if (item.title === '通用') {
      return `${item.subtitle} · ${this.config.language}`
    }
    if (item.title === '自动化') {
      return `${item.subtitle} · ${this.config.autoRefresh ? '已开启' : '已关闭'}`
    }
    return item.subtitle
  }

  private resolveHint(item: SettingItem): string {
    return item.hint ?? ''
  }

  private handleSettingTap(item: SettingItem): void {
    if (item.title === '收藏') {
      this.openSheet('favorites')
      return
    }
    if (item.title === '账户') {
      this.openSheet('accounts')
      return
    }
    if (item.title === '外观') {
      this.openSheet('appearance')
      return
    }
    if (item.title === '通用') {
      this.openSheet('general')
      return
    }
    if (item.title === '数据控制') {
      this.openSheet('data-control')
      return
    }
    if (item.title === '隐私') {
      this.openSheet('privacy')
      return
    }
    if (item.title === '关于') {
      this.openSheet('about')
    }
  }

  @Builder
  private SettingsRootContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.contentScroller) {
        Column({ space: 18 }) {
          Blank()
            .height(SETTINGS_TITLE_BAR_OVERLAY_SPACER)

          Column({ space: 14 }) {
            this.Group(PRIMARY_GROUP, 30)
            this.Group(SECOND_GROUP, 50)
            this.Group(THIRD_GROUP, 70)
            this.Group(FOURTH_GROUP, 90)
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

      if (this.showBottomTabs && !this.showSettingsSheet) {
        BottomTabs({ activeTab: 'settings', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  build() {
    if (this.showBottomTabs) {
      HdsNavigation() {
        this.SettingsRootContent()
      }
      .mode(NavigationMode.Stack)
      .hideTitleBar(true)
      .bindSheet($$this.showSettingsSheet, this.SettingsSheetOverlay(), {
        detents: [this.initialSheetHeight(), SheetSize.LARGE],
        dragBar: false,
        showClose: false,
        backgroundColor: this.theme.background,
        keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
        scrollSizeMode: ScrollSizeMode.CONTINUOUS,
        preferType: SheetType.CENTER,
        onWillDismiss: () => {
          this.showSettingsSheet = false
          this.activeSheet = ''
          AppStorage.setOrCreate('settingsOverlayLevel', 0)
          AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, '')
        },
      })
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    } else {
      HdsNavigation() {
        this.SettingsRootContent()
      }
      .titleBar({
        padding: {
          start: LengthMetrics.vp(2),
          end: LengthMetrics.vp(2),
        },
        style: {
          scrollEffectOpts: {
            enableScrollEffect: true,
            scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR,
            blurEffectiveStartOffset: LengthMetrics.vp(0),
            blurEffectiveEndOffset: LengthMetrics.vp(30),
          },
          blurStrategy: BlurStrategy.ENABLE,
          systemMaterialEffect: {
            materialType: hdsMaterial.MaterialType.IMMERSIVE,
            materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
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
            },
          },
        },
        content: {
          title: {
            mainTitle: '',
          },
          bottomBuilder: {
            builder: (): void => this.SettingsLowerTitleBuilder(),
          },
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .bindToScrollable([this.contentScroller])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .bindSheet($$this.showSettingsSheet, this.SettingsSheetOverlay(), {
        detents: [this.initialSheetHeight(), SheetSize.LARGE],
        dragBar: false,
        showClose: false,
        backgroundColor: this.theme.background,
        keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
        scrollSizeMode: ScrollSizeMode.CONTINUOUS,
        preferType: SheetType.CENTER,
        onWillDismiss: () => {
          this.showSettingsSheet = false
          this.activeSheet = ''
          AppStorage.setOrCreate('settingsOverlayLevel', 0)
          AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, '')
        },
      })
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
  }

  @Builder
  private SettingsSheetOverlay() {
    Column() {
      this.ActiveSheet()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private ActiveSheet() {
    Column() {
      if (this.activeSheet === 'appearance') {
        AppearanceSettingsPanel({
          showBackButton: false,
          initialSettings: this.config,
          inheritedTheme: this.theme,
          onSettingsChange: (settings: HarmonySettings) => {
            this.handleAppearanceSettingsChange(settings)
          },
          onThemeChange: (theme: ThemePalette) => {
            this.theme = theme
            this.onThemeChange(theme)
          },
          onClose: () => {
            this.closeSheet()
          },
        })
      } else if (this.activeSheet === 'general') {
        GeneralSettingsPanel({
          onSettingsChange: (settings: HarmonySettings) => {
            this.config = settings
          },
        })
      } else if (this.activeSheet === 'data-control') {
        DataControlSettingsPanel({
          onSettingsChange: (settings: HarmonySettings) => {
            this.config = settings
          },
        })
      } else if (this.activeSheet === 'privacy') {
        PrivacySettingsPanel()
      } else if (this.activeSheet === 'about') {
        AboutSettingsPanel()
      } else if (this.activeSheet === 'favorites') {
        FavoritesPanel()
      } else if (this.activeSheet === 'accounts') {
        AccountsSettingsPanel({
          inheritedTheme: this.theme,
        })
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Start)
    .alignItems(HorizontalAlign.Start)
  }

}
