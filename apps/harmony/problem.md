# Harmony App 问题记录

## 1. 图片内存问题 (ashmem)

**现象:**
- `CreatePixelMap success` 后 `set ashmem name failed`
- 大量重复出现

**根因:**
短时间内并发创建大量PixelMap，系统ashmem共享内存区域耗尽或权限不足。

**影响:**
图片解码成功但内存管理降级，可能导致GC压力增大。

**优化方向:**
图片加载做节流/并发限制，避免同一时间大量PixelMap创建。

---

## 2. GC导致UI卡顿

**现象:**
```
OldGC max pause: 41.845 ms
GCReason: Idle time task
```

**根因:**
GC时Stop-the-world暂停41ms，用户能感知明显卡顿。内存压力导致GC频繁触发。

**影响:**
滚动/滑动时帧率下降，卡顿感明显。

**优化方向:**
- 减少图片并发解码数量
- 优化内存分配节奏
- 考虑图片缓存复用

---

## 3. 网络请求失败

**现象:**
- `CURLcode result 28` — 请求超时
- `CURLcode result 23` — HTTP客户端取消
- `CURLcode result 35` — SSL连接失败

**根因:**
- 网络不稳定导致超时
- 短时间内发起大量请求被取消
- SSL/TLS连接失败

**影响:**
部分feed内容加载失败，用户看到空白或加载占位符。

**优化方向:**
- 增加重试机制
- 优化超时配置
- 请求合并减少并发

---

## 4. 手势冲突

**现象:**
```
LongPress move over max threshold
Drag gesture has been canceled
RequestStatusTransition from 0 to 1
```

**根因:**
长按和拖拽手势识别冲突，系统拒绝拖拽触发。

**影响:**
部分场景下拖拽操作无法正常触发。

---

## 5. HDS_tabs组件错误 (SDK层)

**现象:**
```
GetTabBarPosition barPosition is not a number
breakpoint_ 0
tabBarItemCount 4, breakpoint_ 0
```

**根因:**
HarmonyOS SDK的HdsTabs组件内部状态机异常，breakpoint计算为0导致布局失败。

**影响:**
Tab切换时组件布局计算异常，可能导致UI显示问题。

**状态:**
SDK层面问题，非App代码责任。建议检查SDK版本或查HarmonyOS社区。

---

## 6. RSUIDirector动画回调错误

**现象:**
```
RSUIDirector::AnimationCallbackProcessor, could not find animation XXXon node XXX
```
同一animation ID和node组合反复出现。

**根因:**
动画完成前节点被移除/复用，导致回调找不到目标动画。

**影响:**
动画可能显示不完整或闪烁。

**优化方向:**
- 检查动画生命周期管理
- 确保节点在动画完成前不被移除

---

## 7. 图片解码描述符不匹配

**现象:**
```
ExtDecoder Failed to match desc
```

**根因:**
渐进式JPEG(Progressive JPEG)解码时，图片描述符与解码器不匹配。

**影响:**
部分图片解码失败，显示占位符或空白。

**状态:**
HarmonyOS图片解码器兼容性问题。

---

## 8. 任务调度失败 (CONCUR)

**现象:**
```
[Interface] task X apply qos failed, errno = 4
```

**根因:**
进程内任务调度队列已满，无法接受新任务。系统负载过高时发生。

**影响:**
图片解码等后台任务被丢弃，可能导致图片加载失败。

**优化方向:**
- 降低图片并发解码数量
- 实现任务队列限流

---

## 9. 资源警告 (sys.float.hms_material_style)

**现象:**
```
Get double by name error, resName=sys.float.hms_material_style, errorCode=9001003
```

**根因:**
Material Design样式资源缺失或访问失败。

**影响:**
样式显示可能异常。

## 10. Vsync超时导致UI阻塞

**现象:**
```
PrintRequestTs: recv vsync timeout
timeInterval: 576961113ns ≈ 577ms
```

**根因:**
UI渲染流水线阻塞，vsync信号等待超时(577ms >> 正常16.67ms)。

**影响:**
UI完全冻结约577ms，用户感知严重卡顿。

**优化方向:**
- 检查主线程阻塞原因
- 优化UI渲染时序
- 减少主线程任务

---

## 11. 滚动性能监控采样失败

**现象:**
```
StartScrollProfile durationTime: 418 ms
ThreadSampler initialize failed
```

**根因:**
XCollie滚动采样器初始化失败，性能监控不可用。

**影响:**
无法获取详细滚动性能数据，排查问题困难。

**状态:**
HarmonyOS性能监控组件问题。

---

## 12. 图片并发解码压力

**现象:**
- `ram XXX released YYY` — 频繁内存释放
- `apply ram XXX for XXXX` — 大量内存申请
- 大量 `CreatePixelMap success` + `set ashmem name failed`

**根因:**
Feed滚动时大量图片同时触发解码，内存管理压力大。

**优化方向:**
- 实现图片解码队列节流
- 增加可见区域预加载限制
- 复用已解码PixelMap

---

## 13. Tab切换动画状态异常

**现象:**
```
OnAnimatorStop: Animation has not started, sceneId: APP_TAB_SWITCH
```

**根因:**
Tab切换动画触发时动画尚未开始就被停止请求。

**影响:**
Tab切换动画可能不完整或丢失。

**状态:**
HarmonyOS UI框架问题。

---

## 14. 视频组件source重复设置

**现象:**
```
Video[12432] source is null or the source has not changed
```

**根因:**
视频播放组件收到相同source重复设置请求。

**影响:**
视频播放可能卡顿或重新加载。

**优化方向:**
- 检查视频URL设置逻辑
- 防止重复设置相同source

---

## 15. CURLcode result 42 (请求超时)

**现象:**
```
HttpClient CURLcode result 42
total_time: 1142ms-1135ms
```

**根因:**
HTTP客户端请求操作超时(Operation too long)。

**影响:**
Feed内容加载失败，用户看到占位符。

---

## 16. 音视频后台线程频繁重建

**现象:**
```
PipeLineThread OS_Ply_HiAppEvent2_S remove all Task
DestroyThread groupId:OS_Ply_HiAppEvent2
PipeLineThread OS_Ply_HiAppEvent3_S created
```

**根因:**
音视频PipelineThread被销毁重建，线程切换开销大。

**影响:**
视频播放可能卡顿或重新初始化。

---

## 17. HiTrace追踪系统异常

**现象:**
```
HiTraceEnd failed: invalid thread id
```

**根因:**
HiTrace链路追踪结束时线程ID无效。

**影响:**
性能追踪数据不完整。

**状态:**
HarmonyOS系统组件问题。

---

## 18. UI渲染完全冻结3秒

**现象:**
```
ArkUI request vsync,but no vsync received in 3 seconds
timeInterval: 3231770119ns ≈ 3.2秒
Animation finish callback is not executed
```

**根因:**
UI渲染流水线完全阻塞3秒，vsync信号无法到达。

**影响:**
用户看到App完全卡死约3秒。

**优化方向:**
- 检查主线程阻塞任务
- 优化UI渲染优先级

---

## 19. SQLite光标块填充效率低

**现象:**
```
FillBlock:blockRowNum=552, requiredPos= 110, startPos_= 74, lastPos_= 139, blockPos_= 36
```

**根因:**
SQLite游标读取数据时需要跳跃填充多个块，数据未按索引顺序存储。

**影响:**
Feed数据查询变慢，尤其是大结果集(552行)。

**优化方向:**
- 检查数据库索引是否合理
- 考虑分页查询优化
- 减少单次查询数据量

---

## 20. APP_INPUT_BLOCK应用冻结事件

**现象:**
```
NotifyAppFault:APP_INPUT_BLOCK, pid:2895, bundleName:com.chos1nz.livo
currentTime:2026-05-17 21:36:13.727, processExit:1
HEAP_TOTAL_SIZE:31195136, HEAP_OBJECT_SIZE:27112208
```

**根因:**
应用主线程被阻塞超过阈值(5秒)，AppDfr组件检测到输入事件无法处理。

**影响:**
App进程可能被系统强制退出(EXIT_GATHER模式)。

**优化方向:**
- 定位阻塞主线程的任务(参考uv_timer_task问题)
- 减少主线程计算密集型操作
- 使用后台线程处理复杂业务逻辑

---

## 21. uv_timer_task阻塞主线程6904ms

**现象:**
```
BlockMonitor event name: uv_timer_task, Duration Time: 6904 ms
success to submit start trace
MainThread TraceCollector Start result: 0, Duration Time: 6904 ms
```

**根因:**
Node.js/Timer轮询任务在主线程上执行耗时操作(6.9秒)，远超正常水平。

**影响:**
UI完全冻结，用户无法交互。

**优化方向:**
- 将uv_timer相关任务移到后台线程
- 检查是否有死循环或忙等待的timer回调
- 优化事件循环中的任务调度