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
}
