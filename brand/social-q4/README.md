# MEDICARD social, 5 Oct – 31 Dec 2026

Module-oriented posters with real app screens + the MEDIRUN „გაანათე თბილისი“ campaign (economy 2 rules).
2–3 items a day: one feed post (module or MEDIRUN) and one or two MEDIRUN stories; LinkedIn every other Tuesday.

| file | what |
|---|---|
| `copy_common.py` | download block (App Store + medicard.ge + Android soon), hashtags, MEDIRUN facts (waves, ladder, levels) |
| `copy_run.py` | every MEDIRUN post/story: launch, Monday weeks, wave stories, Saturday rain + riddles, Sunday prizes, tips, countdown |
| `copy_modules.py` | module posts (Medi, MEDIPILL, MEDIFOOD, MEDICYCLE, MEDILAB, MEDISCAN, MEDIQUEST, MEDIVET, MEDICOACH, MEDICARD) |
| `plan.py` | calendar (`SCHEDULE`, `RESERVE`, LinkedIn) → `plan.json` + `social.json` (admin #/social rows + Metricool payloads) |
| `poster.html` | all templates (feed 1080×1350, story 1080×1920); `window.render(spec)` |
| `render.py` | `plan.json` → `out/feed`, `out/story` (1440×1800 / 1080×1920 JPEG) + `out/web` (720 px review copies) |
| `pulls.json` | callout cards cut from the real screens (`r` = x, y, w, h in the 390-wide CSS frame) |
| `screens/` | real app screens (react-native-web against a mock API, 390×797 @3x, Georgian, test personas ნინო / გიორგი) |
| `build_review.py` + `review_template.html` | the owner's review page (Artifact with a `db` capability: ✓ / შესაცვლელი / ამოვიღოთ + note per post) |

```bash
python plan.py && python render.py && python build_review.py
```

Brand: module colours from `mobile/src/theme/moduleBrand.ts`, wordmarks Exo 2 with the module part skewed −16°,
big headlines Archy (brand display face), text FiraGO, logo ornament −14°, „App Store · medicard.ge“ on every image.
Captions: შენ, real facts only, Medi / MEDISCAN never diagnose, every caption carries the App Store link and medicard.ge.

Edit scripts with Georgian text from files (Write tool), not from bash heredocs: Git Bash collapses `\\` in heredocs.

Screens: `harness/` is the mock API + Expo-web screenshot rig (fixtures with test personas; never calls medicard.ge).
Start it with `restart-mock.ps1 -Port 4519 -Persona man` and `restart-web.ps1 -Port 8097 -Api http://localhost:4519`,
then `node snap.mjs <name>` (writes `screens/<name>.png`) and convert the PNG to `screens/<name>.webp` (quality 92).
