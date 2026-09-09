# Cycle Phase 9 — prediction history Journal QA

Synthetic fixtures only. Account: `cycle.qa.phase6@medicard.ge` / `CycleQaPhase6!`

```
cd server
node scripts/cycle-phase9-qa-seed.js --state=empty
node scripts/cycle-phase9-qa-seed.js --state=one
node scripts/cycle-phase9-qa-seed.js --state=two
node scripts/cycle-phase9-qa-seed.js --state=three-plus
node scripts/cycle-phase9-qa-seed.js --state=revised
node scripts/cycle-phase9-qa-seed.js --state=exact
node scripts/cycle-phase9-qa-seed.js --state=earlier
node scripts/cycle-phase9-qa-seed.js --state=later
node scripts/cycle-phase9-qa-seed.js --state=gap
node scripts/cycle-phase9-qa-seed.js --state=open
```

Android capture list (this folder):

1. `01-history-empty.png`
2. `02-history-one-episode.png`
3. `03-history-two-episodes.png`
4. `04-history-three-plus.png`
5. `05-history-expanded.png`
6. `06-history-revised-prediction.png`
7. `07-history-exact-date.png`
8. `08-history-earlier.png`
9. `09-history-later.png`
10. `10-history-dark.png`
11. `11-history-large-text.png`
12. `12-history-small-screen.png`

`--state=gap` must **not** show a 70-day miss.
