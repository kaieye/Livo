# HarmonyOS 虚拟机运行指南

## 快速开始

### 方式一：使用 DevEco Studio（推荐）

#### 1. 打开项目
- 启动 DevEco Studio
- 选择 `File` → `Open`
- 选择项目目录：`E:\Livo\apps\harmony`

#### 2. 等待项目同步
- DevEco Studio 会自动下载依赖并同步项目
- 等待底部状态栏显示 "Sync Completed"

#### 3. 创建/启动虚拟机

##### 如果还没有虚拟机：
1. 按 `Ctrl + Alt + 8` 打开 Device Manager
2. 点击 `Create Virtual Device`
3. 选择设备类型：**Phone**
4. 选择合适的设备型号（推荐：Huawei P60 Pro）
5. 下载并选择 **HarmonyOS NEXT** 系统镜像
6. 完成创建

##### 如果已有虚拟机：
1. 按 `Ctrl + Alt + 8` 打开 Device Manager
2. 点击虚拟机的 ▶️ 按钮启动它
3. 等待虚拟机完全启动

#### 4. 运行应用
- 点击工具栏的 Run 按钮（绿色三角形）
- 或按快捷键 `Shift + F10`
- 选择你的虚拟机作为目标设备
- 等待应用构建并部署到虚拟机

---

### 方式二：使用命令行（高级）

#### 前提条件
确保已配置以下环境变量：
- `OHOS_SDK_HOME` - 指向 HarmonyOS SDK 路径
- `hdc.exe` - 在系统 PATH 中

#### 步骤

```powershell
# 1. 准备项目
cd E:\Livo\apps\harmony
.\run.ps1

# 2. 检查连接的设备
hdc list targets

# 3. 构建项目（在 DevEco Studio 中完成）
# 构建产物位于：entry/build/outputs/default/

# 4. 安装应用到虚拟机
hdc install entry/build/outputs/default/entry-default-signed.hap

# 5. 启动应用
hdc shell aa start -a EntryAbility -b com.livo.harmony
```

---

## 自动化脚本

### run.ps1 - 项目准备脚本
```powershell
.\run.ps1
```
功能：
- ✅ 检查项目配置文件
- ✅ 清理旧的构建缓存
- ✅ 安装项目依赖
- ✅ 显示运行指引

### open-studio.ps1 - 打开 DevEco Studio
```powershell
.\open-studio.ps1
```
功能：
- 🔍 自动查找 DevEco Studio 安装
- 📂 打开项目文件夹
- 📋 显示下一步操作指引

### build.js - Node.js 构建辅助脚本
```powershell
node build.js
```
功能：
- 📋 检查项目配置
- 🧹 清理构建缓存
- 📦 安装依赖
- 💡 提供详细指引

---

## 常见问题解决

### ❌ Error: The target can not be empty

**解决方案：**
1. 运行清理脚本：`.\run.ps1`
2. 在 DevEco Studio 中重新同步项目
3. 确保 `build-profile.json5` 中的 targets 配置正确

### ❌ 找不到 hdc 命令

**解决方案：**
1. 找到 hdc.exe 位置（通常在 SDK 的 toolchains 目录）
2. 添加到系统 PATH 环境变量
3. 或在 DevEco Studio 中使用 IDE 内置终端

### ❌ 虚拟机无法启动

**解决方案：**
1. 确保启用了 Windows 的虚拟化功能（Hyper-V）
2. 在 BIOS 中启用 VT-x/AMD-V
3. 重启虚拟机或重新创建设备

### ❌ 应用无法安装到虚拟机

**解决方案：**
1. 确保虚拟机已完全启动
2. 在 Device Manager 中重启虚拟机
3. 重新构建签名后的 HAP 包

---

## 项目结构

```
harmony/
├── AppScope/                 # 应用全局配置
│   ├── app.json5            # 应用配置文件
│   └── resources/           # 全局资源文件
├── entry/                   # 主模块
│   ├── src/main/
│   │   ├── ets/            # ArkTS 源代码
│   │   │   ├── pages/      # 页面组件
│   │   │   ├── common/     # 公共代码
│   │   │   └── entryability/ # 入口能力
│   │   ├── resources/      # 模块资源
│   │   └── module.json5    # 模块配置
│   ├── build-profile.json5 # 构建配置
│   └── oh-package.json5    # 依赖配置
├── build-profile.json5      # 项目构建配置
├── hvigorfile.ts           # Hvigor 构建脚本
└── oh-package.json5        # 项目依赖配置
```

---

## 构建配置说明

### build-profile.json5

```json5
{
  "app": {
    "products": [
      {
        "name": "default",        // 产品名称
        "compatibleSdkVersion": "5.0.0(12)",
        "targetSdkVersion": "5.0.0(12)",
        "runtimeOS": "HarmonyOS"
      }
    ]
  },
  "modules": [
    {
      "name": "entry",
      "targets": [
        {
          "name": "default",
          "applyToProducts": ["default"]  // 必须与 product name 匹配
        }
      ]
    }
  ]
}
```

**关键点：**
- `targets[].name` 必须与 `products[].name` 对应
- `applyToProducts` 数组必须包含有效的产品名称
- 如果配置错误会导致 "target can not be empty" 错误

---

## 开发工作流

1. **修改代码** → 在 DevEco Studio 中编辑 `.ets` 文件
2. **热重载** → DevEco Studio 支持热重载，保存即生效
3. **调试** → 使用 DevEco Studio 的调试功能（F9 设置断点）
4. **测试** → 在虚拟机中测试功能
5. **构建发布** → 使用 Build → Build Hap(s) / APP(s)

---

## 有用的快捷键

| 快捷键 | 功能 |
|--------|------|
| `Shift + F10` | 运行应用 |
| `Shift + F9` | 调试应用 |
| `Ctrl + Alt + 8` | 打开 Device Manager |
| `Ctrl + S` | 保存（触发热重载） |
| `F9` | 切换断点 |
| `Alt + F8` | 查看变量 |

---

## 下一步

项目已经准备就绪！按照上述步骤操作即可在虚拟机中运行应用。

如有问题，请查看：
- DevEco Studio 官方文档：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5
- 本项目脚本：`run.ps1`, `open-studio.ps1`, `build.js`
