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

## Open items handed to other work packages
- WP-15: `wizard.css` `.wiz-search input { outline: none }` has no replacement ring on the wrapper: add `.wiz-search:focus-within` ring (2.11#12).
- WP-13: `MatchScene` should read `settings.reduceFlashes` (via `flashesReduced()` in `ui/hooks/motion.ts`) to skip `cameras.flash` and the full-screen `flash` rectangle (2.11#32); alternative control schemes and timing-window widening (2.11#18, #23) are in WP-13's input work.
- WP-17/sim: event text lives in TS (2.11#47), "he" leak test (#53), Turkish suffix helper outside narration (#51).
- WP-20: store listing texts (2.11#58). Currency stays EUR (decision in `ui/format.ts`).
