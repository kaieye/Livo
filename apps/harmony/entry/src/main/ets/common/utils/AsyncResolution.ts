export async function resolveFirstNonEmpty(
  tasks: Array<() => Promise<string>>,
): Promise<string> {
  if (tasks.length === 0) {
    return ''
  }

  return await new Promise<string>((resolve) => {
    let settledCount = 0
    let resolved = false

    tasks.forEach((task: () => Promise<string>) => {
      task()
        .then((value: string) => {
          if (resolved) {
            return
          }
          if ((value || '').trim()) {
            resolved = true
            resolve(value)
            return
          }
          settledCount += 1
          if (settledCount >= tasks.length) {
            resolve('')
          }
        })
        .catch(() => {
          if (resolved) {
            return
          }
          settledCount += 1
          if (settledCount >= tasks.length) {
            resolve('')
          }
        })
    })
  })
}
