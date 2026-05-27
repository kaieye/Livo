import { backgroundTaskManager } from '@kit.BackgroundTasksKit'
import { wantAgent, WantAgent } from '@kit.AbilityKit'
import { BusinessError } from '@kit.BasicServicesKit'
import common from '@ohos.app.ability.common'
import { AppContextService } from './AppContextService'

const TAG: string = '[BackgroundTaskService]'

export type BackgroundTaskMode = 'audioPlayback' | 'dataTransfer'

export interface IBackgroundTaskService {
  acquire(mode: BackgroundTaskMode): Promise<void>
  release(mode: BackgroundTaskMode): Promise<void>
}

class BackgroundTaskServiceImpl implements IBackgroundTaskService {
  private static instance: BackgroundTaskServiceImpl | undefined = undefined

  private readonly counts: Map<BackgroundTaskMode, number> = new Map<BackgroundTaskMode, number>()
  private running: boolean = false
  private wantAgentObj: WantAgent | undefined = undefined
  private pendingSync: Promise<void> | undefined = undefined

  static getInstance(): BackgroundTaskServiceImpl {
    if (!BackgroundTaskServiceImpl.instance) {
      BackgroundTaskServiceImpl.instance = new BackgroundTaskServiceImpl()
    }
    return BackgroundTaskServiceImpl.instance
  }

  async acquire(mode: BackgroundTaskMode): Promise<void> {
    this.counts.set(mode, (this.counts.get(mode) ?? 0) + 1)
    await this.sync()
  }

  async release(mode: BackgroundTaskMode): Promise<void> {
    const current = this.counts.get(mode) ?? 0
    if (current <= 1) {
      this.counts.delete(mode)
    } else {
      this.counts.set(mode, current - 1)
    }
    await this.sync()
  }

  private async sync(): Promise<void> {
    while (this.pendingSync) {
      try {
        await this.pendingSync
      } catch (_err) {
        // 上一次同步的失败不影响后续重试
      }
    }
    const job = this.applyState()
    this.pendingSync = job
    try {
      await job
    } finally {
      if (this.pendingSync === job) {
        this.pendingSync = undefined
      }
    }
  }

  private collectModes(): string[] {
    const modes: string[] = []
    this.counts.forEach((_count: number, mode: BackgroundTaskMode) => {
      modes.push(mode)
    })
    return modes
  }

  private async applyState(): Promise<void> {
    const modes = this.collectModes()
    const ctx = this.resolveContext()
    if (!ctx) {
      return
    }

    if (modes.length === 0) {
      if (!this.running) {
        return
      }
      try {
        await backgroundTaskManager.stopBackgroundRunning(ctx)
        this.running = false
        console.info(`${TAG} stopped`)
      } catch (err) {
        const be = err as BusinessError
        console.warn(`${TAG} stop failed code=${be?.code} message=${be?.message}`)
      }
      return
    }

    try {
      const agent = await this.ensureWantAgent(ctx)
      await backgroundTaskManager.startBackgroundRunning(ctx, modes, agent)
      this.running = true
      console.info(`${TAG} running modes=${modes.join(',')}`)
    } catch (err) {
      const be = err as BusinessError
      console.warn(`${TAG} start failed code=${be?.code} message=${be?.message}`)
    }
  }

  private resolveContext(): common.UIAbilityContext | undefined {
    try {
      return AppContextService.getContext()
    } catch (err) {
      console.warn(`${TAG} context unavailable: ${err instanceof Error ? err.message : err}`)
      return undefined
    }
  }

  private async ensureWantAgent(ctx: common.UIAbilityContext): Promise<WantAgent> {
    if (this.wantAgentObj) {
      return this.wantAgentObj
    }
    const info: wantAgent.WantAgentInfo = {
      wants: [
        {
          bundleName: ctx.abilityInfo.bundleName,
          abilityName: ctx.abilityInfo.name,
        },
      ],
      operationType: wantAgent.OperationType.START_ABILITY,
      requestCode: 0,
      wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG],
    }
    const obj = await wantAgent.getWantAgent(info)
    this.wantAgentObj = obj
    return obj
  }
}

export const BackgroundTaskService = BackgroundTaskServiceImpl.getInstance()
