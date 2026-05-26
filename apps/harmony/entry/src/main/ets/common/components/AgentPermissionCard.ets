import {
  AgentPermissionSettings,
  DEFAULT_AI_ASSISTANT_SETTINGS,
} from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG } from '../ui/UiTokens'
import {
  AI_PANEL_ICON_SIZE,
  AI_PANEL_ROW_MIN_HEIGHT,
  AI_PANEL_ROW_PADDING_HORIZONTAL,
  AI_PANEL_ROW_PADDING_VERTICAL,
  AI_PANEL_ROW_TEXT_SPACING,
  AI_PANEL_SUBTITLE_SIZE,
  AI_PANEL_TITLE_SIZE,
} from '../ui/AIPanelTokens'

interface AgentPermissionPatch {
  allowRead?: boolean
  allowNavigate?: boolean
  allowMutate?: boolean
  allowDestructive?: boolean
  allowExternal?: boolean
}

@Component
export struct AgentPermissionCard {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop permissions: AgentPermissionSettings = DEFAULT_AI_ASSISTANT_SETTINGS.agentPermissions
  @Prop iconDelay: number = 0
  onPermissionsChange: (permissions: AgentPermissionSettings) => void = () => {}

  private nextPermissions(patch: AgentPermissionPatch): AgentPermissionSettings {
    return {
      allowRead: patch.allowRead ?? this.permissions.allowRead,
      allowNavigate: patch.allowNavigate ?? this.permissions.allowNavigate,
      allowMutate: patch.allowMutate ?? this.permissions.allowMutate,
      allowDestructive: patch.allowDestructive ?? this.permissions.allowDestructive,
      allowExternal: patch.allowExternal ?? this.permissions.allowExternal,
    }
  }

  @Builder
  private DividerLine() {
    Row()
      .width('92%')
      .height(0.5)
      .backgroundColor(this.theme.divider)
  }

  @Builder
  private PermissionRow(
    symbol: Resource,
    title: string,
    subtitle: string,
    checked: boolean,
    onToggle: (checked: boolean) => void,
    iconDelay: number,
  ) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(AI_PANEL_ICON_SIZE)
        .fontColor([this.theme.accent])
        .transition(livoMotion.enterIconSpin(iconDelay))

      Column({ space: AI_PANEL_ROW_TEXT_SPACING }) {
        Text(title)
          .fontSize(AI_PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(AI_PANEL_SUBTITLE_SIZE)
          .fontColor(this.theme.textSecondary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange((isOn: boolean) => onToggle(isOn))
    }
    .width('100%')
    .constraintSize({ minHeight: AI_PANEL_ROW_MIN_HEIGHT })
    .padding({
      left: AI_PANEL_ROW_PADDING_HORIZONTAL,
      right: AI_PANEL_ROW_PADDING_HORIZONTAL,
      top: AI_PANEL_ROW_PADDING_VERTICAL,
      bottom: AI_PANEL_ROW_PADDING_VERTICAL,
    })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => onToggle(!checked))
  }

  build() {
    Column() {
      this.PermissionRow(
        $r('sys.symbol.doc_plaintext'),
        '读取本地上下文',
        '允许工具读取订阅、文章和历史摘要',
        this.permissions.allowRead,
        (checked: boolean) => this.onPermissionsChange(this.nextPermissions({ allowRead: checked })),
        this.iconDelay,
      )
      this.DividerLine()
      this.PermissionRow(
        $r('sys.symbol.chevron_right'),
        '打开页面',
        '允许切换标签页和打开文章、订阅或设置页',
        this.permissions.allowNavigate,
        (checked: boolean) => this.onPermissionsChange(this.nextPermissions({ allowNavigate: checked })),
        this.iconDelay + 1,
      )
      this.DividerLine()
      this.PermissionRow(
        $r('sys.symbol.gearshape'),
        '修改设置与订阅',
        '写入类操作仍会先显示确认卡',
        this.permissions.allowMutate,
        (checked: boolean) => this.onPermissionsChange(this.nextPermissions({ allowMutate: checked })),
        this.iconDelay + 2,
      )
      this.DividerLine()
      this.PermissionRow(
        $r('sys.symbol.link'),
        '外部访问/导出',
        '允许网络搜索、账号登录页和 OPML 导出',
        this.permissions.allowExternal,
        (checked: boolean) => this.onPermissionsChange(this.nextPermissions({ allowExternal: checked })),
        this.iconDelay + 3,
      )
      this.DividerLine()
      this.PermissionRow(
        $r('sys.symbol.trash'),
        '删除或覆盖数据',
        '删除、清空和覆盖导入必须额外确认',
        this.permissions.allowDestructive,
        (checked: boolean) => this.onPermissionsChange(this.nextPermissions({ allowDestructive: checked })),
        this.iconDelay + 4,
      )
    }
    .width('100%')
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
