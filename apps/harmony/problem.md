一、实现原理
HdsTabs 组件提供了 miniBar 属性，支持通过 miniBarBuilder 自定义 MiniBar 的内容。您可以在 MiniBar 中内置音频进度条，实现两种形态的展示：

形态 说明 进度条实现方式
横条态（EXPAND） 展开的横向条状 使用 Slider 组件
收缩态（COLLAPSE） 收缩的圆球状 使用 Progress 环形进度条
二、核心实现代码

import { hdsMaterial } from '@kit.ArkUI';

@Entry
@Component
struct MusicPlayerWithHdsTabs {
@State currentTab: number = 0;
@State miniBarStyle: HdsBarStyle = HdsBarStyle.EXPAND;
@State currentTime: number = 0; // 当前播放时间（毫秒）
@State duration: number = 180000; // 总时长（毫秒）
@State isPlaying: boolean = false;

private tabsController: TabsController = new TabsController();

build() {
Column() {
HdsTabs({
index: this.currentTab,
controller: this.tabsController
}) {
// TabContent 内容...
TabContent() {
Text('音乐列表')
}.tabBar('列表')

        TabContent() {
          Text('我的')
        }.tabBar('我的')
      }
      .layoutWeight(1)
      .barOverlap(true)
      .barPosition(BarPosition.End)
      .barFloatingStyle({
        barBottomMargin: 28,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: 1
        },
        miniBar: {
          miniBarBuilder: (): void => {
            this.buildMiniBarWithProgress()
          },
          enableMiniBarBackground: true,
          enableMiniBarClip: true,
          onBarStyleChange: (miniBarStyle, tabBarStyle, miniBarWidth, tabBarWidth, mode) => {
            this.miniBarStyle = miniBarStyle;
          }
        }
      })
    }
    .width('100%')
    .height('100%')

}

// 核心：MiniBar 内置进度条
@Builder
buildMiniBarWithProgress() {
if (this.miniBarStyle === HdsBarStyle.EXPAND) {
// 横条态：显示 Slider 进度条
Row({ space: 10 }) {
// 专辑封面
Image($r('app.media.album_cover'))
.width(36)
.height(36)
.borderRadius(6)
.objectFit(ImageFit.Cover)

        // 歌曲信息
        Column({ space: 4 }) {
          Text('歌曲名称')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('歌手')
            .fontSize(11)
            .fontColor($r('sys.color.font_secondary'))
            .maxLines(1)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        // 播放控制按钮
        Row({ space: 14 }) {
          // 播放/暂停
          SymbolGlyph(this.isPlaying ? $r('sys.symbol.pause_fill') : $r('sys.symbol.play_fill'))
            .fontSize(24)
            .fontColor([$r('sys.color.font_primary')])
            .onClick(() => {
              this.togglePlay();
            })

          // 下一首
          SymbolGlyph($r('sys.symbol.forward_end_fill'))
            .fontSize(20)
            .fontColor([$r('sys.color.font_primary')])
            .onClick(() => {
              this.playNext();
            })
        }
      }
      .width('100%')
      .height(48)
      .padding({ left: 16, right: 16 })
      .borderRadius(24)

    } else {
      // 收缩态：显示环形进度条
      Stack() {
        // 专辑封面作为背景
        Image($r('app.media.album_cover'))
          .width('100%')
          .height('100%')
          .borderRadius('50%')
          .objectFit(ImageFit.Cover)

        // 环形进度条（关键：内置进度显示）
        Progress({
          value: this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0,
          total: 100,
          type: ProgressType.Ring
        })
          .width('100%')
          .height('100%')
          .color($r('sys.color.brand'))
          .backgroundColor($r('sys.color.comp_background_secondary'))
          .style({
            strokeWidth: 2,
            enableSmoothEffect: false  // 禁用平滑效果，实时反映进度
          })
          .hitTestBehavior(HitTestMode.None)  // 不拦截点击事件

        // 播放图标（居中）
        if (!this.isPlaying) {
          SymbolGlyph($r('sys.symbol.play_fill'))
            .fontSize(20)
            .fontColor([Color.White])
        }
      }
      .width('100%')
      .height('100%')
      .onClick(() => {
        // 点击圆球：展开并自动播放
        this.tabsController.applyMiniBarStyle(HdsBarStyle.EXPAND);
        if (!this.isPlaying) {
          this.togglePlay();
        }
      })
    }

}

// 播放控制方法
private togglePlay() {
this.isPlaying = !this.isPlaying;
if (this.isPlaying) {
// 启动进度更新定时器
this.startProgressTimer();
} else {
// 停止进度更新
this.stopProgressTimer();
}
}

private playNext() {
// 下一首逻辑
this.currentTime = 0;
this.isPlaying = true;
}

private startProgressTimer() {
// 使用 setInterval 更新进度
setInterval(() => {
if (this.currentTime < this.duration) {
this.currentTime += 1000; // 每秒更新
} else {
this.currentTime = 0;
this.playNext();
}
}, 1000);
}

private stopProgressTimer() {
// 停止定时器
}
}
三、关键配置说明

1. 环形进度条样式配置

Progress({
value: progress, // 当前进度百分比 (0-100)
total: 100,
type: ProgressType.Ring // 环形类型
})
.style({
strokeWidth: 2, // 环形宽度
enableSmoothEffect: false // ⚠️ 关键：禁用平滑动画，确保进度实时更新
}) 2. MiniBar 样式切换

// 通过控制器切换形态
this.tabsController.applyMiniBarStyle(HdsBarStyle.EXPAND); // 展开横条
this.tabsController.applyMiniBarStyle(HdsBarStyle.COLLAPSE); // 收缩圆球 3. 监听形态变化

onBarStyleChange: (miniBarStyle, tabBarStyle, miniBarWidth, tabBarWidth, mode) => {
this.miniBarStyle = miniBarStyle; // 保存当前形态，用于条件渲染
}
四、与 AVPlayer 集成
如果需要与实际播放器集成，监听播放进度：

// 监听 AVPlayer 的进度更新
avPlayer.on('timeUpdate', (time: number) => {
this.currentTime = time;
});

// 监听总时长
avPlayer.on('durationUpdate', (duration: number) => {
this.duration = duration;
});
五、注意事项
禁用平滑效果：环形进度条必须设置 enableSmoothEffect: false，否则进度显示会有延迟

事件穿透：环形进度条需要设置 .hitTestBehavior(HitTestMode.None)，避免拦截点击事件

动态背景控制：当全屏播放器打开时，建议关闭 MiniBar 背景：

enableMiniBarBackground: this.playerProgress <= 0
通过以上方案，您可以在 HdsTabs 的 MiniBar 中完美实现音频进度条功能，支持横条和圆球两种形态的进度展示。
