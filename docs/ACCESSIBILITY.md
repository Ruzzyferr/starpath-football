# Accessibility and localization checklist (WP-19)

Run before each release. Automated items run in CI (`npm test`, `npm run lint:i18n`, `npm run e2e`).

## Automated
- [x] Token contrast WCAG AA (4.5:1 text, 3:1 non-text) in every palette: `src/ui/a11y/contrast.test.ts`
- [x] Good/bad pairs distinguishable in grayscale (lightness ratio >= 1.25): same file
- [x] axe (wcag2a/aa, 21a/aa) 0 serious/critical on 20+ screens: `e2e/a11y.spec.ts`, `e2e/a11y-wp19.spec.ts`
- [x] TR/EN key and placeholder parity: `src/i18n/i18n.test.ts`
- [x] No literal UI strings in `src/ui/**/*.tsx`: `npm run lint:i18n` (frozen baseline 0; `// i18n-ok` for brand marks)
- [x] Pseudo-locale (`?pseudo=1`: accents + 35% longer) shows no overflow or clipped text at 390px
- [x] 200% text scale: no horizontal overflow; type is rem-based so OS/browser font size is honoured
- [x] Tabs: arrow keys + roving tabindex

## Settings (Settings > Accessibility)
Colour-blind palettes (3) with pattern masks (stripes/dots), high contrast, reduce motion, low FX,
disable flashes (`data-flash`), sound captions, text size 90-200%, left-hand / one-hand / touch scale, key rebinding.

## Manual screen-reader scenario (NVDA/VoiceOver/TalkBack)
1. Title: heading and "New career" / "Continue" read as buttons. Language switch announced.
2. Home: landmarks (main, nav). Tiles read "label, summary". Advance button announces result via the toast live region.
3. Planner: slots are buttons with names; tabs announce "tab, selected, n of m"; arrow keys move.
4. Live match: score bug is a labelled group; the feed is `role=log` (polite); goals and red cards are announced
   assertively (`data-testid=lm-announce`); decision moment is an `alertdialog` with the primary action focused.
5. Modal: focus trapped, Esc closes, focus returns to the opener. Errors toast as `role=alert`.
6. Post-match: ratings are text + number, never colour alone.

## Hand-offs (closed) and deferred
- Closed: `.wiz-search:focus-within` ring (wizard.css); MatchScene honours `noFlash`/reduced motion (`cameras.flash`, flash rectangle) and shake; timing assist (`timingMult`, slower power meter) and touch/gamepad/key-rebind control schemes are tested in `src/game/controls.test.ts`; Turkish suffix helper `sim/career/trSuffix.ts` covers event text; gender-alternative tests in `sim/life/events/content.test.ts`.
- Deferred (needs real devices or humans): screen-reader session on NVDA/VoiceOver/TalkBack (2.11#13); OS font-scale check on Android/iOS (#6); moving event text out of TS and professional translation/review (#47); store listing copy review (#58, draft in `docs/store/LISTING.md`).
- Decision: currency stays EUR (`ui/format.ts`).
