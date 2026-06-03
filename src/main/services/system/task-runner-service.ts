import { getEventBus } from './event-bus'
import { TaskRunner, TaskRunStore } from './task-runner'

let runner: TaskRunner | null = null

export function getLocalTaskRunner(): TaskRunner {
  if (!runner) {
    runner = new TaskRunner(new TaskRunStore(200), {
      emit: (record) => {
        getEventBus().send('tasks:run-updated', record)
      },
    })
  }
  return runner
}

export function resetLocalTaskRunnerForTest(): void {
  runner = null
}
