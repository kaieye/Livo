BarPosition枚举说明
Phone
PC/2in1
Tablet
TV
Wearable
Tabs页签位置枚举。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

名称 值 说明
Start 0 vertical属性方法设置为true时，页签位于容器左侧；vertical属性方法设置为false时，页签位于容器顶部。
End 1 vertical属性方法设置为true时，页签位于容器右侧；vertical属性方法设置为false时，页签位于容器底部。
属性
Phone
PC/2in1
Tablet
TV
Wearable
除支持通用属性外，还支持以下属性：

vertical
Phone
PC/2in1
Tablet
TV
Wearable
vertical(value: boolean)

设置是否为纵向Tabs。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value boolean 是
是否为纵向Tabs。

默认值：false，横向Tabs，为true时纵向Tabs。

当横向Tabs设置height为auto时，Tabs组件高度自适应子组件高度，即为tabBar高度+divider线宽+TabContent高度+上下padding值+上下border宽度。

当纵向Tabs设置width为auto时，Tabs组件宽度自适应子组件宽度，即为tabBar宽度+divider线宽+TabContent宽度+左右padding值+左右border宽度。

尽量保持每一个页面中的子组件尺寸大小一致，避免滑动页面时出现页面切换动画跳动现象。

scrollable
Phone
PC/2in1
Tablet
TV
Wearable
scrollable(value: boolean)

设置是否可以通过滑动页面进行页面切换。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value boolean 是
是否可以通过滑动页面进行页面切换。

默认值：true，可以通过滑动页面进行页面切换。为false时不可滑动切换页面。

barMode
Phone
PC/2in1
Tablet
TV
Wearable
barMode(value: BarMode, options?: ScrollableBarModeOptions)

设置TabBar布局模式。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BarMode 是
布局模式。

默认值：BarMode.Fixed

options ScrollableBarModeOptions 否
Scrollable模式下的TabBar的布局样式。

说明：

仅Scrollable且水平模式下有效。

barMode
Phone
PC/2in1
Tablet
TV
Wearable
barMode(value: BarMode.Fixed)

设置TabBar布局模式为BarMode.Fixed。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BarMode.Fixed 是 所有TabBar会平均分配barWidth宽度（纵向时平均分配barHeight高度）。
barMode
Phone
PC/2in1
Tablet
TV
Wearable
barMode(value: BarMode.Scrollable, options: ScrollableBarModeOptions)

设置TabBar布局模式为BarMode.Scrollable。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BarMode.Scrollable 是 所有TabBar都使用实际布局宽度，超过总宽度（横向Tabs的barWidth，纵向Tabs的barHeight）后可滑动。
options ScrollableBarModeOptions 是
Scrollable模式下的TabBar的布局样式。

说明：

仅水平模式下有效。

barWidth
Phone
PC/2in1
Tablet
TV
Wearable
barWidth(value: Length)

设置TabBar的宽度值。设置为小于0或大于Tabs宽度值时，按默认值显示。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value Length 是
TabBar的宽度值。

默认值：

未设置SubTabBarStyle和BottomTabBarStyle的TabBar且vertical属性为false时，默认值为Tabs的宽度。

未设置SubTabBarStyle和BottomTabBarStyle的TabBar且vertical属性为true时，默认值为56vp。

设置SubTabBarStyle样式且vertical属性为false时，默认值为Tabs的宽度。

设置SubTabBarStyle样式且vertical属性为true时，默认值为56vp。

设置BottomTabBarStyle样式且vertical属性为true时，默认值为96vp。

设置BottomTabBarStyle样式且vertical属性为false时，默认值为Tabs的宽度。

barHeight
Phone
PC/2in1
Tablet
TV
Wearable
barHeight(value: Length)

设置TabBar的高度值。横向Tabs可以设置height为'auto'，让TabBar自适应子组件高度。height设置为小于0或大于Tabs高度值时，按默认值显示。

API version 14之前的版本，若设置barHeight为固定值后，TabBar无法扩展底部安全区。从API version 14开始支持配合safeAreaPadding属性，当safeAreaPadding不设置bottom或者bottom设置为0时，可以实现扩展安全区。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value Length 是
TabBar的高度值。

默认值：

未设置样式或者通过CustomBuilder设置自定义样式的TabBar且vertical属性为false时，默认值为56vp。

未设置样式或者通过CustomBuilder设置自定义样式的TabBar且vertical属性为true时，默认值为Tabs的高度。

设置SubTabBarStyle样式且vertical属性为false时，默认值为56vp。

设置SubTabBarStyle样式且vertical属性为true时，默认值为Tabs的高度。

设置BottomTabBarStyle样式且vertical属性为true时，默认值为Tabs的高度。

设置BottomTabBarStyle样式且vertical属性为false时，默认值为56vp，从API version 12开始，默认值变更为48vp。

barHeight
Phone
PC/2in1
Tablet
TV
Wearable
barHeight(height: Length, noMinHeightLimit: boolean)

设置TabBar的高度值。横向Tabs可以设置height为'auto'，让TabBar自适应子组件高度，并通过设置noMinHeightLimit为true让自适应高度可以小于TabBar默认高度。height设置为小于0或大于Tabs高度值时，按默认值显示。

元服务API： 从API version 20开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
height Length 是
TabBar的高度值。

默认值：

未设置样式或者通过CustomBuilder设置自定义样式的TabBar且vertical属性为false时，默认值为56vp。

未设置样式或者通过CustomBuilder设置自定义样式的TabBar且vertical属性为true时，默认值为Tabs的高度。

设置SubTabBarStyle样式且vertical属性为false时，默认值为56vp。

设置SubTabBarStyle样式且vertical属性为true时，默认值为Tabs的高度。

设置BottomTabBarStyle样式且vertical属性为true时，默认值为Tabs的高度。

设置BottomTabBarStyle样式且vertical属性为false时，默认值为48vp。

noMinHeightLimit boolean 是
height设置为'auto'时，设置是否取消TabBar的最小高度限制。默认值为false。

说明：

值为true表示取消TabBar的最小高度限制，即TabBar的高度值可以小于默认值。

值为false表示限制TabBar的最小高度，即TabBar的最小高度值等于默认值。

animationCurve
Phone
PC/2in1
Tablet
TV
Wearable
animationCurve(curve: Curve | ICurve)

设置Tabs翻页动画曲线。常用曲线参考Curve枚举说明，也可以通过插值计算模块提供的接口创建自定义的插值曲线对象。

元服务API： 从API version 20开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
curve Curve | ICurve 是
Tabs翻页的动画曲线。

默认值：

滑动TabContent翻页时，默认值为interpolatingSpring(-1, 1, 228, 30)。

点击TabBar页签和调用TabsController的changeIndex接口翻页时，默认值为cubicBezierCurve(0.2, 0.0, 0.1, 1.0)。

设置自定义动画曲线时，滑动翻页和点击页签、调用changeIndex翻页都使用设置的动画曲线。

animationDuration
Phone
PC/2in1
Tablet
TV
Wearable
animationDuration(value: number)

设置Tabs翻页动画时长。

animationCurve不设置时，由于滑动TabContent翻页动画曲线interpolatingSpring(-1, 1, 228, 30)时长只受曲线自身参数影响，animationDuration只能控制点击TabBar页签和调用TabsController的changeIndex接口切换TabContent的动画时长。

不受animationDuration控制的曲线可以查阅插值计算模块，比如springMotion、responsiveSpringMotion和interpolatingSpring类型的曲线。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value number 是
Tabs翻页的动画时长。

默认值：

API version 10及以前，不设置该属性或设置为null时，默认值为0，即Tabs翻页无动画。设置为小于0或undefined时，默认值为300。

API version 11及以后，不设置该属性或设置为异常值，且设置TabBar为BottomTabBarStyle样式时，默认值为0。设置TabBar为其他样式时，默认值为300。

单位：ms

取值范围：[0, +∞)

animationMode
Phone
PC/2in1
Tablet
TV
Wearable
animationMode(mode: Optional<AnimationMode>)

设置点击TabBar页签或调用TabsController的changeIndex接口时切换TabContent的动画形式。

说明
此属性不支持在attributeModifier中调用。

元服务API： 从API version 12开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
mode Optional<AnimationMode> 是
点击TabBar页签或调用TabsController的changeIndex接口时切换TabContent的动画形式。

默认值：AnimationMode.CONTENT_FIRST，表示在点击TabBar页签或调用TabsController的changeIndex接口切换TabContent时，先加载目标页内容，再开始切换动画。

barPosition
Phone
PC/2in1
Tablet
TV
Wearable
barPosition(value: BarPosition)

设置Tabs的页签位置。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BarPosition 是
设置Tabs的页签位置。

默认值：BarPosition.Start

divider
Phone
PC/2in1
Tablet
TV
Wearable
divider(value: DividerStyle | null)

设置区分TabBar和TabContent的分割线样式。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value DividerStyle | null 是
分割线样式，默认不显示分割线。

DividerStyle：分割线的样式；

null：不显示分割线。

fadingEdge
Phone
PC/2in1
Tablet
TV
Wearable
fadingEdge(value: boolean)

设置页签超过容器宽度时是否渐隐消失。建议配合barBackgroundColor属性一起使用，如果barBackgroundColor属性没有定义，会默认显示页签末端为白色的渐隐效果。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value boolean 是
页签超过容器宽度时是否渐隐消失。

默认值：true，页签超过容器宽度时会渐隐消失。设置为false时，页签超过容器宽度直接截断显示，不产生任何渐变效果‌。

barOverlap
Phone
PC/2in1
Tablet
TV
Wearable
barOverlap(value: boolean)

设置TabBar是否背后变模糊并叠加在TabContent之上。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value boolean 是
TabBar是否背后变模糊并叠加在TabContent之上。当barOverlap设置为true时，TabBar背后变模糊并叠加在TabContent之上，并且TabBar默认模糊材质的BlurStyle值修改为'BlurStyle.COMPONENT_THICK'。当barOverlap设置为false时，无模糊和叠加效果。

默认值：false

barBackgroundColor
Phone
PC/2in1
Tablet
TV
Wearable
barBackgroundColor(value: ResourceColor)

设置TabBar的背景颜色。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value ResourceColor 是
TabBar的背景颜色。

默认值：Color.Transparent，透明

barBackgroundBlurStyle
Phone
PC/2in1
Tablet
TV
Wearable
barBackgroundBlurStyle(value: BlurStyle)

设置TabBar的背景模糊材质。

说明
从API version 12开始，该接口支持在attributeModifier中调用。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BlurStyle 是
TabBar的背景模糊材质。

默认值：BlurStyle.NONE

barBackgroundBlurStyle
Phone
PC/2in1
Tablet
TV
Wearable
barBackgroundBlurStyle(style: BlurStyle, options: BackgroundBlurStyleOptions)

为TabBar提供一种在背景和内容之间的模糊能力，通过枚举值的方式封装了不同的模糊半径、蒙版颜色、蒙版透明度、饱和度、亮度。

元服务API： 从API version 18开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
style BlurStyle 是 背景模糊样式。模糊样式中封装了模糊半径、蒙版颜色、蒙版透明度、饱和度、亮度五个参数。
options BackgroundBlurStyleOptions 是 背景模糊选项。
barGridAlign
Phone
PC/2in1
Tablet
TV
Wearable
barGridAlign(value: BarGridColumnOptions)

以栅格化方式设置TabBar的可见区域。具体参见BarGridColumnOptions对象。仅水平模式下有效，不适用于XS、XL和XXL设备。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value BarGridColumnOptions 是 以栅格化方式设置TabBar的可见区域。
edgeEffect
Phone
PC/2in1
Tablet
TV
Wearable
edgeEffect(edgeEffect: Optional<EdgeEffect>)

设置边缘滑动效果。

说明
从API version 17开始，该接口支持在attributeModifier中调用。

元服务API： 从API version 12开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
edgeEffect Optional<EdgeEffect> 是
边缘滑动效果。

默认值：EdgeEffect.Spring

barBackgroundEffect
Phone
PC/2in1
Tablet
TV
Wearable
barBackgroundEffect(options: BackgroundEffectOptions)

设置TabBar背景属性，包含背景模糊半径，亮度，饱和度，颜色等参数。

元服务API： 从API version 18开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
options BackgroundEffectOptions 是 设置TabBar背景属性包括：模糊半径，亮度，饱和度，颜色等。
pageFlipMode
Phone
PC/2in1
Tablet
TV
Wearable
pageFlipMode(mode: Optional<PageFlipMode>)

设置鼠标滚轮翻页模式。

元服务API： 从API version 15开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
mode Optional<PageFlipMode> 是
鼠标滚轮翻页模式。

默认值：PageFlipMode.CONTINUOUS

cachedMaxCount
Phone
PC/2in1
Tablet
TV
Wearable
cachedMaxCount(count: number, mode: TabsCacheMode)

设置子组件的最大缓存个数及缓存模式。未设置该属性时默认缓存所有子组件且缓存后不会释放。

元服务API： 从API version 19开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
count number 是
子组件的最大缓存个数。超出范围时自动释放不再需要的子组件。

取值范围：[0, +∞)。

mode TabsCacheMode 是
子组件的缓存模式。

默认值：TabsCacheMode.CACHE_BOTH_SIDE

nestedScroll
Phone
PC/2in1
Tablet
TV
Wearable
nestedScroll(value: TabsNestedScrollMode | undefined)

设置Tabs组件与其父组件的嵌套滚动模式。未通过该接口设置时，默认嵌套滚动模式为SELF_ONLY。

模型约束： 此接口仅可在Stage模型下使用。

元服务API： 从API version 24开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

参数：

参数名 类型 必填 说明
value TabsNestedScrollMode | undefined 是
Tabs组件和父组件的嵌套滚动模式。

设置undefined时，Tabs自身滚动，不与父组件联动。

DividerStyle对象说明
Phone
PC/2in1
Tablet
TV
Wearable
分割线样式对象。

元服务API： 从API version 11开始，该接口支持在元服务中使用。

系统能力： SystemCapability.ArkUI.ArkUI.Full

名称 类型 只读 可选 说明
strokeWidth Length 否 否
分割线的线宽（不支持百分比设置）。

默认值：0.0

单位：vp

取值范围：[0, +∞)。

color ResourceColor 否 是
分割线的颜色。

默认值：#33182431

startMargin Length 否 是
分割线与侧边栏顶端的距离（不支持百分比设置）。

默认值：0.0

单位：vp

取值范围：[0, +∞)。

endMargin Length 否 是
分割线与侧边栏底端的距离（不支持百分比设置）。

默认值：0.0

单位：vp

取值范围：[0, +∞)。
