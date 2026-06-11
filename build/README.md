# NSIS 安装包资源说明

## 需要准备的资源文件

请将以下文件放置在 `resources/` 目录下：

### 1. icon.ico

- 尺寸：256x256
- 格式：ICO（包含多个尺寸：16x16, 32x32, 48x48, 256x256）
- 用途：应用程序图标和安装程序图标

### 2. installerHeader.bmp

- 尺寸：150x57 像素
- 格式：BMP，24位色
- 用途：安装程序顶部横幅

### 3. installerSidebar.bmp

- 尺寸：164x314 像素
- 格式：BMP，24位色
- 用途：安装程序左侧侧边栏（欢迎和完成页面）

## 图片转换命令

如果你有 PNG 格式的 logo，可以使用以下工具转换：

### PNG 转 ICO

```bash
# 使用 ImageMagick
magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# 或在线工具
https://convertio.co/zh/png-ico/
```

### PNG 转 BMP

```bash
# 使用 ImageMagick
magick convert logo.png -resize 164x314 -background white -flatten installerSidebar.bmp
magick convert logo.png -resize 150x57 -background white -flatten installerHeader.bmp
```

## 快速生成方案

如果暂时没有准备好资源，可以使用现有的 `yuanjiao-Livo.png` 生成临时文件：

```bash
cd Livo
# 需要安装 ImageMagick
magick convert resources/yuanjiao-Livo.png -resize 256x256 -background transparent resources/icon.ico
magick convert resources/yuanjiao-Livo.png -resize 164x314 -gravity center -background "#FFFFFF" -extent 164x314 resources/installerSidebar.bmp
magick convert resources/yuanjiao-Livo.png -resize 150x57 -gravity center -background "#FFFFFF" -extent 150x57 resources/installerHeader.bmp
```
