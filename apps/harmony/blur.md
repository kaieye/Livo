# hds_button

`hds_button` 是一个基于 HarmonyOS `HdsTabs` 的浮动迷你栏按钮组件。
组件通过 `barFloatingStyle` 提供沉浸光感材质效果，并支持参数化和内容槽位自定义。

## 功能特性

- 基于 `HdsTabs` + `barFloatingStyle` 实现浮动按钮
- 支持沉浸材质：`materialType` / `materialLevel`
- 支持 15 项参数配置（尺寸、图标、布局、事件、样式）
- 支持 `@BuilderParam` 尾随闭包自定义按钮内容
- 同时导出兼容别名 `hdsButton`（deprecated）

## 安装

面向已发布包使用：

```cmake
ohpm install hds_button
```

## 导入

```clean
import { HdsMiniBarButton } from 'hds_button'
```

## 快速开始（代码 + 演示）

### 1) 基础用法

默认样式，适合先验证组件是否正常接入。

```arcade
HdsMiniBarButton({
  onButtonClick: () => {
    console.info('按钮被点击')
  }
})
```

**演示效果**

![加载失败](https://chos1nz.oss-cn-hangzhou.aliyuncs.com/20260406191019728.gif)

### 2) 自定义图标（图片）

替换默认图标资源，快速定制按钮语义。

```arcade
HdsMiniBarButton({
  iconResource: $r('sys.symbol.play_fill'),
  iconColor: [Color.White],
  onButtonClick: () => {
    console.info('点击了播放按钮')
  }
})
```

**演示效果**

![加载失败](https://chos1nz.oss-cn-hangzhou.aliyuncs.com/20260406191019787.gif)

### 3) 自定义尺寸

调整按钮宽高和内容留白，适配不同视觉密度。

```dts
HdsMiniBarButton({
  barWidth: 60,
  barHeight: 60,
  contentPadding: 10, // containerSize 未设置时自动计算
})
```

**演示效果**

![加载失败](https://chos1nz.oss-cn-hangzhou.aliyuncs.com/20260406191020097.gif)

### 4) 自定义内容（@BuilderParam）

使用尾随闭包替换默认图标，可展示文本或任意自定义内容。

```roboconf
HdsMiniBarButton({
  onButtonClick: () => {}
}) {
  Text('GO')
    .fontSize(18)
    .fontColor(Color.White)
    .fontWeight(FontWeight.Bold)
}
```

**演示效果**

![加载失败](https://chos1nz.oss-cn-hangzhou.aliyuncs.com/20260406191019692.gif)

### 5) 自定义材质

用于精细调节浮动栏的材质观感和底部间距。

```php
import { hdsMaterial } from '@kit.UIDesignKit'

HdsMiniBarButton({
  materialType: hdsMaterial.MaterialType.TRANSLUCENT,
  materialLevel: hdsMaterial.MaterialLevel.LIGHT,
  maskColor: '#20FFFFFF',
  barBottomMargin: 12
})
```

> 说明：当前未单独录制“自定义材质”动图，可在示例工程中直接运行查看效果。

## API

### 组件参数

| 参数              | 类型                        | 默认值                  | 说明                         |
| ----------------- | --------------------------- | ----------------------- | ---------------------------- | -------------------------- |
| `barWidth`        | `number`                    | `50`                    | 按钮栏宽度                   |
| `barHeight`       | `number`                    | `50`                    | 按钮栏高度                   |
| `contentPadding`  | `number`                    | `8`                     | 容器内边距（防止光效被裁切） |
| `containerSize`   | `SizeOptions                | undefined`              | `undefined`                  | 容器尺寸，未设置时自动计算 |
| `iconResource`    | `Resource`                  | `$r('sys.symbol.plus')` | 图标资源                     |
| `iconSize`        | `number`                    | `27`                    | 图标尺寸                     |
| `iconColor`       | `ResourceColor[]`           | `[Color.Gray]`          | 图标颜色数组                 |
| `maskColor`       | `ResourceColor`             | `Color.Transparent`     | 渐变遮罩颜色                 |
| `barBottomMargin` | `number`                    | `8`                     | 按钮栏底部边距               |
| `materialType`    | `hdsMaterial.MaterialType`  | `IMMERSIVE`             | 材质类型                     |
| `materialLevel`   | `hdsMaterial.MaterialLevel` | `ADAPTIVE`              | 材质等级                     |
| `barPosition`     | `BarPosition`               | `BarPosition.End`       | 栏位置                       |
| `barOverlap`      | `boolean`                   | `true`                  | 是否与内容重叠               |
| `onButtonClick`   | `(() => void)               | undefined`              | `undefined`                  | 按钮点击回调               |
| `buttonContent`   | `@BuilderParam`             | 默认图标构建            | 自定义按钮内容               |

### 导出说明

- `HdsMiniBarButton`：推荐使用的主组件
- `hdsButton`：兼容历史版本的别名组件（deprecated）

## 示例项目

可参考示例页面：

- `entry/src/main/ets/pages/Index.ets`

## 系统要求

- HarmonyOS SDK：`6.1.0(23)` 及以上
- DevEco Studio：`5.0` 及以上

## 许可证

Apache-2.0
