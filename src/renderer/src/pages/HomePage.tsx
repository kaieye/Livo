import { Layout } from '../components/layout/Layout'
import { useUrlSync } from '../router/use-url-sync'

/**
 * HomePage is the main 3-column layout view (Sidebar + EntryList + EntryContent).
 * It wires up bidirectional URL ↔ Store synchronization via useUrlSync,
 * so that view type, feed selection, discover/settings panel state is reflected in the URL hash.
 */
export default function HomePage() {
  useUrlSync()
  return <Layout />
}
