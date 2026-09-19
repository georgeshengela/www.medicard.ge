# App Store Connect screenshots

Generated: 2026-09-15
App version: 1.0.0.8.56

## Folders

| Folder | Size | Use in App Store Connect |
|--------|------|---------------------------|
| `iphone-6.5/` | **1284×2778** | iPhone screenshot slot (App Store Connect accepted) |
| `ipad-12.9/` | 2048×2732 | iPad Pro 12.9" (3rd gen+) |
| `all/` | both sizes | All 16 PNGs in one folder (upload convenience) |

Each file uses **real Medicard UI** captures from Expo web (dark theme) inside device frames with Georgian marketing copy.

## Re-generate

Composite only (existing captures in `store/app-store-screens/_raw/`):

```bash
cd mobile && node scripts/generate-app-store-bundle.mjs
```

Fresh captures (Expo web running + credentials):

```bash
cd mobile && STORE_EMAIL=… STORE_PASSWORD=… EXPO_WEB_URL=http://localhost:8081 \
  node scripts/generate-app-store-bundle.mjs --capture
```
