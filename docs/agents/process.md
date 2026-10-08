# Working rules: main DB, publishing

Moved verbatim from AGENTS.md on 2026-10-08 (token diet). Read this file before working in its area; add new notes here, not in AGENTS.md.

## Main database only (owner requirement, 2026-09-24)

Always use the main MEDICARD database and https://medicard.ge API for the owner's app, Expo previews, and testing. Never switch to another database or an isolated QA backend unless the owner explicitly changes this rule. The app is prelaunch and the owner tests using existing main-database accounts. Do not copy or reset their data. Keep test writes narrowly scoped and avoid destructive changes.

## Publish completed changes (owner requirement, 2026-09-24)

After completing and verifying requested app/backend changes, commit and push the relevant finished changes to the existing Git remote so the owner can test. Check deployment when backend behavior changes. Preserve unrelated in-progress edits and never commit secrets. Report the deployed/verified state accurately.
