# Livo 操作助手 (App Action Agent)

## 📋 项目概述

Livo 操作助手是一个为 Livo HarmonyOS 应用设计的智能对话 agent，类似于小型的 Hermes agent。它能够理解用户的自然语言意图，并帮助用户完成应用中的一系列操作。

## ✨ 核心特性

### 🎯 意图识别

- 基于规则匹配的意图识别引擎
- 支持多种自然语言表达方式
- 无需依赖外部LLM API

### 🛠️ 操作能力

#### 订阅管理

- ✅ 查看已订阅源列表
- ✅ 添加新的订阅源
- ✅ 删除订阅源

#### 主题设置

- ✅ 切换深色/浅色模式
- ✅ 调整主题强调色（橙/蓝/红/粉/绿）

#### 内容查看

- ✅ 查看收藏内容
- ✅ 查看历史对话
- ✅ 查看刷新日志
- ✅ 查看未读统计

#### 批量操作

- ✅ 全部标记为已读

### 💬 交互体验

- 对话式交互界面
- 工具执行状态实时显示
- 打字机效果展示结果
- 响应时间计时器
- 友好的错误提示

## 📁 文件结构

```
apps/harmony/
├── entry/src/main/ets/
│   ├── common/
│   │   ├── services/
│   │   │   └── AppActionAgentService.ets    # 核心agent服务
│   │   └── components/
│   │       └── AppActionPanel.ets           # UI组件
│   └── pages/
│       └── AppActionAgentDemo.ets           # 演示页面
├── tests/
│   └── app-action-agent.test.ts             # 测试文件
└── APP_ACTION_AGENT_GUIDE.md                # 使用指南
```

## 🚀 快速开始

### 1. 基本使用

```typescript
import { AppActionPanel } from '../common/components/AppActionPanel'
import { ThemeService } from '../common/services/ThemeService'

@Entry
@Component
struct MyPage {
  @State theme: ThemePalette = ThemeService.lightPalette()

  build() {
    AppActionPanel({
      theme: this.theme,
      onClose: () => {
        // 关闭回调
      }
    })
  }
}
```

### 2. 作为Sheet弹出

```typescript
@State showAgent: boolean = false

Button('操作助手')
  .onClick(() => this.showAgent = true)
  .bindSheet($$this.showAgent, this.AgentSheet(), {
    detents: [SheetSize.LARGE],
    dragBar: true,
    showClose: true,
  })

@Builder
AgentSheet() {
  AppActionPanel({
    theme: this.theme,
    onClose: () => this.showAgent = false
  })
}
```

## 💡 使用示例

### 订阅相关

```
用户: 我订阅了哪些源？
助手: 共订阅 5 个源：
      • 科技日报 [文章]
      • 知乎日报 [社交]
      • B站热门 [视频]
      ...
```

### 主题切换

```
用户: 切换到深色模式
助手: 已切换到深色模式

用户: 调整主题色为蓝色
助手: 主题色已更改为蓝色
```

### 内容查看

```
用户: 查看我的收藏
助手: 共收藏 12 篇文章，显示前 10 篇：
      1. 文章标题 (2024-01-15)
      2. 文章标题 (2024-01-14)
      ...
```

### 批量操作

```
用户: 全部标记为已读
助手: 已将 45 篇文章标记为已读
```

## 🔧 扩展开发

### 添加新工具

1. **定义工具** (AppActionAgentService.ets)

```typescript
{
  name: 'my_new_tool',
  description: '工具描述',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数描述' }
    },
    required: ['param1']
  }
}
```

2. **实现功能**

```typescript
async function myNewTool(
  args: Record<string, Object>,
): Promise<AppActionResult> {
  try {
    // 执行逻辑
    return { success: true, message: '操作成功' }
  } catch (e) {
    return { success: false, message: `失败: ${e.message}` }
  }
}
```

3. **注册工具**

```typescript
case 'my_new_tool':
  return myNewTool(parsedArgs)
```

4. **添加意图匹配**

```typescript
if (lowerPrompt.includes('关键词')) {
  const result = await myNewTool(parsedArgs)
  return { text: result.message }
}
```

## 🧪 测试

运行测试：

```bash
node --test apps/harmony/tests/app-action-agent.test.ts
```

## 📊 架构设计

### 数据流

```
用户输入 → 意图识别 → 工具调用 → 执行操作 → 返回结果 → 展示
```

### 核心组件

#### AppActionAgentService

- `runAppActionAgent()`: 主入口函数
- `executeAppActionByRules()`: 规则匹配引擎
- `executeAppActionTool()`: 工具执行分发
- 各种工具实现函数

#### AppActionPanel

- 对话界面渲染
- 工具状态显示
- 打字机效果
- 计时器动画

## 🎨 UI特性

- 深色/浅色主题自适应
- 工具执行状态动画
- 打字机文本效果
- 响应式布局
- 友好的空状态提示

## 🔮 未来规划

1. **意图识别增强**
   - 引入轻量级NLP模型
   - 支持更复杂的语义理解
   - 多语言支持

2. **多轮对话**
   - 上下文记忆
   - 参数澄清对话
   - 操作确认机制

3. **操作增强**
   - 操作撤销功能
   - 批量操作优化
   - 操作历史记录

4. **交互优化**
   - 语音输入支持
   - 快捷指令
   - 自定义工作流

5. **性能优化**
   - 工具执行缓存
   - 并行操作支持
   - 离线能力增强

## 📝 注意事项

1. 所有操作通过Repository层执行，确保数据一致性
2. 主题切换会立即生效并持久化到本地存储
3. 错误处理会返回友好的中文提示信息
4. 工具执行有超时保护机制
5. 建议在实际使用前进行充分测试

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个操作助手！

### 开发流程

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请提交Issue或联系开发团队。

---

**Livo Team** - 让阅读更智能 📚✨
