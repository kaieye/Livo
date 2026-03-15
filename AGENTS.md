# Livo - 开发指南

## 项目概述

Livo 是一个自由开源的 RSS 阅读器，灵感来自 [Folo](https://github.com/RSSNext/Folo)。项目采用现代化的技术栈构建，提供完整的桌面端 RSS 阅读体验，支持 AI 功能且无需登录订阅。

**核心特性：**
- 📡 **RSS/Atom 订阅** - 支持主流 RSS 格式，自动发现 RSS 源
- 🤖 **AI 摘要与翻译** - 支持 OpenAI、Anthropic、DeepSeek、Ollama 等多种 AI 提供商
- 💾 **本地存储** - 使用 JSON 文件数据库（`livo-data.json`），数据完全本机保存
- 🌙 **暗色模式** - 支持系统级主题切换
- ⚡ **高性能** - 基于 Electron 和 React 19 构建
- 🔍 **全文搜索** - 快速搜索历史文章
- ⭐ **收藏功能** - 收藏重要文章

## 技术架构

### 技术栈
- **Electron 33** - 跨平台桌面应用框架
- **React 19** - 前端 UI 框架
- **Vite** - 构建工具（通过 electron-vite 集成）
- **TypeScript** - 类型安全的 JavaScript 超集
- **TailwindCSS 3** - 实用优先的 CSS 框架
- **Zustand** - 轻量级状态管理
- **Node.js fs/path** - 本地 JSON 文件数据库读写
- **rss-parser** - RSS 内容解析
- **Lucide React** - 图标库
- **React Router DOM 7** - 路由管理
- **i18next** - 国际化支持

### 项目结构
```
Livo/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 应用入口和窗口管理
│   │   ├── database.ts    # JSON 文件数据库操作
│   │   ├── handlers/      # IPC 处理器
│   │   │   ├── feed-handlers.ts      # 订阅源相关操作
│   │   │   ├── entry-handlers.ts     # 文章条目操作
│   │   │   ├── ai-handlers.ts        # AI 功能处理
│   │   │   ├── settings-handlers.ts  # 设置管理
│   │   │   ├── discover-handlers.ts  # 发现功能
│   │   │   ├── notification-handlers.ts # 通知处理
│   │   │   ├── readability-handlers.ts  # 可读性处理
│   │   │   ├── account-handlers.ts   # 账户相关
│   │   │   └── video-handlers.ts     # 视频处理
│   │   └── services/      # 业务服务
│   │       ├── rss-parser.ts          # RSS 解析服务
│   │       ├── feed-refresh.ts        # 订阅源刷新
│   │       ├── feed-avatar.ts         # 订阅源头像处理
│   │       ├── feed-title.ts          # 订阅源标题处理
│   │       ├── feed-utils.ts          # 订阅源工具
│   │       ├── bilibili-followings.ts # B站关注处理
│   │       ├── readability.ts         # 文章可读性提取
│   │       ├── account-auth.ts        # 账户认证
│   │       ├── account-session.ts     # 会话管理
│   │       ├── rsshub-url.ts          # RSSHub URL 处理
│   │       ├── video-duration.ts      # 视频时长处理
│   │       ├── video-proxy.ts         # 视频代理
│   │       └── youtube-profile-resolver.ts # YouTube 资料解析
│   ├── preload/           # Preload 脚本
│   │   └── index.ts       # 桥接主进程和渲染进程
│   ├── renderer/          # React 渲染进程
│   │   ├── index.html     # 主页面模板
│   │   └── src/
│   │       ├── App.tsx    # 根组件
│   │       ├── main.tsx   # React 入口
│   │       ├── env.d.ts   # 环境类型定义
│   │       ├── i18n.ts    # 国际化配置
│   │       ├── components/ # UI 组件
│   │       │   ├── layout/      # 布局组件
│   │       │   ├── feed/        # 订阅源相关组件
│   │       │   ├── entry/       # 文章条目组件
│   │       │   ├── ai/          # AI 功能组件
│   │       │   ├── settings/    # 设置组件
│   │       │   ├── discover/    # 发现组件
│   │       │   ├── media/       # 媒体组件
│   │       │   ├── search/      # 搜索组件
│   │       │   ├── shortcuts/   # 快捷键组件
│   │       │   └── ui/          # 通用 UI 组件
│   │       ├── hooks/     # 自定义 React Hooks
│   │       │   └── useInitRecommendedFeeds.ts # 推荐订阅源初始化
│   │       ├── lib/       # 工具库
│   │       │   ├── blurhash.ts         # 图片模糊哈希
│   │       │   ├── date-groups.ts      # 日期分组
│   │       │   ├── date-locale.ts      # 日期本地化
│   │       │   ├── dedupe-social.ts    # 社交内容去重
│   │       │   ├── image-proxy.ts      # 图片代理
│   │       │   ├── lru-cache.ts        # LRU 缓存
│   │       │   ├── social-url.ts       # 社交 URL 处理
│   │       │   └── view-type-keys.ts   # 视图类型键值
│   │       ├── locales/   # 国际化文件
│   │       │   ├── en.ts  # 英文翻译
│   │       │   └── zh-CN.ts # 中文翻译
│   │       ├── providers/ # Context Providers
│   │       │   └── I18nProvider.tsx # 国际化 Provider
│   │       ├── store/     # Zustand 状态存储
│   │       │   ├── actions-store.ts    # 操作状态
│   │       │   ├── ai-chat-store.ts    # AI 聊天状态
│   │       │   ├── discover-store.ts   # 发现状态
│   │       │   ├── entry-store.ts      # 文章状态
│   │       │   ├── feed-store.ts       # 订阅源状态
│   │       │   └── settings-store.ts   # 设置状态
│   │       ├── styles/    # 样式文件
│   │       │   └── globals.css # 全局样式
│   │       └── utils/     # 工具函数
│   │           └── sanitize.ts # HTML 清理
│   ├── shared/            # 共享代码
│   │   ├── types.ts       # TypeScript 类型定义
│   │   ├── actions.ts     # 操作类型
│   │   ├── discover-data.ts # 发现数据
│   │   ├── profile-resolver.ts # 资料解析
│   │   └── shortcuts.ts   # 快捷键定义
│   └── web/               # Web 版本
│       ├── index.html     # Web 页面模板
│       ├── main.tsx       # Web 入口
│       ├── storage.ts     # Web 存储
│       └── web-api.ts     # Web API 模拟
├── package.json           # 项目配置和依赖
├── electron.vite.config.ts # Electron-Vite 配置
├── vite.config.web.ts     # Web 版本 Vite 配置
├── tailwind.config.ts     # TailwindCSS 配置
├── postcss.config.cjs     # PostCSS 配置
├── tsconfig.json          # TypeScript 配置
├── tsconfig.node.json     # Node.js TypeScript 配置
└── AGENTS.md              # 项目开发说明
```

### 核心模块说明

#### 1. 主进程 (Main Process)
- **窗口管理**：创建和管理应用窗口
- **IPC 通信**：通过 IPC 与渲染进程通信
- **数据库操作**：JSON 文件数据库的 CRUD 操作
- **系统集成**：系统托盘、菜单、通知等

#### 2. 渲染进程 (Renderer Process)
- **React 应用**：基于 React 19 的单页应用
- **状态管理**：使用 Zustand 进行状态管理
- **路由管理**：React Router DOM 7
- **国际化**：i18next 支持多语言
- **UI 组件**：基于 TailwindCSS 的组件库

#### 3. 预加载脚本 (Preload Script)
- **安全桥接**：在隔离的上下文中暴露安全的 API
- **IPC 封装**：提供类型安全的 IPC 调用

#### 4. 共享代码 (Shared Code)
- **类型定义**：统一的 TypeScript 类型
- **工具函数**：跨进程共享的工具函数

## 开发命令

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
# 启动 Electron 开发模式
pnpm dev

# 启动 Web 版本开发模式
pnpm dev:web
```

### 构建应用
```bash
# 构建 Electron 应用
pnpm build

# 构建 Windows 安装包
pnpm build:win

# 构建 macOS 安装包
pnpm build:mac

# 构建 Linux 安装包
pnpm build:linux

# 构建 Web 版本
pnpm build:web
```

### 代码检查
```bash
# TypeScript 类型检查
pnpm typecheck
```

### 预览
```bash
# 预览 Electron 构建
pnpm preview

# 预览 Web 版本
pnpm preview:web
```

## 依赖管理

### 主要运行时依赖
- `@tanstack/react-virtual` - 虚拟列表，用于高性能滚动
- `date-fns` - 日期处理库
- `i18next` / `react-i18next` - 国际化支持
- `openai` - OpenAI API 客户端（支持多提供商）
- `rss-parser` - RSS/Atom 解析器
- `uuid` - UUID 生成

### 主要开发依赖
- `electron` / `electron-vite` - Electron 开发工具链
- `react` / `react-dom` - React 框架
- `typescript` - TypeScript 编译器
- `tailwindcss` - CSS 框架
- `lucide-react` - 图标库
- `zustand` - 状态管理
- `react-router-dom` - 路由管理

### 构建配置
- **electron-vite**：Electron 专用的 Vite 配置
- **Vite**：快速的构建工具，支持 HMR
- **TypeScript**：严格的类型检查
- **TailwindCSS**：JIT 编译的 CSS 框架

## 开发实践

### 代码风格
- **TypeScript 严格模式**：启用所有严格类型检查
- **函数式组件**：优先使用 React 函数式组件
- **Hooks**：使用 React Hooks 进行状态和副作用管理
- **CSS-in-JS**：使用 TailwindCSS 实用类进行样式编写

### 状态管理
- **Zustand Stores**：按功能模块组织状态
- **Immer 集成**：支持不可变状态更新
- **Selector 优化**：使用选择器避免不必要的重渲染

### 性能优化
- **虚拟列表**：使用 `@tanstack/react-virtual` 处理长列表
- **图片懒加载**：图片使用 `loading="lazy"` 属性
- **代码分割**：Vite 自动代码分割
- **缓存策略**：使用 LRU 缓存常用数据

### 错误处理
- **React Error Boundaries**：组件级错误捕获
- **IPC 错误处理**：主进程和渲染进程间的错误传递
- **写入策略**：延迟写盘（debounce）与强制保存，降低频繁 IO

## 数据库设计

### 核心数据结构（JSON）
- **feeds**：订阅源信息数组
- **entries**：文章条目数组
- **索引缓存**：按 URL/身份键建立内存索引，加速查询与去重

### 数据同步
- **本地优先**：所有数据首先存储在本地
- **增量更新**：RSS 订阅使用增量更新策略
- **冲突解决**：基于时间戳的冲突解决机制

## AI 功能集成

### 支持的 AI 提供商
1. **OpenAI**：GPT-4o, GPT-4o-mini 等
2. **Anthropic**：Claude 3.5 Sonnet 等
3. **DeepSeek**：DeepSeek Chat 等
4. **Ollama**：本地运行的 LLM
5. **自定义**：任何 OpenAI API 兼容的服务

### AI 功能
- **文章摘要**：一键生成文章摘要
- **内容翻译**：支持多语言翻译
- **智能对话**：基于文章内容的问答
- **智能推荐**：基于阅读习惯的订阅推荐

## 国际化

### 支持语言
- **中文（简体）**：zh-CN
- **英语**：en

### 翻译管理
- 使用 i18next 进行国际化
- JSON 格式的翻译文件
- 支持动态语言切换

## 测试与调试

### 调试工具
- **Electron DevTools**：Chrome 开发者工具
- **主进程调试**：使用 VS Code 调试配置
- **数据库调试**：直接查看用户数据目录中的 `livo-data.json`

### 测试脚本
项目包含多个调试脚本：
- `debug-content.cjs`：内容调试
- `debug-duplicates.cjs`：重复内容检测
- `test-db.cjs`：数据库测试
- `test-media.cjs`：媒体处理测试
- `verify-*.cjs`：各种验证脚本

## 构建与部署

### 构建配置
- **多平台支持**：Windows、macOS、Linux
- **自动更新**：支持 Electron 自动更新
- **代码签名**：支持应用代码签名

### 发布流程
1. 版本号更新
2. 构建所有平台应用
3. 代码签名（如配置）
4. 上传到发布服务器
5. 更新自动更新服务器

## 贡献指南

### 开发环境设置
1. 克隆仓库
2. 安装 Node.js 18+ 和 pnpm 8+
3. 运行 `pnpm install`
4. 运行 `pnpm dev` 启动开发服务器

### 代码提交规范
- 使用 Conventional Commits 规范
- 提交前运行类型检查
- 确保代码通过 ESLint 检查

### 功能开发流程
1. 创建功能分支
2. 实现功能并添加测试
3. 提交 Pull Request
4. 代码审查和合并

---

## Skill 开发指南

### 什么是 Skills

Skills 是模块化、可自包含的功能包，用于通过提供**专用知识、工作流和工具**来扩展 Claude 的能力。

#### Skills 能提供什么

1. **专用工作流** —— 针对特定领域的多步骤流程
2. **工具集成** —— 与特定文件格式或 API 协作的操作说明
3. **领域知识** —— 公司内部知识、数据模式（schema）、业务逻辑
4. **打包资源** —— 用于复杂和重复任务的脚本、参考资料和资产文件

### 核心原则

#### 简洁至上

上下文窗口是一种公共资源。**默认假设：Claude 已经非常聪明。** 只添加 Claude 原本不具备的信息。

优先使用**简洁示例**，而不是冗长解释。

#### 设置合适的自由度

根据任务的**脆弱性和可变性**来匹配指令的具体程度：

| 自由度 | 适用场景 | 形式 |
|--------|----------|------|
| **高** | 存在多种可行方案、决策依赖上下文 | 文本说明 |
| **中** | 存在推荐模式、允许一定变化 | 伪代码或带参数的脚本 |
| **低** | 操作流程脆弱、必须严格遵循特定步骤 | 具体脚本，参数很少 |

### Skill 的结构

```
skill-name/
├── SKILL.md (必需)
│   ├── YAML frontmatter 元数据 (必需)
│   │   ├── name: (必需)
│   │   └── description: (必需)
│   └── Markdown 指令正文 (必需)
└── 打包资源 (可选)
    ├── scripts/          - 可执行代码（Python / Bash 等）
    ├── references/       - 按需加载进上下文的文档
    └── assets/           - 输出中使用的文件（模板、图标、字体等）
```

#### SKILL.md（必需）

- **Frontmatter（YAML）**：包含 `name` 和 `description` 字段。Claude 仅通过这两个字段来判断是否触发 Skill。
- **正文（Markdown）**：在 Skill 被触发后加载的操作说明。

#### 打包资源（可选）

| 目录 | 用途 | 示例 |
|------|------|------|
| `scripts/` | 可执行代码，用于确定性可靠性或重复任务 | `scripts/rotate_pdf.py` |
| `references/` | 供 Claude 按需加载的参考文档 | `references/api_docs.md` |
| `assets/` | 直接用于输出结果的文件 | `assets/logo.png`、`assets/template.pptx` |

**不应包含的内容**：README.md、INSTALLATION_GUIDE.md、QUICK_REFERENCE.md、CHANGELOG.md —— Skill 面向的是 AI 智能体的执行，而不是人类阅读的文档。

### 渐进式披露设计原则

Skills 使用三层加载机制来高效管理上下文：

1. **元数据（name + description）** —— 始终在上下文中（约 100 词）
2. **SKILL.md 正文** —— Skill 触发后加载（<5k 词）
3. **打包资源** —— 按需加载（脚本可直接执行，不占用上下文）

#### 常见模式

**模式 1：高层指南 + 引用文档**
```markdown
## Advanced features
- **Form filling**: See FORMS.md
- **API reference**: See REFERENCE.md
- **Examples**: See EXAMPLES.md
```

**模式 2：按领域组织**
```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md
    ├── sales.md
    └── marketing.md
```

### Skill 创建流程

#### Step 1：用具体示例理解 Skill

除非 Skill 的使用方式已经非常明确，否则不应跳过此步骤。

#### Step 2：规划可复用内容

分析每个示例，确定哪些脚本、参考文档或资产值得沉淀到 Skill 中。

#### Step 3：初始化 Skill

使用初始化脚本创建 Skill 目录结构：

```bash
# 用法
python .claude/skills/skill-creator/scripts/init_skill.py <skill-name> --path <output-directory>

# 示例
python .claude/skills/skill-creator/scripts/init_skill.py my-new-skill --path .claude/skills
python .claude/skills/skill-creator/scripts/init_skill.py data-analyzer --path .claude/skills
```

初始化脚本会创建：
- `skill-name/` 目录
- `SKILL.md`（包含 TODO 模板）
- `scripts/example.py`（示例脚本）
- `references/api_reference.md`（示例参考文档）
- `assets/example_asset.txt`（示例资产文件）

#### Step 4：编辑 Skill

1. 编辑 `SKILL.md`，完成所有 TODO 项
2. 更新 `description` 字段，清楚描述 Skill 的功能和使用场景
3.  customize 或删除 `scripts/`、`references/`、`assets/` 中的示例文件
4. 编写具体的工作流和示例代码

**写作规范**：
- 始终使用祈使句或不定式
- Frontmatter 只包含 `name` 和 `description`
- Skill 的触发条件只写在 `description` 中

#### Step 5：打包 Skill

```bash
# 用法
python .claude/skills/skill-creator/scripts/package_skill.py <path/to/skill-folder>

# 示例
python .claude/skills/skill-creator/scripts/package_skill.py .claude/skills/my-new-skill
```

#### Step 6：迭代

1. 在真实任务中使用 Skill
2. 发现卡点或低效之处
3. 更新 `SKILL.md` 或打包资源
4. 重新测试

### 输出模式

#### 模板模式

对于需要一致输出的任务，提供明确的模板结构：

```markdown
## Report structure

ALWAYS use this exact template structure:

# [Analysis Title]

## Executive summary
[One-paragraph overview]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```

#### 示例模式

通过输入/输出示例帮助 Claude 理解期望的风格：

```markdown
## Commit message format

Generate commit messages following these examples:

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```
```

### 工作流模式

#### 顺序工作流

对于复杂任务，将操作分解为清晰的步骤：

```markdown
Filling a PDF form involves these steps:

1. Analyze the form (run analyze_form.py)
2. Create field mapping (edit fields.json)
3. Validate mapping (run validate_fields.py)
4. Fill the form (run fill_form.py)
5. Verify output (run verify_output.py)
```

#### 条件工作流

对于有分支逻辑的任务，引导 Claude 通过决策点：

```markdown
1. Determine the modification type:
   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow: [steps]
3. Editing workflow: [steps]
```

## 故障排除

### 常见问题
1. **数据库读写失败**：检查用户数据目录和 `livo-data.json` 文件权限
2. **AI 功能不可用**：检查 API Key 配置
3. **构建失败**：检查 Node.js 和 pnpm 版本
4. **样式问题**：清理 TailwindCSS 缓存

### 调试技巧
- 使用 `console.log` 进行基础调试
- 利用 Chrome DevTools 进行网络和性能分析
- 检查主进程日志获取详细错误信息

## 许可证

MIT 许可证 - 详见 LICENSE 文件

---

*本文档最后更新：2026年2月15日*
