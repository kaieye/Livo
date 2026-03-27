import { AppRepository } from '../data/AppRepository'
import { BottomTabs } from './BottomTabs'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { PageHeader } from './PageHeader'
import { SettingListRow } from './SettingListRow'
import {
  openAboutSettings,
  openDataControlSettings,
  openGeneralSettings,
  openPrivacySettings
} from '../navigation/AppRouter'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings, ThemeMode } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from '../ui/UiTokens'

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
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State saveHint: string = '设置将写入本地 Preferences'
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @State showAppearanceSheet: boolean = false
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onReady: () => void = () => {}

  aboutToAppear(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      if (this.hasLoaded || this.isLoading) {
        this.onReady()
        return
      }
    }

    void this.loadSettings()
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

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
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

  @Builder
  private SettingRow(item: SettingItem, delay: number) {
    SettingListRow({
      title: item.title,
      symbol: item.symbol,
      symbolColor: item.symbolColor,
      subtitle: this.resolveSubtitle(item),
      hint: this.resolveHint(item),
      theme: this.theme,
      onTap: () => this.handleSettingTap(item),
    })
      .transition(livoMotion.enterScale(delay))
  }

  @Builder
  private Group(items: SettingItem[], delay: number) {
    Column({ space: 10 }) {
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
    if (item.title === '外观') {
      return this.themeLabel()
    }
    if (item.title === '自动化') {
      return this.config.autoRefresh ? '开启' : '关闭'
    }
    if (item.title === '关于') {
      return 'Livo'
    }
    return item.hint ?? ''
  }

  private handleSettingTap(item: SettingItem): void {
    if (item.title === '外观') {
      this.showAppearanceSheet = true
      return
    }
    if (item.title === '通用') {
      void openGeneralSettings()
      return
    }
    if (item.title === '数据控制') {
      void openDataControlSettings()
      return
    }
    if (item.title === '隐私') {
      void openPrivacySettings()
      return
    }
    if (item.title === '关于') {
      void openAboutSettings()
    }
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      List({ space: 24 }) {
        ListItem() {
          Column({ space: 8 }) {
            PageHeader({
              title: '设置',
              theme: this.theme,
            })

            Text('调整主题、订阅、自动化与本地数据行为')
              .fontSize(13)
              .fontColor(this.theme.textSecondary)
              .padding({ left: 2, right: 2 })

            Text(this.saveHint)
              .fontSize(12)
              .fontColor(this.theme.textMuted)
              .padding({ left: 2, right: 2 })
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING })
        }

        ListItem() {
          Column({ space: 16 }) {
            this.Group(PRIMARY_GROUP, 30)
            this.Group(SECOND_GROUP, 50)
            this.Group(THIRD_GROUP, 70)
            this.Group(FOURTH_GROUP, 90)
          }
          .width('100%')
          .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
        }

        ListItem() {
          Row().height(100).width('100%')
        }
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
      .backgroundColor(this.theme.background)
      .edgeEffect(EdgeEffect.Spring)

      if (this.showBottomTabs) {
        BottomTabs({ activeTab: 'settings', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .bindSheet($$this.showAppearanceSheet, this.AppearanceSheet(), {
      detents: [SheetSize.MEDIUM, SheetSize.LARGE],
      dragBar: false,
      backgroundColor: this.theme.background,
      keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
      scrollSizeMode: ScrollSizeMode.CONTINUOUS,
      onWillDismiss: () => {
        this.showAppearanceSheet = false
      }
    })
  }

  @Builder
  private AppearanceSheet() {
    Column() {
      AppearanceSettingsPanel({
        showBackButton: false,
        onSettingsChange: (settings: HarmonySettings) => {
          this.handleAppearanceSettingsChange(settings)
        },
        onThemeChange: (theme: ThemePalette) => {
          this.theme = theme
          this.onThemeChange(theme)
        },
        onClose: () => {
          this.showAppearanceSheet = false
        },
      })
    }
    .width('100%')
    .height('100%')
  }
}
