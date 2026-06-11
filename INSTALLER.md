# Livo NSIS 安装包制作指南

本项目使用 NSIS（Nullsoft Scriptable Install System）技术创建 Windows 安装包，提供类似参考图的现代化安装界面。

## 功能特性

✅ 自定义安装界面（品牌 Logo + 安装按钮）  
✅ 用户协议和隐私条款确认（带超链接）  
✅ 自定义安装路径  
✅ 可选项：

- 创建桌面快捷方式
- 创建开始菜单快捷方式
- 添加到开机自启动

## 快速开始

### 1. 准备资源文件

安装包需要以下资源文件（放在 `resources/` 目录）：

| 文件名                 | 尺寸    | 格式 | 用途           |
| ---------------------- | ------- | ---- | -------------- |
| `icon.ico`             | 256x256 | ICO  | 应用程序图标   |
| `installerSidebar.bmp` | 164x314 | BMP  | 安装界面左侧栏 |
| `installerHeader.bmp`  | 150x57  | BMP  | 安装界面顶部   |

#### 自动生成资源（推荐）

如果已安装 [ImageMagick](https://imagemagick.org/)：

```bash
cd Livo
node scripts/generate-installer-assets.mjs
```

该脚本会自动从 `resources/yuanjiao-Livo.png` 生成所需的资源文件。

#### 手动准备资源

1. 准备 256x256 的 PNG logo
2. 使用在线工具转换：
   - [PNG to ICO](https://convertio.co/zh/png-ico/)
   - [PNG to BMP](https://convertio.co/zh/png-bmp/)
3. 调整 BMP 尺寸到指定大小
4. 将文件放入 `resources/` 目录

### 2. 构建安装包

```bash
cd Livo
pnpm install
pnpm run build:win
```

构建完成后，安装包位于 `dist/` 目录：

- `Livo-{version}-win-x64.exe` - 64位安装程序

## 安装界面预览

安装程序包含以下页面：

1. **欢迎页面** - 显示 Logo 和产品名称
2. **自定义选项页** - 选择安装路径和功能选项
3. **安装进度页** - 显示安装进度
4. **完成页面** - 选择是否立即启动

## 自定义配置

### 修改用户协议和隐私条款链接

编辑 `build/installer.nsh`，找到以下函数并修改 URL：

```nsh
Function OnUserAgreementClick
  Pop $0
  ExecShell "open" "https://livo.app/terms"  # 修改这里
FunctionEnd

Function OnPrivacyPolicyClick
  Pop $0
  ExecShell "open" "https://livo.app/privacy"  # 修改这里
FunctionEnd
```

### 修改默认安装路径

编辑 `config/electron-builder.config.mjs`：

```js
nsis: {
  // ... 其他配置
  perMachine: false,  // true = C:\Program Files, false = C:\Users\{user}\AppData\Local
}
```

### 修改界面文案

编辑 `build/zh_CN.nsh` 修改中文文案：

```nsh
LangString createDesktop ${LANG_SIMPCHINESE} "创建桌面快捷方式"
LangString addToStartup ${LANG_SIMPCHINESE} "添加到开机自启动"
```

### 调整默认选项

编辑 `build/installer.nsh` 中的 `customInit` 宏：

```nsh
!macro customInit
  StrCpy $CreateDesktopShortcut "1"      # 1=默认勾选, 0=默认不勾选
  StrCpy $CreateStartMenuShortcut "1"
  StrCpy $AddToStartup "0"
  StrCpy $AgreeTerms "0"
!macroend
```

## 构建配置

关键配置位于 `config/electron-builder.config.mjs`：

```js
nsis: {
  oneClick: false,                        // 关闭一键安装
  allowToChangeInstallationDirectory: true, // 允许自定义路径
  createDesktopShortcut: true,            // 显示桌面快捷方式选项
  createStartMenuShortcut: true,          // 显示开始菜单选项
  runAfterFinish: true,                   // 安装后立即运行
  include: 'build/installer.nsh',         // 自定义 NSIS 脚本
}
```

## 文件结构

```
Livo/
├── build/
│   ├── installer.nsh         # 主安装脚本（自定义页面逻辑）
│   ├── zh_CN.nsh            # 中文语言文件
│   └── README.md            # 资源文件说明
├── config/
│   └── electron-builder.config.mjs  # Electron Builder 配置
├── resources/
│   ├── icon.ico             # 应用图标
│   ├── installerSidebar.bmp # 侧边栏图片
│   └── installerHeader.bmp  # 顶部图片
└── scripts/
    └── generate-installer-assets.mjs  # 资源生成脚本
```

## 测试安装包

1. 构建安装包：`pnpm run build:win`
2. 双击运行 `dist/Livo-{version}-win-x64.exe`
3. 测试以下功能：
   - ✅ Logo 和界面显示正常
   - ✅ 用户协议链接可点击
   - ✅ 可以更改安装路径
   - ✅ 各选项正常工作
   - ✅ 安装完成后快捷方式创建正确
   - ✅ 卸载程序能正常清理

## 常见问题

### Q: 构建时提示找不到资源文件？

A: 确保 `resources/` 目录下有所需的三个文件（icon.ico, installerSidebar.bmp, installerHeader.bmp）

### Q: 安装界面显示不正常？

A: 检查 BMP 文件尺寸是否正确（164x314 和 150x57），必须是 24位色 BMP 格式

### Q: 如何修改安装包的应用名称？

A: 修改 `config/electron-builder.config.mjs` 中的 `productName` 字段

### Q: 如何支持英文安装界面？

A: 创建 `build/en_US.nsh` 文件，添加英文语言字符串

## 进阶功能

如需更多自定义功能，可参考：

- [NSIS 官方文档](https://nsis.sourceforge.io/Docs/)
- [Electron Builder NSIS 配置](https://www.electron.build/configuration/nsis)
- [MUI2 现代界面文档](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html)

## 许可证

本安装配置基于 AGPL-3.0 许可证，与 Livo 项目保持一致。
