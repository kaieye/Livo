# Harmony UI Layout Notes

## Source

This note is based on the mobile app structure under `E:\Livo\Folo-dev\apps\mobile`.

## Folo mobile layout principles

1. Content-first pages
   Home is an entry list, not a dashboard. Subscription and discover pages are also list-first.

2. Floating bottom navigation
   The tab bar is an overlay that floats above the content area. The scroll container always reserves bottom inset for it.

3. Search-first discover page
   Discover starts with search, then mode switching, then result groups.

4. Grouped cards over scattered panels
   Lists are usually rendered as a single grouped surface with separators, instead of many unrelated cards.

5. Clear page rhythm
   Each page follows a stable rhythm:
   header -> controls -> grouped list -> secondary grouped list

6. Settings hero
   Settings starts with a strong header banner, then switches into grouped configuration sections.

## Harmony mapping

1. `pages/Index.ets`
   Reduced the dashboard feel and moved to a content-first list with compact metrics, search, and grouped entries.

2. `pages/Subscriptions.ets`
   Reworked feed management into:
   editor card -> grouped subscription list -> grouped entry list

3. `pages/Discover.ets`
   Reworked discover into:
   search panel -> result summary -> category rail -> grouped feed results -> grouped entry results

4. `pages/Settings.ets`
   Added a hero card and grouped setting sections to better match the Folo mobile hierarchy.

5. `common/components/BottomTabs.ets`
   Kept the bottom bar floating and made the tab items more compact and icon-first.

## Follow-up direction

1. Build a shared safe-area page shell for Harmony tab pages.
2. Add a consistent grouped-list component to reduce duplicated row and divider code.
3. Add header scroll behavior for settings and discover.
4. Continue aligning detail pages and search interactions with the same visual system.
