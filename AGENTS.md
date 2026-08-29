# Medicard.GE agent notes

## Product naming

The in-app AI is **Medi**. Never write Nightingale in user-facing copy (chat titles, CTAs, bubbles, share toggles). Nightingale is only the Figma UI kit name.

## Home hub sections

A home block is **title, then content**. The section name sits **above** the card — never inside it. Match შემდეგი მიღება / წონის კონტროლი / აქტიურობა.

```tsx
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';

<View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
  <HomeSectionTitle title={ka.home.nextDose} />
  {/* card / slider / chart — no repeated section title inside */}
</View>
```

Do not put the hub title in the card header. Card chrome can still show metric names (e.g. წონა on the weight sparkline card).

## Mobile modals

Transparent overlays **fade**. Never `animationType="slide"` — that slides the dim and leaves an ugly transparent hole.

```tsx
import { APP_MODAL_PROPS } from '@/components/ui/appModal';

<Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
```

Spread `APP_MODAL_PROPS` on every overlay Modal. Opaque full-screen takeovers (e.g. cycle onboarding) may stay `transparent={false}`. Dim color: `APP_MODAL_OVERLAY`. Keep the scrim as a **sibling** of the sheet, not a parent wrapping it.

## Dark theme

Dark is **cool gray-950 navy**, not teal charcoal. Keep `global.css` `.dark` and `src/theme/colors.ts` `darkColors` in sync.

| Token | Hex | Role |
| --- | --- | --- |
| `bg100` | `#030712` | Page / tab canvas |
| `surface` | `#111827` | Cards, auth screens |
| `surfaceRaised` / `bg200` | `#1F2937` | Sheets, inputs, chips |
| `bg300` | `#374151` | Borders, tracks |
| `text100` / `text200` / `text300` | `#FFFFFF` / `#D1D5DB` / `#6B7280` | Heading / body / placeholder |
| `primary200` | `#14B8A6` | Links, icons, brand |
| `primary100` | `#99F6E4` | Brand text on dark |
| `accent100` | `#042F2E` | Brand tint fill (avatars, welcome hero) |

Filled dark CTAs use `#0D9488` (`FIGMA_AUTH_DARK.primaryBg`), not `#14B8A6`. Auth screens sit on `bg-surface`. Google on dark is a **white** fill with dark label. Do not invert the stack (page stays darker than cards).

On every mobile change, update `mobile/app.json` `expo.version`:

- **Small** feature/fix → bump patch (`x.y.Z` + 1)
- **Big** feature / system → bump major (`X.0.0`)

See `MEMORY.md` for details.
