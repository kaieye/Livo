
import AbilityConstant from '@ohos.app.ability.AbilityConstant'
import { Configuration } from '@ohos.app.ability.Configuration'
import Want from '@ohos.app.ability.Want'
import UIAbility from '@ohos.app.ability.UIAbility'
import window from '@ohos.window'
import { AppRepository } from '../common/data/AppRepository'
import { AppContextService } from '../common/services/AppContextService'
import { resolveSystemBarStyle } from '../common/utils/SystemBarStyle'

export default class EntryAbility extends UIAbility {
  private static readonly SYSTEM_THEME_CHANGED_AT_KEY: string = 'systemThemeChangedAt'

  private async applySystemBarStyle(mainWindow: window.Window, isDark: boolean = false): Promise<void> {
    try {
      const systemBarStyle = resolveSystemBarStyle({
        isDark,
        background: isDark ? '#111418' : '#F3F5F8',
      })
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: systemBarStyle.statusBarColor,
        navigationBarColor: systemBarStyle.navigationBarColor,
        isStatusBarLightIcon: systemBarStyle.isStatusBarLightIcon,
        statusBarContentColor: systemBarStyle.statusBarContentColor,
      })
    } catch (error) {
      throw new Error(`设置系统栏样式失败：${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  private syncAvoidArea(mainWindow: window.Window): void {
    try {
      const avoidArea = mainWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM)
      const uiContext = mainWindow.getUIContext()
      AppStorage.setOrCreate('topAvoidArea', uiContext.px2vp(avoidArea.topRect.height))
      AppStorage.setOrCreate('bottomAvoidArea', uiContext.px2vp(avoidArea.bottomRect.height))
    } catch (error) {
      console.error(`Failed to sync avoid area: ${error instanceof Error ? error.message : error}`)
    }
  }

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    console.info(
      `Livo EntryAbility onCreate: ${want.bundleName ?? ''}, ${launchParam.launchReason}`,
    )

    AppContextService.setContext(this.context)

    void AppRepository.bootstrap().then(() => {
      console.info('Livo Harmony repositories initialized')
    }).catch((error: Error) => {
      console.error(`Failed to initialize Harmony repositories: ${error.message}`)
    })
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    console.info('Livo EntryAbility onWindowStageCreate')

    void windowStage.getMainWindow().then(async (mainWindow: window.Window) => {
      try {
        await mainWindow.setWindowLayoutFullScreen(true)
        await this.applySystemBarStyle(mainWindow)
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`
        console.error(`Failed to configure immersive window: ${message}`)
      }

      AppStorage.setOrCreate('WindowClass', mainWindow)
      this.syncAvoidArea(mainWindow)
      mainWindow.on('avoidAreaChange', () => {
        this.syncAvoidArea(mainWindow)
      })
    }).catch((error: Error) => {
      console.error(`Failed to get main window: ${error.message}`)
    })

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error(`Failed to load content. Code: ${err.code}, message: ${err.message}`)
        return
      }
      console.info('Livo Harmony home page loaded')
    })
  }

  onWindowStageDestroy(): void {
    console.info('Livo EntryAbility onWindowStageDestroy')
  }

  onConfigurationUpdate(newConfig: Configuration): void {
    if (newConfig.colorMode === undefined) {
      return
    }

    AppStorage.setOrCreate(EntryAbility.SYSTEM_THEME_CHANGED_AT_KEY, Date.now())
  }

  onDestroy(): void {
    console.info('Livo EntryAbility onDestroy')
  }
}
