# ქალების სივრცე

Native route: `/community`. Entry: female account → Profile → ქალების სივრცე. No additional bottom tab. Admin: `#/community`.

## Access and anonymity

- Server rechecks an authenticated ACTIVE account with `gender=FEMALE`. This is self-declared profile eligibility, not verification of someone's gender.
- Community membership requires a separate public nickname and explicit acceptance of versioned rules. Existing medical/cycle records are never imported into posts or sent to AI for moderation.
- Posting and commenting default to the community nickname, with explicit anonymous selection. Responses are allowlisted: no account ID, email, real name, medical data or original image bytes. Named posts show only the chosen community nickname.
- The backend retains authorship for ownership, blocking and moderation. Do not promise anonymity from the operator. Moderation screens also mask anonymous names. Support contact: support@medicard.ge.
- Replies by the author of an anonymous post are forced anonymous by the server. Other participants choose their own anonymity independently.
- Photos are authenticated, not public URLs. Server decodes and re-encodes a bounded image, strips EXIF/GPS, limits decoded pixels and dimensions, and stores a JPEG. Images appear in device memory; no public upload bucket is introduced. Users can still reveal themselves in text/photos or take screenshots; onboarding explains this.
- Blocking is bidirectional across posts, images, comments and notification delivery. Users unblock via opaque block IDs without learning an anonymous identity.

## Publishing and moderation

New posts/comments publish immediately. Named posting is the default; anonymous posting is an explicit choice. Reports, blocks, moderator removal and account suspension remain available; there is no external AI transmission. Editing hidden content does not republish it. Authors see their own pending/hidden items. Other members see only published content from active, unbanned members.

Reporting, blocking, own-content deletion, approval, hiding, suspension and restoration are implemented. Content deletion cascades to dependent reactions, images, reports and notifications. Account deletion cascades through User foreign keys. Audit records contain action, internal target ID and reason; moderators should not put personal/health information in reasons.

Assign `COMMUNITY_VIEW` and `COMMUNITY_MANAGE` only to appropriate admins (existing legacy full-access admins retain access). Before public launch, assign real people to review the queue and respond promptly to reports; software alone is not an operational moderation service.

## Reactions and notifications

One reaction per member/post: like, dislike, or none. Repeated PUT is idempotent. Post/comment requests use per-user idempotency keys. In-app notifications are persisted separately from push permissions, with read state and post deep links.

Push is a durable database outbox. The release hook installs the schema before startup. The worker runs by default; `COMMUNITY_ENABLED=false` disables external push delivery in isolated QA. It rechecks recipient eligibility, membership, preference, blocks and content visibility. Notifications use generic text, never names or post/health content on the lock screen. Existing active Expo tokens are reused. Transient failures retry with a capped attempt count. Expo acceptance does not prove the OS displayed a banner; crash recovery is at-least-once delivery, not an exactly-once guarantee.

## Installation

From `server`: install dependencies, run `node scripts/install-community.mjs` against the intended database, then regenerate Prisma as part of the normal server build. Never use `db push` on production. Apply the privacy policy update and deploy the server/admin before releasing the mobile version. The additive SQL is in `server/prisma/community.sql`; schema models mirror the tables.

The existing production iOS 1.11.9 (19) is unchanged. This new feature is source version 1.0.0.11.10 / iOS 1.11.10 and needs a new build after verification. Update App Store UGC/age-rating/privacy answers and reviewer notes to describe moderated posts, reports, blocks and account-linked anonymity. Do not claim approval is guaranteed.

## Verification

Unit: `node --test src/lib/community.test.js src/lib/communityPush.test.js` in server.
The local development workspace contains isolated HTTP and browser QA evidence. Test credentials and authentication tokens must never be committed. Remote push banners and iOS keyboard behavior require physical-device verification; Expo Web is not proof of either.

Reference: https://developer.apple.com/app-store/review/guidelines/#user-generated-content

## Discussions and realtime (2026-09-24)

Posts/comments publish immediately. Replies link to a parent comment from the same accessible post; deleting a parent keeps the reply but removes its link. Comment likes and eight mutually exclusive post reactions are idempotent. The existing legacy numeric reaction API remains compatible.

Authenticated Socket.IO namespace `/community` sends empty invalidations after committed writes; HTTP reloads re-check membership, mutual blocks and publication status. Tokens expire, suspended members are disconnected, and events contain no content or identifiers. Reconnect, app foreground and 30-second reconciliation recover missed events. Immediate fan-out is per server instance; horizontal scaling requires a shared Socket.IO adapter. The 30-second fallback is not a substitute for that adapter at scale. Admins receive an invalidation in their existing privileged room.

Bundled reaction artwork: Google Noto Emoji animations, CC BY 4.0, attribution in `mobile/assets/community/reactions/ATTRIBUTION.md`. Static PNG fallbacks respect reduced motion; animations play once in the picker.

Regression checks: `node --test server/src/lib/community.test.js server/src/lib/communityPush.test.js`, `node mobile/src/lib/communityThreads.test.ts`, and `npm run typecheck`. The integration runner `server/scripts/verify-community.cjs` requires `COMMUNITY_QA_SESSION_FILE` pointing to isolated test tokens and intentionally connects only to localhost:4360. It must never be pointed at real user accounts.
