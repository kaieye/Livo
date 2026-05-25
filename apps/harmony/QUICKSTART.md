# Livo 操作助手 - 快速开始

## 🚀 5分钟快速上手

### 步骤1: 查看演示页面

直接在DevEco Studio中打开并运行演示页面：

```
entry/src/main/ets/pages/AppActionAgentDemo.ets
```

### 步骤2: 测试核心功能

打开应用后，尝试以下对话：

```
1. "我订阅了哪些源？"
2. "切换到深色模式"
3. "查看我的收藏"
4. "查看未读统计"
5. "全部标记为已读"
```

### 步骤3: 集成到您的页面

在您的页面中添加以下代码：

```typescript
import { AppActionPanel } from '../common/components/AppActionPanel'
import { ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct MyPage {
  @State theme = ThemeService.lightPalette()
  @State showAgent = false

  build() {
    Stack() {
      // 您的页面内容

      // 浮动按钮
      Button('操作助手')
        .onClick(() => this.showAgent = true)
    }
    .bindSheet($$this.showAgent, this.AgentSheet(), {
      detents: [SheetSize.LARGE],
      dragBar: true,
      showClose: true,
    })
  }

  @Builder
  AgentSheet() {
    AppActionPanel({
      theme: this.theme,
      onClose: () => this.showAgent = false
    })
  }
}
```

## 📋 支持的操作速查表

| 操作     | 示例对话                                |
| -------- | --------------------------------------- |
| 查看订阅 | "我订阅了哪些源？"                      |
| 添加订阅 | "添加订阅 https://example.com/feed.xml" |
| 深色模式 | "切换到深色模式"                        |
| 浅色模式 | "使用浅色模式"                          |
| 主题色   | "调整主题色为蓝色"                      |
| 查看收藏 | "查看我的收藏"                          |
| 历史对话 | "查看历史对话"                          |
| 刷新日志 | "查看刷新日志"                          |
| 未读统计 | "查看未读统计"                          |
| 全部已读 | "全部标记为已读"                        |

## 🎯 核心文件说明

```
📁 entry/src/main/ets/common/services/
  └─ AppActionAgentService.ets    # 核心服务（意图识别+工具执行）

📁 entry/src/main/ets/common/components/
  └─ AppActionPanel.ets           # UI组件（对话界面）

📁 entry/src/main/ets/pages/
  └─ AppActionAgentDemo.ets       # 演示页面

📁 tests/
  └─ app-action-agent.test.ts     # 单元测试
```

## 📚 详细文档

- **使用指南**: `APP_ACTION_AGENT_GUIDE.md`
- **项目README**: `README_APP_ACTION_AGENT.md`
- **集成示例**: `INTEGRATION_EXAMPLES.md`
- **实现总结**: `IMPLEMENTATION_SUMMARY.md`

## 🔧 运行测试

```bash
cd D:\project\Livo\apps\harmony
node --test tests/app-action-agent.test.ts
```

## 💡 扩展新功能

参考 `APP_ACTION_AGENT_GUIDE.md` 中的"扩展指南"章节。

## ❓ 常见问题

**Q: 需要联网吗？**
A: 不需要，基于规则匹配，完全离线运行。

**Q: 如何自定义操作建议？**
A: 修改 `AppActionPanel.ets` 中的 suggestion 按钮列表。

**Q: 支持多语言吗？**
A: 当前支持中文，可在 `executeAppActionByRules` 中添加其他语言关键词。

## 🎉 开始使用！

现在您可以：

1. 运行演示页面体验功能
2. 集成到您的应用中
3. 根据需求扩展新操作

祝使用愉快！🚀
