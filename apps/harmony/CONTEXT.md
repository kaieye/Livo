# CONTEXT.md — Domain Glossary

Shared vocabulary for the Livo Harmony app. Use these terms consistently when naming modules, variables, and discussing architecture.

---

## Core Data Model

**Feed** — An RSS/Atom subscription source. Persisted in the `feeds` RDB table. Has a `FeedViewType` that determines how its entries are presented. Defined in `LivoTypes.ets` as the `Feed` interface.

**Entry** — A single article or post from a feed. Persisted in the `entries` RDB table. Has `isRead` and `isStarred` flags. Defined in `LivoTypes.ets` as the `Entry` interface.

**FeedViewType** — Enum with four values: `Articles` (0), `SocialMedia` (1), `Videos` (2), `Pictures` (3). Assigned per feed. Drives which home mode rail is shown, how content blocks are built, and how entry cards are presented. Not the same as **Home Entry Mode** — a feed's view type is fixed; the home mode is derived from it at display time.

**FeedWithCount** — A `Feed` extended with `unreadCount`. Used by the subscriptions list to show per-feed unread badges.

## View Models (UI layer)

**FeedCardModel** — The subscription list card representation of a feed. Includes display labels, badge colors, and unread count. Created by `toFeedCardModel()` in `LivoModels.ets`.

**EntryCardModel** — The home/subscription card representation of an entry. Includes resolved image URLs, formatted time labels, feed context (title, category, view badge), and media metadata. Created by `toEntryCardModel()` in `LivoModels.ets`.

**ArticleDetailModel** — Extends `EntryCardModel` with parsed `contentBlocks` (paragraph/image/video) for the article detail page. Created by `toArticleDetailModel()` or `articleDetailModelFromCard()`.

## Home Feed

**Home Feed Session** (`HomeFeedSession.ets`) — The central orchestrator for the Index page's home tab. Owns the full home feed lifecycle: startup data loading, background refresh, pagination (load-more), mode switching, inline search, and scroll state. Delegates to focused collaborators (see below). Implements `HomeFeedSessionOwner` so collaborators can read/write shared session state.

**Home Entry Mode** — One of `articles`, `social`, `pictures`, `videos`. Derived from a feed's `FeedViewType` via `modeOfFeedView()` in `FeaturedEntriesQuery`. Used to group entries on the home feed and to drive the mode rail filter. Not the same as `FeedViewType` — the mapping is: `Articles` → `articles`, `SocialMedia` → `social`, `Pictures` → `pictures`, `Videos` → `videos`.

**Featured Entries** — The balanced, mode-aware selection of entries shown on the home feed. Built by `FeaturedEntriesQuery.featuredEntries()` which fetches recent entries, maps them to cards, and applies `selectBalancedHomeEntries()` to ensure each mode with active feeds gets representation. The "fast" variants skip balancing for quicker loads.

**Home Entry Snapshot** — A serialized snapshot of the current home entry list, persisted via `HomeEntrySnapshotStore`. Used to restore the home feed on app restart without waiting for a full database query.

**Home Mode Rail** — The horizontal filter bar on the home feed that lets users switch between article/social/picture/video modes. Managed by `IndexHomeRailCoordinator`.

## Navigation

**Root Tab** — The four main bottom navigation tabs: `home`, `subscriptions`, `discover`, `settings`. Type is `RootTabId`. Managed by `IndexRootTabCoordinator`. The `Index` page renders the active tab's content.

**RootTabRouteParams** — Route parameters passed when navigating to the Index page, specifying which root tab should be active on load.

## Discover & Subscribe

**Discover** — The feed discovery flow. Users search for feeds by URL or keyword, preview results, and subscribe. The discover page has its own navigation depth (root → browse → preview) managed by `DiscoverInteractionCoordinator`.

**Discover Candidate** — A feed search result in the discover flow before the user subscribes. Presented as a preview card with subscribe action.

**Subscription** — A user's active feed subscription. When a user subscribes to a discover candidate, a `Feed` row is created in the database. The subscriptions page lists all feeds with unread counts.

**FeedDraft** — The data needed to create or update a feed (title, URL, site URL, description, category, view type, show-in-all flag). Used by `FeedRepository.create()` and `FeedRepository.update()`.

## Refresh & Sync

**Feed Refresh** — The process of fetching new entries from feed URLs. Orchestrated by `FeedRefreshCoordinator` (`common/data/`). Individual feed fetches are handled by `RssFeedService`. Progress is tracked via `AppStorage` keys and notified to the UI.

**Refresh Log** — A record of each refresh cycle: timestamp, success/fail counts, and failed feed titles. Persisted via `RefreshLogStore`. Displayed in the refresh log settings panel.

**ETag / Last-Modified** — HTTP conditional request headers stored per feed to avoid re-downloading unchanged content. Managed by `FeedRepository.updateFetchState()`.

## AI Assist

**AI Assist** — Article summarization, translation, and chat features powered by configurable AI providers. Settings managed by `AIAssistantSettingsStore`. The assist panel appears on the article detail page. Providers: minimax, deepseek, openai, anthropic, glm, custom.

**AIProvider** — The selected AI service provider. Each has a default base URL, available models, and API key storage.

## Accounts

**Account** — A linked social media account (YouTube, X/Twitter, Instagram, Bilibili). Used to import subscriptions from social platforms. Status checked by `AccountSelfCheckService`. Login flows handled per provider.

## Settings

**HarmonySettings** — The app-wide settings object: auto-refresh, AI toggles, image proxy, theme mode/accent, language, remote feed URL, unread dot visibility. Loaded/saved via `SettingsStore`.

**ThemeMode** — `light`, `dark`, or `system`. Drives the app's color palette. Managed by `ThemeService`.

**ThemeAccent** — `orange`, `blue`, `red`, `pink`, `green`. The app's accent color.

## Persistence

**RDB** — `@ohos.data.relationalStore`. Two tables: `feeds` and `entries`. Accessed via `FeedRepository` and `EntryRepository`, both using `RdbTable<T>` for generic operations. `AppDatabaseService` manages the store lifecycle and schema migration.

**Preferences** — `@ohos.data.preferences`. Key-value storage for settings, AI config, refresh logs, and snapshots. Accessed via focused store classes (`SettingsStore`, `AIAssistantSettingsStore`, `HomeEntrySnapshotStore`, `RefreshLogStore`, `DiscoverAvatarCacheStore`) that wrap `PreferenceStoreAccessor` or `AppPreferenceService`.
