# Livo Harmony — Domain Glossary

This glossary names the core concepts in the Livo HarmonyOS app. Use these terms consistently in code, documentation, and architecture discussions.

## Core domain

- **Feed** — A subscription source: an RSS feed, a YouTube channel, a Bilibili user, an Instagram profile, or an X (Twitter) account. Persisted in the `feeds` RDB table. Has a `FeedViewType` that determines which home-screen rail it appears in.
- **Entry** — An individual item within a feed: an article, a social media post, a video, or a picture. Persisted in the `entries` RDB table. Has read/starred state, media URLs, and timestamps.
- **FeedViewType** — Enum categorizing a feed: `Articles` (0), `SocialMedia` (1), `Videos` (2), `Pictures` (3). Determines content rendering and home-screen rail placement.
- **Mode** (a.k.a. `SubscriptionMode`, `HomeEntryMode`) — One of four home-screen content rails: `'articles'`, `'social'`, `'pictures'`, `'videos'`. Each mode filters entries to matching `FeedViewType` feeds.

## Home screen

- **Featured Entries** — The balanced, mode-aware list of `EntryCardModel` items displayed on the home screen. Built by `FeaturedEntriesQuery` from the repository layer.
- **Candidate Limit** — The maximum number of entries fetched per mode for the home feed. Controls initial load size and pagination step size. Configurable per mode.
- **Visible Entry Limit** — How many entries are actually rendered (driven by lazy data sources). Smaller than the candidate limit for performance.
- **Entry Groups** — Featured entries partitioned by mode (`articles[]`, `social[]`, `pictures[]`, `videos[]`). The Index page holds these groups and merges them for cross-mode views.
- **Snapshot** — Persisted `EntryCardModel[]` saved to preferences on app suspend. Restored on next launch for instant home-screen display before the database query completes.
- **Load State Gate** — Controls the transition: initial-loading → empty-state → content-display. Prevents flicker and premature empty-state rendering.
- **Rail** — The horizontal mode-switching bar at the top of the home feed. Tabs: Articles | Social | Pictures | Videos. Supports swipe and tap.
- **Chrome** — The persistent UI shell around scrollable content: bottom tab bar, header, mode rail.
- **Content Version** — A monotonically-increasing counter bumped whenever entry groups or visible-entry limits change. Descendant components observe it via `@Prop` to re-evaluate `@Builder` children.

## Pagination

- **Prefetch** — Proactively loading the next page of entries before the user scrolls to the end. `HomeFeedLoadMorePrefetch` manages the lifecycle: schedule, invalidate, consume.
- **Drain** — Consuming prefetched entries and appending them to the visible list when the user reaches the list end. `HomeFeedLoadMoreDrain` applies the drained entries via `HomeFeedPagination`.
- **Lean Apply** — A fast-path for appending load-more results without regrouping all entries. Used for articles and social modes where cards are simpler.
- **Load-More Request Token** — Monotonically-increasing token that cancels stale in-flight load-more requests when a new one starts.

## Refresh

- **Refresh Coordinator** (`FeedRefreshCoordinator`) — Orchestrates background feed fetching: iterates feeds, calls `RssFeedService`, upserts entries, notifies UI via `AppStorage` signals.
- **Refresh State Manager** — Tracks refresh progress: percent complete, completion count, cooldown timers. Drives the refresh progress UI.
- **Startup Refresh** — The automatic refresh triggered on app launch. Skipped if a successful refresh happened within the cooldown window.
- **Deferred Feeds-Changed Reload** — When a background refresh finishes while the user is interacting, the home reload is deferred until the user stops scrolling.

## Data layer

- **Repository** — Data-access module wrapping RDB operations. `FeedRepository` manages the `feeds` table; `EntryRepository` manages the `entries` table. Each exposes an interface (`IFeedRepository`, `IEntryRepository`) for testability.
- **RdbTable\<T\>** — Generic helper wrapping `@ohos.data.relationalStore` CRUD operations for a single table. Reduces boilerplate for predicates, inserts, updates, deletes.
- **Preference Store** — Key-value persistence via `@ohos.data.preferences`. Wrapped by `AppPreferenceService` and typed accessor classes (`SettingsStore`, `AIAssistantSettingsStore`, etc.).
- **AppStorage** — ArkUI global state bus. Keys like `feedsChangedAt`, `WindowClass`, `topAvoidArea` notify components across the UI tree.

## Architecture terms

- **Module** — Anything with an interface and an implementation: function, class, package, slice.
- **Interface** — Everything a caller must know to use a module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — The code inside a module.
- **Depth** — Leverage at the interface: a lot of behavior behind a small interface. _Deep_ = high leverage. _Shallow_ = interface nearly as complex as the implementation.
- **Seam** — Where an interface lives; a place behavior can be altered without editing in place.
- **Adapter** — A concrete thing satisfying an interface at a seam.
- **Leverage** — What callers get from depth.
- **Locality** — What maintainers get from depth: change, bugs, knowledge concentrated in one place.

## Coordinator patterns

- **Coordinator** — A focused class that orchestrates one concern (refresh, pagination, mode switching, inline search, rail). Receives state and actions through constructor interfaces.
- **Owner** (`HomeFeedSessionOwner`) — Monolithic interface (~80 members) combining `HomeFeedState` + `HomeFeedActions`. Used by older coordinators. **Prefer the split pattern for new code.**
- **State + Actions split** — A coordinator depends on two narrow interfaces: `XxxState` (observable data fields) and `XxxActions` (callable methods). Used by `HomeModeController`, `HomeInlineSearchController`. Enables narrow test fakes.
