import { HarmonySettings } from '../models/LivoModels'
import { ChatSession } from '../services/ChatHistoryStore'
import { ThemePalette } from '../services/ThemeService'
import { AIAssistantSettingsPanel } from './AIAssistantSettingsPanel'
import { AIChatHistoryPanel } from './AIChatHistoryPanel'
import { AIChatTracePanel } from './AIChatTracePanel'

@Component
export struct AIChatSettingsSheet {
  @Prop theme: ThemePalette = {} as ThemePalette
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  build() {
    Column() {
      AIAssistantSettingsPanel({
        onSettingsChange: (settings: HarmonySettings) => {
          this.onSettingsChange(settings)
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}

@Component
export struct AIChatHistorySheet {
  @Prop theme: ThemePalette = {} as ThemePalette
  onLoadSession: (session: ChatSession) => void = () => {}
  onClose: () => void = () => {}

  build() {
    Column() {
      AIChatHistoryPanel({
        theme: this.theme,
        onLoadSession: (session: ChatSession) => {
          this.onLoadSession(session)
        },
        onClose: () => {
          this.onClose()
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}

@Component
export struct AIChatTraceSheet {
  @Prop theme: ThemePalette = {} as ThemePalette

  build() {
    Column() {
      AIChatTracePanel({ theme: this.theme })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
