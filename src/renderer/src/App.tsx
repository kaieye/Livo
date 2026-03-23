import { Layout } from "./components/layout/Layout"
import { SettingsDialog } from "./components/settings/SettingsDialog"
import { QuickSearchPanel } from "./components/search/QuickSearch"
import { AIChatPanel } from "./components/ai/AIChatPanel"
import { ShortcutHelpDialog } from "./components/shortcuts/ShortcutHelp"
import { CornerPlayer } from "./components/media/MediaPlayer"
import { TextContextMenu } from "./components/ui/TextContextMenu"

export default function App() {
  return (
    <>
      <Layout />
      <SettingsDialog />
      <QuickSearchPanel />
      <AIChatPanel />
      <ShortcutHelpDialog />
      <CornerPlayer />
      <TextContextMenu />
    </>
  )
}
