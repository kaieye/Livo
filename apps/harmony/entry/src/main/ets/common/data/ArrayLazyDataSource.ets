export class ArrayLazyDataSource<T> implements IDataSource {
  private readonly getItems: () => T[]
  private listeners: DataChangeListener[] = []

  constructor(getItems: () => T[]) {
    this.getItems = getItems
  }

  totalCount(): number {
    return this.getItems().length
  }

  getData(index: number): T {
    return this.getItems()[index]
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
    this.listeners.forEach((listener: DataChangeListener) => {
      try {
        listener.onDataReloaded()
      } catch (error) {
        console.error(`ArrayLazyDataSource notifyDataReloaded failed: ${error instanceof Error ? error.message : error}`)
      }
    })
  }
}