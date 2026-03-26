# Livo Harmony

HarmonyOS NEXT starter app for Livo.

## Commands

Run these from the workspace root:

```powershell
pnpm doctor:harmony
pnpm dev:harmony
pnpm build:harmony:debug
pnpm install:harmony:debug
pnpm run:harmony:debug
```

Or directly inside [`apps/harmony`](/E:/Livo/apps/harmony):

```powershell
pnpm run doctor
pnpm run studio
pnpm run build:debug
```

## Current Scope

- Stage model project scaffold
- Entry ability and ability stage
- ArkUI app shell with dashboard, subscriptions, article detail, and settings pages
- Mobile-inspired bottom tab layout aligned with `Folo-dev/apps/mobile`
- Preferences + RDB based local storage
- Feed and entry repositories with seeded bootstrap data
- Subscription CRUD, local reading state, and manual refresh flow

## Open In DevEco Studio

Open the `apps/harmony` folder as a HarmonyOS project, then run the `entry` module on a phone emulator or device.

## Notes

- This scaffold is aligned to the local HarmonyOS notes and `harmony-engine` skill guidance.
- A unified CLI now lives in `apps/harmony/scripts/harmony-cli.mjs`, inspired by `Folo-dev/apps/mobile` using package scripts as the primary entry.
- Command-line build currently reaches `hvigor`, but this machine still reports `SDK component missing`, so DevEco Studio SDK Manager likely needs one or more Harmony/OpenHarmony components installed completely.
