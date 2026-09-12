# Medi World Phase 40 QA evidence

Android: Expo Go on `emulator-5554`, local API `10.0.2.2:4000`, disposable Postgres `127.0.0.1:54329` only.

QA login: `world.qa@medicard.test` (local disposable user).

Required screens:

| File | State |
| --- | --- |
| `ka-care-space-light.png` | Georgian Care Space, Spark, Bond 1 |
| `ka-care-space-lower.png` | Compact layout, stages + collection |
| `ka-care-space-dark.png` | Georgian dark (cool gray-950) |
| `en-care-space-light.png` | English Care Space |
| `en-care-space-dark.png` | English dark |
| `spark.png` | Default Spark stage, World level 1 |
| `glow.png` | Glow presentation |
| `bloom.png` | Bloom presentation |
| `pulse.png` | Pulse, World level 20 |
| `guardian.png` | Guardian, World level 35 |
| `radiant.png` | Radiant (subtitle duplicate; superseded by corrected shots) |
| `radiant-ka-corrected.png` | Georgian Radiant subtitle: გაღვიძებული თანამგზავრი |
| `radiant-en-corrected.png` | English Radiant subtitle: A fully awakened care companion |
| `bond-progress.png` | Bond 1 progress vs World level |
| `ka-care-moment-before.png` | Care Moment sheet before completion |
| `ka-care-moment-after.png` | Care Moment already completed today |
| `catalog.png` / `en-catalog.png` | Cosmetic catalog, honest level locks |
| `locked-cosmetic.png` / `insufficient-energy.png` | Locked hydration, balance 0 |
| `unlock-confirm.png` | Server price, balance 40 → 10 |
| `unlock-success.png` | Real unlock, resulting hydration 10 |
| `equipped-cosmetic.png` | Hydration wave owned and equipped |
| `medi-world-companion-card.png` | Medi World hub Care Space card |
| `stage-selector.png` | Unlocked vs locked stages |
| `evolution-celebration.png` | Glow unlock celebration, World level 5 |
| `evolution-celebration-reduced-motion.png` | Gray dismiss (reduced motion) |
| `reduced-motion.png` | Animation scales 0, static presentation |
| `font-1_3.png` | ~1.3× font on Care Space |
| `offline-cached.png` | Airplane + cached Care Space |
| `retry-recovery.png` | Airplane off, Care Moment usable again |
| `compact-layout.png` | Compact Care Space |

Emulator settings were restored (font 1.0, night no, animation scales 1, airplane off, adb reverse 4000/8081).
