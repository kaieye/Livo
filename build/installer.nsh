!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; 自定义安装器外观
!define MUI_CUSTOMFUNCTION_GUIINIT myGUIInit

; 变量
Var Dialog
Var LogoImage
Var ProductNameLabel
Var InstallButton
Var AgreeCheckbox
Var AgreeLabel
Var TermsLink
Var PrivacyLink
Var AdvancedLink
Var PathLabel
Var PathText
Var BrowseButton
Var DesktopCheckbox
Var StartMenuCheckbox
Var StartupCheckbox
Var CreateDesktopShortcut
Var CreateStartMenuShortcut
Var AddToStartup
Var AgreeTerms
Var ShowAdvanced

; 初始化变量
!macro customInit
  StrCpy $CreateDesktopShortcut "1"
  StrCpy $CreateStartMenuShortcut "1"
  StrCpy $AddToStartup "1"
  StrCpy $AgreeTerms "0"
  StrCpy $ShowAdvanced "0"
!macroend

; 隐藏 MUI 默认页面
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipMUIPage

Function SkipMUIPage
  Abort
FunctionEnd

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; 自定义 GUI 初始化
Function myGUIInit
  ; 隐藏默认控件
  GetDlgItem $0 $HWNDPARENT 1
  ShowWindow $0 ${SW_HIDE}

  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 ${SW_HIDE}

  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}

  ; 设置窗口大小和背景色
  System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i 0, i 0, i 600, i 480, i 0x0002)'

  ; 创建自定义页面
  Call CreateCustomPage
FunctionEnd

Function CreateCustomPage
  ${If} $ShowAdvanced == "1"
    Call CreateAdvancedPage
    Return
  ${EndIf}

  nsDialogs::Create 1018
  Pop $Dialog

  ; 背景设为白色
  SetCtlColors $Dialog 0xFFFFFF 0xFFFFFF

  ; Logo 图标 (居中, 距顶部 80px)
  ${NSD_CreateBitmap} 268 80 64 64 ""
  Pop $LogoImage
  ${NSD_SetImage} $LogoImage "$INSTDIR\Livo.exe" $0

  ; 产品名称 (居中, Logo 下方 20px)
  ${NSD_CreateLabel} 200 160 200 40 "Livo"
  Pop $ProductNameLabel
  CreateFont $1 "Microsoft YaHei UI" 28 700
  SendMessage $ProductNameLabel ${WM_SETFONT} $1 0
  SetCtlColors $ProductNameLabel 0x000000 0xFFFFFF
  ${NSD_AddStyle} $ProductNameLabel ${SS_CENTER}

  ; 立即安装按钮 (居中, 圆角黑色按钮)
  ${NSD_CreateButton} 200 220 200 44 "立即安装"
  Pop $InstallButton
  CreateFont $2 "Microsoft YaHei UI" 14 400
  SendMessage $InstallButton ${WM_SETFONT} $2 0
  SetCtlColors $InstallButton 0xFFFFFF 0x000000
  ${NSD_OnClick} $InstallButton OnInstallClick

  ; 协议复选框 (左对齐, 底部上方 100px)
  ${NSD_CreateCheckbox} 40 340 20 20 ""
  Pop $AgreeCheckbox
  ${NSD_OnClick} $AgreeCheckbox OnAgreeClick

  ; "阅读并同意" 文本
  ${NSD_CreateLabel} 65 342 80 16 "阅读并同意"
  Pop $AgreeLabel
  SetCtlColors $AgreeLabel 0x666666 0xFFFFFF

  ; 用户协议链接
  ${NSD_CreateLink} 145 342 60 16 "用户协议"
  Pop $TermsLink
  SetCtlColors $TermsLink 0x0066CC 0xFFFFFF
  ${NSD_OnClick} $TermsLink OnTermsClick

  ; 隐私条款链接
  ${NSD_CreateLink} 215 342 60 16 "隐私条款"
  Pop $PrivacyLink
  SetCtlColors $PrivacyLink 0x0066CC 0xFFFFFF
  ${NSD_OnClick} $PrivacyLink OnPrivacyClick

  ; 自定义安装链接 (右下角)
  ${NSD_CreateLink} 480 342 100 16 "自定义安装 >"
  Pop $AdvancedLink
  SetCtlColors $AdvancedLink 0x0066CC 0xFFFFFF
  ${NSD_OnClick} $AdvancedLink OnAdvancedClick

  nsDialogs::Show
FunctionEnd

Function CreateAdvancedPage
  nsDialogs::Create 1018
  Pop $Dialog
  SetCtlColors $Dialog 0xFFFFFF 0xFFFFFF

  ; 标题
  ${NSD_CreateLabel} 40 40 200 30 "自定义安装"
  Pop $0
  CreateFont $1 "Microsoft YaHei UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 0
  SetCtlColors $0 0x000000 0xFFFFFF

  ; 安装路径标签
  ${NSD_CreateLabel} 40 90 80 20 "安装路径"
  Pop $PathLabel
  SetCtlColors $PathLabel 0x333333 0xFFFFFF

  ; 安装路径输入框
  ${NSD_CreateText} 40 115 400 24 "$INSTDIR"
  Pop $PathText

  ; 浏览按钮
  ${NSD_CreateButton} 450 115 100 24 "浏览..."
  Pop $BrowseButton
  ${NSD_OnClick} $BrowseButton OnBrowseClick

  ; 复选框选项
  ${NSD_CreateCheckbox} 40 160 200 20 "添加到快捷启动栏"
  Pop $StartMenuCheckbox
  ${NSD_SetState} $StartMenuCheckbox ${BST_CHECKED}
  SetCtlColors $StartMenuCheckbox 0x333333 0xFFFFFF

  ${NSD_CreateCheckbox} 40 190 200 20 "添加到桌面快捷方式"
  Pop $DesktopCheckbox
  ${NSD_SetState} $DesktopCheckbox ${BST_CHECKED}
  SetCtlColors $DesktopCheckbox 0x333333 0xFFFFFF

  ${NSD_CreateCheckbox} 40 220 200 20 "开机自启动"
  Pop $StartupCheckbox
  ${NSD_SetState} $StartupCheckbox ${BST_CHECKED}
  SetCtlColors $StartupCheckbox 0x333333 0xFFFFFF

  ; 立即安装按钮
  ${NSD_CreateButton} 200 280 200 44 "立即安装"
  Pop $InstallButton
  CreateFont $2 "Microsoft YaHei UI" 14 400
  SendMessage $InstallButton ${WM_SETFONT} $2 0
  SetCtlColors $InstallButton 0xFFFFFF 0x000000
  ${NSD_OnClick} $InstallButton OnConfirmInstall

  ; 协议复选框
  ${NSD_CreateCheckbox} 40 360 20 20 ""
  Pop $AgreeCheckbox
  ${NSD_OnClick} $AgreeCheckbox OnAgreeClick

  ${NSD_CreateLabel} 65 362 80 16 "阅读并同意"
  Pop $0
  SetCtlColors $0 0x666666 0xFFFFFF

  ${NSD_CreateLink} 145 362 60 16 "用户协议"
  Pop $TermsLink
  SetCtlColors $TermsLink 0x0066CC 0xFFFFFF
  ${NSD_OnClick} $TermsLink OnTermsClick

  ${NSD_CreateLink} 215 362 60 16 "隐私条款"
  Pop $PrivacyLink
  SetCtlColors $PrivacyLink 0x0066CC 0xFFFFFF
  ${NSD_OnClick} $PrivacyLink OnPrivacyClick

  nsDialogs::Show
FunctionEnd

; 事件处理函数
Function OnInstallClick
  ${NSD_GetState} $AgreeCheckbox $AgreeTerms
  ${If} $AgreeTerms == ${BST_UNCHECKED}
    MessageBox MB_OK|MB_ICONEXCLAMATION "请阅读并同意用户协议和隐私条款"
    Return
  ${EndIf}

  ; 开始安装
  Call DoInstall
FunctionEnd

Function OnAgreeClick
  Pop $0
FunctionEnd

Function OnTermsClick
  ExecShell "open" "https://livo.app/terms"
FunctionEnd

Function OnPrivacyClick
  ExecShell "open" "https://livo.app/privacy"
FunctionEnd

Function OnAdvancedClick
  StrCpy $ShowAdvanced "1"
  Call CreateAdvancedPage
FunctionEnd

Function OnBrowseClick
  nsDialogs::SelectFolderDialog "选择安装目录" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    StrCpy $INSTDIR $0
    ${NSD_SetText} $PathText $INSTDIR
  ${EndIf}
FunctionEnd

Function OnConfirmInstall
  ${NSD_GetState} $AgreeCheckbox $AgreeTerms
  ${If} $AgreeTerms == ${BST_UNCHECKED}
    MessageBox MB_OK|MB_ICONEXCLAMATION "请阅读并同意用户协议和隐私条款"
    Return
  ${EndIf}

  ${NSD_GetState} $DesktopCheckbox $CreateDesktopShortcut
  ${NSD_GetState} $StartMenuCheckbox $CreateStartMenuShortcut
  ${NSD_GetState} $StartupCheckbox $AddToStartup
  ${NSD_GetText} $PathText $INSTDIR

  Call DoInstall
FunctionEnd

Function DoInstall
  ; 隐藏自定义页面，显示安装进度
  ; 这里应该触发实际的安装流程

  SetOutPath $INSTDIR

  ; 创建快捷方式
  ${If} $CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
  ${EndIf}

  ${If} $CreateStartMenuShortcut == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
  ${EndIf}

  ${If} $AddToStartup == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe"
  ${EndIf}
FunctionEnd

!macro customInstall
  ; 这个宏会在实际安装文件时调用
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
!macroend
