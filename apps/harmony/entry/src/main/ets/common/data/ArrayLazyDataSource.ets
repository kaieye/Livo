export class ArrayLazyDataSource<T> implements IDataSource {
  private readonly getItems: () => T[]
  private listeners: DataChangeListener[] = []
  // 缓存 getItems() 结果，避免每次 totalCount/getData 都重复执行 getter。
  // 视频网格的 getter 返回 entries.slice(0, limit)，未命中缓存时每次访问
  // 都会分配新数组并复制元素，滚动期间单帧产生几十次 O(n) 调用。
  // 缓存在 notifyDataReloaded / notifyDataAdded 时失效，确保数据变更后下
  // 一次访问会重新求值。
  private cachedItems: T[] | undefined = undefined

  constructor(getItems: () => T[]) {
    this.getItems = getItems
  }

  private resolveItems(): T[] {
    if (this.cachedItems === undefined) {
      this.cachedItems = this.getItems()
    }
    return this.cachedItems
  }

  private invalidateCache(): void {
    this.cachedItems = undefined
  }

  totalCount(): number {
    return this.resolveItems().length
  }

  getData(index: number): T {
    return this.resolveItems()[index]
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener)
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const listenerIndex = this.listeners.indexOf(listener)
    if (listenerIndex >= 0) {
      this.listeners.splice(listenerIndex, 1)
    }
  }

  notifyDataReloaded(): void {
    this.invalidateCache()
    this.listeners.forEach((listener: DataChangeListener) => {
      try {
        listener.onDataReloaded()
      } catch (error) {
        console.error(`ArrayLazyDataSource notifyDataReloaded failed: ${error instanceof Error ? error.message : error}`)
      }
    })
  }

  notifyDataAdded(index: number): void {
    this.invalidateCache()
    this.listeners.forEach((listener: DataChangeListener) => {
      try {
        if (listener.onDataAdd) {
          listener.onDataAdd(index)
          return
        }
        listener.onDataReloaded()
      } catch (error) {
        console.error(`ArrayLazyDataSource notifyDataAdded failed: ${error instanceof Error ? error.message : error}`)
      }
    })
  }

  // 一次性追加多条时按区间通知 LazyForEach。
  // ArkUI 的 LazyForEach.onDataAdd(index) 标准语义是"在 index 位置插入了 1 项",
  // 若一次性追加 N 项却只 notify 一次,LazyForEach 内部总数与可见项数不对齐,
  // 会回退到全量 reloadData——这就是首页"加载更多特别卡"的根因。
  // 循环 notify 后,LazyForEach 能精确知道追加范围,真正走增量插入路径。
  notifyDataAddedRange(startIndex: number, count: number): void {
    if (count <= 0) {
      return
    }
    this.invalidateCache()
    this.listeners.forEach((listener: DataChangeListener) => {
      try {
        if (listener.onDataAdd) {
          for (let i = 0; i < count; i++) {
            listener.onDataAdd(startIndex + i)
          }
          return
        }
        listener.onDataReloaded()
      } catch (error) {
        console.error(`ArrayLazyDataSource notifyDataAddedRange failed: ${error instanceof Error ? error.message : error}`)
      }
    })
  }
}
