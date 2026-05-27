把 HomeFeedSession 一族折叠回一个深模块

- 涉及文件（common/coordinators/home/）：HomeFeedSession.ets、HomeFeedSessionOwner.ets、HomeFeedStateBag.ets、HomeFeedRef
  resh.ets、HomeFeedPagination.ets、HomeFeedPaginationState.ets、HomeFeedLoadMorePrefetch.ets、HomeFeedLoadMoreDrain.ets、H
  omeEntryDataManager.ets、HomeInlineSearchController.ets、HomeScrollIntentTracker.ets。
- 问题：这些不是一组深模块，而是一台状态机被按文件切片。HomeFeedSessionOwner 暴露 ~60 个字段 + 30
  个动作，每个"协作者"都用 (state, actions, owner) 反向拉同一个袋子。HomeFeedSession.ets 末尾 60+
  行只是把协作者的方法逐条转发。删除测试结果：复杂度不会扩散——它只会从 11 个文件回到 1
  个文件。它们的接口（调用方需要知道的东西）实际上是整张 owner 表，所以每个协作者本质上是浅模块。
- 解决：合并为一个 HomeFeedSession 模块，把现有协作者降级为该模块的私有方法或 # private 类成员。原 owner
  接口消失（变成内部状态）。对外只保留 Index 页需要的少数动作（start/refresh/loadMore/switchMode/search/...）。
- 收益：
  - 杠杆：调用方只需要学习一个对外接口，而不是 11 个互相耦合的对象。
  - 聚集性：home feed 的 bug 集中在一个模块里；改一处改对全部。
  - 测试面：当前那些"测内部协作者"的单元测试一旦写成都是穿过接口的，等于测过了接口——它们应该被删除。新测试写在合并后的
    HomeFeedSession 接口上，存活率更高。HomeFeedGuard.ts 已经是这个范式的样板（4 处重复谓词合并为 1 处）。

任务 #1 完整折叠 11 个 home 协调器到一个深模块涉及的工作量很大、风险高，而且 Index.ets 目前通过
session.<collaborator>.<method> 对外暴露的方法数量已经接近上百——彻底封闭这个 surface 需要花费的精力远超之前 5
个任务的总和。

我建议把 #1 拆成更小的递进步骤，先做最明显的内聚收紧：把 HomeFeedLoadMorePrefetch + HomeFeedLoadMoreDrain 合并进
HomeFeedPagination（这两个 prefetch/drain 是 pagination 的强耦合内部细节）。

HomeFeedLoadMorePrefetch 和 HomeFeedLoadMoreDrain 各自都是 150+ 行真实业务逻辑，不是 pass-through：

- 各自持有独立的 HomeFeedGuard 实例、guard provider 装配、prefetch token / 已拉取条目缓冲
- 各自被 4 个 brittle source-regex 测试钉住（home-load-more-prefetch-source.test.ts、home-load-more-drain-source.test.ts
  、home-load-more-diagnostics-source.test.ts、problem-regressions-source.test.ts）
- 合并进 HomeFeedPagination 会让它从 601 行涨到 ~900 行，并要重写 4 个测试的 regex

加上完整的 #1（11 个文件全部收紧到一个对外入口）会牵动 Index.ets 上百处 session.<collaborator>.<method>
调用站点重写
