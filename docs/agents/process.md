# Working rules: main DB, publishing

Moved verbatim from AGENTS.md on 2026-10-08 (token diet). Read this file before working in its area; add new notes here, not in AGENTS.md.

## Main database only (owner requirement, 2026-09-24)

Always use the main MEDICARD database and https://medicard.ge API for the owner's app, Expo previews, and testing. Never switch to another database or an isolated QA backend unless the owner explicitly changes this rule. The app is prelaunch and the owner tests using existing main-database accounts. Do not copy or reset their data. Keep test writes narrowly scoped and avoid destructive changes.

## Publish completed changes (owner requirement, 2026-09-24)

After completing and verifying requested app/backend changes, commit and push the relevant finished changes to the existing Git remote so the owner can test. Check deployment when backend behavior changes. Preserve unrelated in-progress edits and never commit secrets. Report the deployed/verified state accurately.

## Mobile regression tests (2026-10-11)

Run from `mobile/`: `node --test src/lib/releaseCrashRegressions.test.js tests/*.cjs`. A fresh worktree needs `mobile/node_modules` and `server/node_modules` (`pulse-native` loads the server's zod schema); without them the failures are missing modules, not code.

This machine checks out CRLF (`core.autocrlf=true` in the system gitconfig) while git stores LF, and a file an agent just wrote can still be LF on disk — so a source guard can pass for its author and fail in every fresh checkout. Source-reading tests normalise what they read (`.replace(/\r\n/g, '\n')`) and compare paths with `/` (`.replace(/\\/g, '/')`); never write a guard whose regex needs a raw line ending. Before calling a guard failure a regression, rerun with CRLF stripped to separate line endings from real code changes.
