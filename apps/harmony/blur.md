从6.0.0(20) Beta1版本开始，新增支持过渡模糊与渐变模糊样式。

当应用开发者需要使用标题栏样式随内容区滚动而动态改变样式的导航组件时，可以通过设置titleBar属性中的style配置，自定义滚动前后的标题栏样式。

通用模糊样式
对组件背景进行均匀的模糊处理，模糊强度一致，边界清晰，用于强调控件与内容的层级分隔。滑动内容进入/离开标题栏区域过程中，模糊背板和分割线透明渐变出现/消失。此方式适用于非沉浸式场景。

过渡模糊样式
对组件背景进行均匀的模糊处理，模糊强度一致，边界清晰，用于强调控件与内容的层级分隔。滑动前后标题栏内容发生颜色/状态变化，滑动过程中，线性跟手变化。此方式仅适用于沉浸式到非沉浸式相互切换的场景。

渐变模糊样式
模糊效果在空间维度上呈现渐强/渐弱的变化，模糊边界柔和，用于增强页面沉浸感。

开发步骤
导入相关模块。

// 从6.0.2(22)版本开始，无需手动导入HdsNavigationAttribute。具体请参考HdsNavigation的导入模块说明。
import { HdsNavigation, ScrollEffectType, HdsNavigationAttribute } from '@kit.UIDesignKit';
import { LengthMetrics } from '@kit.ArkUI';
创建一级导航组件，通过配置titleBar中的scrollEffectType属性，可实现通用模糊、过渡模糊、渐变模糊样式。

@Entry
@Component
struct Index {
build() {
HdsNavigation() { // 创建HdsNavigation组件
// HdsNavigation组件内容区
}.titleBar({
style: { // 设置导航组件标题栏样式
// 标题栏动态模糊样式，包括是否使能滚动动态模糊，动态模糊类型，动态模糊生效的滚动距离等
scrollEffectOpts: {
enableScrollEffect: true,
scrollEffectType: ScrollEffectType.COMMON_BLUR,
blurEffectiveStartOffset: LengthMetrics.vp(0),
blurEffectiveEndOffset: LengthMetrics.vp(20)
},
originalStyle: { // 内容区滚动前初始样式设置
backgroundStyle: { // 标题栏背板样式设置
backgroundColor: $r('sys.color.ohos_id_color_background'),
},
contentStyle: { // 标题栏内容区样式设置，包括标题区域，菜单区域，返回按钮区域
titleStyle: {
mainTitleColor: $r('sys.color.font_primary'),
subTitleColor: $r('sys.color.font_secondary')
},
menuStyle: {
backgroundColor: $r('sys.color.comp_background_tertiary'),
iconColor: $r('sys.color.icon_primary')
},
backIconStyle: {
backgroundColor: $r('sys.color.comp_background_tertiary'),
iconColor: $r('sys.color.icon_primary')
}
}
},
scrollEffectStyle: { // 内容区滚动超过blurEffectiveEndOffset后样式设置
backgroundStyle: {
backgroundColor: $r('sys.color.ohos_id_color_background_transparent'),
},
contentStyle: {
titleStyle: {
mainTitleColor: $r('sys.color.font_primary'),
subTitleColor: $r('sys.color.font_secondary')
},
menuStyle: {
backgroundColor: $r('sys.color.comp_background_tertiary'),
iconColor: $r('sys.color.icon_primary')
},
backIconStyle: {
backgroundColor: $r('sys.color.comp_background_tertiary'),
iconColor: $r('sys.color.icon_primary')
}
}
}
},
content: { // 标题栏内容设置
title: { mainTitle: 'Main', subTitle: 'Sub' },
}
})
}
}
