# Livo 操作助手集成示例

## 在Index页面中集成操作助手

以下示例展示如何在现有的Index.ets页面中集成操作助手功能。

### 方式1: 作为浮动按钮

```typescript
// 在 Index.ets 中添加
import { AppActionPanel } from '../common/components/AppActionPanel'
import { ThemeService, ThemePalette } from '../common/services/ThemeService'

@Entry
@Component
struct Index {
  @State theme: ThemePalette = ThemeService.lightPalette()
  @State showActionAgent: boolean = false

  build() {
    Stack() {
      // 原有内容
      Column() {
        // ... 原有页面内容
      }

      // 浮动操作助手按钮
      Column() {
        Blank()
        Row() {
          Button() {
            SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
              .fontSize(24)
              .fontColor(['#FFFFFF'])
          }
          .width(56)
          .height(56)
          .borderRadius(28)
          .backgroundColor('#7A5AF8')
          .shadow({
            radius: 8,
            color: 'rgba(122, 90, 248, 0.3)',
            offsetX: 0,
            offsetY: 4
          })
          .onClick(() => {
            this.showActionAgent = true
          })
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
        .padding({ right: 20, bottom: 20 })
      }
    }
    .bindSheet($$this.showActionAgent, this.ActionAgentSheet(), {
      detents: [SheetSize.LARGE],
      dragBar: true,
      showClose: true,
      backgroundColor: this.theme.background,
    })
  }

  @Builder
  ActionAgentSheet() {
    AppActionPanel({
      theme: this.theme,
      onClose: () => {
        this.showActionAgent = false
      }
    })
  }
}
```

### 方式2: 作为导航页面

```typescript
// 在 AppRouter.ets 中添加路由
import { AppActionAgentDemo } from '../pages/AppActionAgentDemo'

export class AppRouter {
  static readonly ACTION_AGENT = 'action_agent'

  static routes: Map<string, Component> = new Map([
    // ... 现有路由
    [AppRouter.ACTION_AGENT, AppActionAgentDemo],
  ])
}

// 在需要跳转的地方
router.pushUrl({
  url: 'pages/AppActionAgentDemo',
})
```

### 方式3: 作为Tab页面

```typescript
// 在底部Tab栏中添加操作助手入口
@Builder
TabBuilder() {
  Tabs() {
    // ... 其他Tab

    TabContent() {
      AppActionPanel({
        theme: this.theme,
        onClose: () => {}
      })
    }
    .tabBar(this.TabBarBuilder('操作助手', $r('sys.symbol.bolt_circle_fill')))
  }
}

@Builder
TabBarBuilder(title: string, icon: Resource) {
  Column() {
    SymbolGlyph(icon)
      .fontSize(24)
      .fontColor([this.selectedIndex === this.tabIndex ? '#7A5AF8' : this.theme.textMuted])
    Text(title)
      .fontSize(10)
      .fontColor(this.selectedIndex === this.tabIndex ? '#7A5AF8' : this.theme.textMuted)
  }
}
```

## 在设置页面中添加入口

```typescript
// 在 Settings.ets 中添加
ListItem() {
  Row() {
    SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
      .fontSize(24)
      .fontColor(['#7A5AF8'])
      .margin({ right: 16 })

    Column() {
      Text('操作助手')
        .fontSize(16)
        .fontColor(this.theme.textPrimary)
      Text('通过对话方式完成应用操作')
        .fontSize(12)
        .fontColor(this.theme.textMuted)
        .margin({ top: 4 })
    }

    Blank()

    SymbolGlyph($r('sys.symbol.chevron_right'))
      .fontSize(16)
      .fontColor([this.theme.textMuted])
  }
  .padding(16)
  .onClick(() => {
    router.pushUrl({
      url: 'pages/AppActionAgentDemo'
    })
  })
}
```

## 快捷操作集成

### 长按手势触发

```typescript
// 在主页面添加长按手势
.gesture(
  LongPressGesture({ repeat: false, duration: 1000 })
    .onAction(() => {
      this.showActionAgent = true
    })
)
```

### 语音唤醒集成

```typescript
// 集成HarmonyOS语音能力
import { agent } from '@kit.AiAgentKit'

// 当语音识别到操作意图时
onVoiceIntent(intent: string) {
  if (this.isActionIntent(intent)) {
    this.showActionAgent = true
    // 自动填充语音输入
    setTimeout(() => {
      // 通过某种方式传递intent到AppActionPanel
    }, 300)
  }
}

isActionIntent(intent: string): boolean {
  const actionKeywords = ['订阅', '主题', '收藏', '历史', '刷新', '已读']
  return actionKeywords.some(keyword => intent.includes(keyword))
}
```

## 全局状态管理

如果需要跨组件共享agent状态：

```typescript
// 创建全局状态
export class AppActionAgentState {
  static shared: AppActionAgentState = new AppActionAgentState()

  @State isVisible: boolean = false
  @State lastAction: string = ''
  @State actionHistory: string[] = []

  show() {
    this.isVisible = true
  }

  hide() {
    this.isVisible = false
  }

  recordAction(action: string) {
    this.actionHistory.push(action)
    this.lastAction = action
  }
}

// 在组件中使用
@Observed agentState: AppActionAgentState = AppActionAgentState.shared
```

## 主题同步

确保agent面板与主应用主题同步：

```typescript
// 监听主题变化
onThemeChange(newTheme: ThemePalette) {
  this.theme = newTheme
}

// 或者使用响应式
@Provide theme: ThemePalette = ThemeService.currentPalette()

// 在AppActionPanel中
@Consume theme: ThemePalette
```

## 最佳实践

1. **入口明显**: 将操作助手入口放在用户容易发现的位置
2. **快捷操作**: 提供手势或快捷键快速触发
3. **上下文感知**: 根据当前页面提供相关的操作建议
4. **状态同步**: 确保主题和设置与主应用同步
5. **错误处理**: 友好的错误提示和恢复机制
6. **性能优化**: 避免不必要的重渲染

## 常见问题

### Q: 如何自定义操作建议？

A: 修改AppActionPanel.ets中的suggestion按钮列表

### Q: 如何添加新的操作？

A: 参考APP_ACTION_AGENT_GUIDE.md中的扩展指南

### Q: 支持离线使用吗？

A: 是的，基于规则匹配，无需网络

### Q: 如何国际化？

A: 在executeAppActionByRules中添加多语言关键词匹配
