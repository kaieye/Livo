# Livo 操作助手 (App Action Agent) 使用指南

## 概述

Livo 操作助手是一个小型的 Hermes-style agent，能够理解用户自然语言意图并执行应用中的各种操作。它基于规则匹配引擎，无需依赖外部LLM API即可工作。

## 核心组件

### 1. AppActionAgentService.ets

- **位置**: `entry/src/main/ets/common/services/AppActionAgentService.ets`
- **功能**: 核心agent服务，包含意图识别和工具执行逻辑

### 2. AppActionPanel.ets

- **位置**: `entry/src/main/ets/common/components/AppActionPanel.ets`
- **功能**: 用户界面组件，提供对话式交互体验

## 支持的操作

### 订阅管理

- **查看订阅**: "我订阅了哪些源？"、"查看订阅列表"
- **添加订阅**: "添加订阅 https://example.com/feed.xml"
- **删除订阅**: "删除某个订阅源"

### 主题设置

- **深色模式**: "切换到深色模式"、"使用dark主题"
- **浅色模式**: "切换到浅色模式"、"使用light主题"
- **主题色**: "调整主题色为蓝色"、"改成红色主题"
  - 支持颜色：橙色、蓝色、红色、粉色、绿色

### 内容查看

- **收藏内容**: "查看我的收藏"、"看收藏内容"
- **历史对话**: "查看历史对话"、"看之前的对话"
- **刷新日志**: "查看刷新日志"、"看同步记录"
- **未读统计**: "查看未读统计"、"有多少未读"

### 批量操作

- **全部已读**: "全部标记为已读"、"清空未读"

## 集成方式

### 在页面中使用

```typescript
import { AppActionPanel } from '../common/components/AppActionPanel'
import { ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct ActionAgentPage {
  @State theme: ThemePalette = ThemeService.lightPalette()

  build() {
    Column() {
      AppActionPanel({
        theme: this.theme,
        onClose: () => {
          router.back()
        }
      })
    }
  }
}
```

### 作为Sheet弹出

```typescript
@State showActionAgent: boolean = false

Button('操作助手')
  .onClick(() => {
    this.showActionAgent = true
  })
  .bindSheet($$this.showActionAgent, this.ActionAgentSheet(), {
    detents: [SheetSize.LARGE],
    dragBar: true,
    showClose: true,
  })

@Builder
ActionAgentSheet() {
  AppActionPanel({
    theme: this.theme,
    onClose: () => {
      this.showActionAgent = false
    }
  })
}
```

## 扩展指南

### 添加新工具

1. 在 `AppActionAgentService.ets` 中添加工具定义：

```typescript
{
  name: 'your_tool_name',
  description: '工具描述',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数1描述' }
    },
    required: ['param1']
  }
}
```

2. 实现工具执行函数：

```typescript
async function yourToolFunction(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    // 执行逻辑
    return {
      success: true,
      message: '操作成功',
      data: { ... }
    }
  } catch (e) {
    return {
      success: false,
      message: `操作失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
```

3. 在 `executeAppActionTool` 中注册：

```typescript
case 'your_tool_name':
  return yourToolFunction(parsedArgs)
```

4. 在 `executeAppActionByRules` 中添加意图匹配：

```typescript
if (lowerPrompt.includes('关键词')) {
  const result = await yourToolFunction(parsedArgs)
  rounds.push({
    name: 'your_tool_name',
    args: JSON.stringify(parsedArgs),
    result,
  })
  executedActions.push('your_tool_name')
  return { text: result.message }
}
```

5. 在 `AppActionPanel.ets` 的 `toolLabelOf` 中添加标签：

```typescript
case 'your_tool_name':
  return '工具中文标签'
```

## 架构特点

### 规则匹配引擎

- 不依赖外部LLM API，适合HarmonyOS环境
- 基于关键词匹配和模式识别
- 可扩展性强，易于添加新意图

### Harness设计

- 工具状态实时显示
- 执行进度动画反馈
- 计时器显示响应时间
- 错误处理和用户提示

### 数据流

```
用户输入 → 意图识别 → 工具调用 → 执行操作 → 返回结果 → 打字机效果展示
```

## 测试建议

### 功能测试

```typescript
// 测试订阅查询
runAppActionAgent('我订阅了哪些源？')

// 测试主题切换
runAppActionAgent('切换到深色模式')

// 测试收藏查看
runAppActionAgent('查看我的收藏')
```

### UI测试

- 验证工具状态动画
- 验证打字机效果
- 验证错误提示
- 验证响应时间显示

## 未来优化方向

1. **意图识别增强**: 引入轻量级NLP模型提高识别准确率
2. **多轮对话**: 支持上下文记忆和多轮交互
3. **操作撤销**: 提供操作撤销功能
4. **语音输入**: 集成HarmonyOS语音识别
5. **快捷指令**: 支持自定义快捷指令
6. **操作预览**: 执行前显示操作预览和确认

## 注意事项

1. 所有操作都会通过Repository层执行，确保数据一致性
2. 主题切换会立即生效并持久化
3. 错误处理会返回友好提示信息
4. 工具执行有超时保护机制

## 相关文件

- `AppActionAgentService.ets` - 核心服务
- `AppActionPanel.ets` - UI组件
- `FeedRepository.ets` - 订阅数据访问
- `EntryRepository.ets` - 文章数据访问
- `ThemeService.ets` - 主题服务
- `SettingsStore.ets` - 设置存储
- `ChatHistoryStore.ets` - 历史存储
