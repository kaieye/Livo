import AbilityStage from '@ohos.app.ability.AbilityStage'

export default class LivoAbilityStage extends AbilityStage {
  onCreate(): void {
    console.info('LivoAbilityStage onCreate')
  }

  onDestroy(): void {
    console.info('LivoAbilityStage onDestroy')
  }

  onTrimMemory(level: number): void {
    console.info(`LivoAbilityStage onTrimMemory level=${level}`)
  }
}
