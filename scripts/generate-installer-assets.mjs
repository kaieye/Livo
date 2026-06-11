#!/usr/bin/env node
/**
 * 生成 NSIS 安装包所需的资源文件
 * 使用现有的 PNG 图标生成 ICO 和 BMP 文件
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')
const resourcesDir = join(projectRoot, 'resources')

console.log('🎨 生成 NSIS 安装包资源文件...\n')

// 检查源图片是否存在
const sourcePng = join(resourcesDir, 'yuanjiao-Livo.png')
if (!existsSync(sourcePng)) {
  console.error('❌ 错误: 找不到源图片 resources/yuanjiao-Livo.png')
  process.exit(1)
}

// 检查是否安装了 ImageMagick
let hasImageMagick = false
try {
  execSync('magick --version', { stdio: 'ignore' })
  hasImageMagick = true
  console.log('✅ 检测到 ImageMagick')
} catch {
  console.log('⚠️  未检测到 ImageMagick')
}

if (hasImageMagick) {
  console.log('\n正在生成资源文件...\n')

  try {
    // 生成 icon.ico (256x256)
    console.log('生成 icon.ico...')
    execSync(
      `magick convert "${sourcePng}" -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 "${join(resourcesDir, 'icon.ico')}"`,
      { stdio: 'inherit' },
    )

    // 生成 installerSidebar.bmp (164x314)
    console.log('生成 installerSidebar.bmp...')
    execSync(
      `magick convert "${sourcePng}" -resize 164x314 -gravity center -background "#FFFFFF" -extent 164x314 "${join(resourcesDir, 'installerSidebar.bmp')}"`,
      { stdio: 'inherit' },
    )

    // 生成 installerHeader.bmp (150x57)
    console.log('生成 installerHeader.bmp...')
    execSync(
      `magick convert "${sourcePng}" -resize 150x57 -gravity center -background "#FFFFFF" -extent 150x57 "${join(resourcesDir, 'installerHeader.bmp')}"`,
      { stdio: 'inherit' },
    )

    console.log('\n✅ 资源文件生成完成！')
    console.log('\n生成的文件：')
    console.log('  ✓ resources/icon.ico')
    console.log('  ✓ resources/installerSidebar.bmp')
    console.log('  ✓ resources/installerHeader.bmp')
  } catch (error) {
    console.error('\n❌ 生成资源文件时出错：', error.message)
    process.exit(1)
  }
} else {
  console.log('\n⚠️  需要安装 ImageMagick 来自动生成资源文件\n')
  console.log('安装方法：')
  console.log('  Windows: https://imagemagick.org/script/download.php#windows')
  console.log('  macOS:   brew install imagemagick')
  console.log('  Linux:   sudo apt-get install imagemagick\n')
  console.log('或者手动准备以下文件：')
  console.log('  - resources/icon.ico (256x256)')
  console.log('  - resources/installerSidebar.bmp (164x314)')
  console.log('  - resources/installerHeader.bmp (150x57)')
  console.log('\n在线转换工具：')
  console.log('  - PNG to ICO: https://convertio.co/zh/png-ico/')
  console.log('  - PNG to BMP: https://convertio.co/zh/png-bmp/')
  process.exit(1)
}
