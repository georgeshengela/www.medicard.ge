# DB drop candidates

The owner decides every DROP. Nothing on this list has been dropped. Cleanup work only removes code, UI and routes. Tables stay until the owner approves in writing.

Last reviewed: 2026-09-27 (Phase 1 cleanup).

| Table / model | Status | Why it still exists | Safe to drop when |
| --- | --- | --- | --- |
| `MediCompanionProfile` | **Not droppable yet** | The Companion UI is deleted, but `/api/medi-companion` (`server/src/lib/mediCompanion/service.js`) still backs the MEDI QUEST hub. `mobile/src/hooks/useQuestJourney.ts` reads overview/journey and writes equipment through it. | Quest journey/equipment is moved to its own storage and `useQuestJourney` stops calling `/api/medi-companion`. |
| `MediJourneyUnlock` | **Not droppable yet** | Same as above: journey unlocks are the Quest progress seal's history. | Same as above. |
| `Package` | Keep | AGENTS App Review note: historical billing rows are kept for data integrity and older API compatibility. `/api/app/status` still returns `packages`, and admin user investigation still lists them. | Never, unless every client that reads `packages` is retired and the owner approves. |
| `RewardDefinition` rows `MEDI_PREMIUM_DAY`, `MEDI_PREMIUM_3D` | Archived (rows kept) | Removed from the active catalog, and `ensureRewardDefinitions` archives them. Ledger and redemption rows still reference them. | Rows can stay forever; they are inert. |

## Compatibility redirects intentionally kept

These are 5-line `Redirect` screens, not data. They stay because admin push campaigns can carry any free-form `route` (`routeFromNotificationData` honours `data.route`). A notification already sitting in someone's tray could still point at these routes.

- `mobile/app/package/index.tsx` → `/profile`
- `mobile/app/medi-companion/{index,journey,collection}.tsx` → `/medi-quest`
