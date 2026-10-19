---
version: 1.0
name: Kickborn-site
description: |
  A night-match marketing site for Kickborn, built around one idea taken from the name: born to kick.
  The identity is the strike: the ball leaving the boot and its flight into the net, drawn as a streak
  of green light. The streak is the motif at
  every scale, from a 3D path in the night sky over the stadium to the bullet of a list. A full-screen
  WebGL stadium carries the first two screens (the hero and a playable penalty); the sections after it
  are flat fields of the game's own night palette with real in-game pictures. Pure night navy ground,
  one green action colour (the streak, the action), one gold for awards and the free-play field, white type. No gradients, no shadows
  at rest, no glass, no monospace, no eyebrows, no hairlines.
  References pulled with the getdesign CLI and read for structure and discipline: nike (photography
  speaks, chrome stays quiet, one action colour, pill CTAs, huge tight display type) and playstation
  (dark full-bleed bands that take over the page edge to edge, two-radius vocabulary, imagery 60–90% of
  a band). Values below come from the game itself (game/src/styles/tokens.css, "Gece Maçı").

colors:
  ground: "#070b14"        # night sky, page ground (game --bg-0)
  ground-raised: "#0b1220" # game --bg-1
  surface: "#131c2e"       # game --surface-1: a tone step, never an outline
  surface-2: "#1b2740"     # game --surface-2
  ink: "#f2f5fa"           # game --text-hi: all running text
  ink-soft: "#b4c0d6"      # game --text-mid: secondary notes only (≥ 4.5:1 on ground and surface)
  action: "#1fd47a"        # game --brand-pitch: the streak, BORN in the wordmark, the primary button, the selected state
  action-ink: "#04140b"    # game --text-on-pitch
  star: "#ffc83d"          # game --accent-gold: awards, the moment ring, the free-play field (name kept for the token only)
  star-ink: "#2a1a00"      # game --text-on-gold
  pitch: "#14532b"         # night grass, the moments field
  pitch-ink: "#f2f5fa"
  kit: "#c8102e"           # the hero's shirt in the game; used only inside 3D and pictures

typography:
  display:
    fontFamily: Barlow Condensed
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: -0.01em
    textTransform: none          # sentence case; the app's caps stay inside its own screenshots
    fontSize: clamp(3.25rem, 1.6rem + 6.2vw, 9rem)
  head:
    fontFamily: Barlow Condensed
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: -0.005em
    fontSize: clamp(2.5rem, 1.5rem + 3.6vw, 5.5rem)
  lead:
    fontFamily: Inter
    fontWeight: 500
    lineHeight: 1.35
    fontSize: clamp(1.25rem, 1.1rem + 0.6vw, 1.75rem)
  body:
    fontFamily: Inter
    fontWeight: 400
    lineHeight: 1.55
    fontSize: clamp(1.0625rem, 1rem + 0.2vw, 1.1875rem)
  small:
    fontFamily: Inter
    fontWeight: 500
    lineHeight: 1.45
    fontSize: clamp(0.875rem, 0.85rem + 0.1vw, 0.9375rem)

rounded:
  none: 0px
  full: 9999px   # dots, buttons, the moment frame, pills of the switch

spacing:
  gutter: clamp(16px, 3.2vw, 56px)   # the one pair of outer margins, every width
  gap: clamp(16px, 2vw, 32px)
  section: clamp(96px, 12vw, 220px)  # between sections; always larger than any gap inside one

components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.small} at 1rem, weight 600"
    rounded: "{rounded.full}"
    height: 52px
    padding: 0 28px
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.full}"
    height: 52px
  dot:
    backgroundColor: "{colors.action}"
    rounded: "{rounded.full}"
    sizes: [0.42em list bullet, 18px score HUD, the timer dot on the moment ring]
  moment-frame:
    shape: circle
    image: real in-game frame, object-fit cover
    ring: 0.9em solid "{colors.star}" (the in-game action button's ring)
---

## Overview

**Round 2: one world.** The whole page now sits over a single WebGL night world the camera travels
through as you scroll (igloo.inc's principle): from the stars over the stadium, down over the crowd to
the penalty spot (the game), along the touchline (key moments), through the players' tunnel into the
dressing room (career), out to the city at night (life off the pitch), up over the city and the
stadium (fair play, platforms), and up over the lit stadium for the close (footer). Sections are overlays anchored to stops on that path. Text always sits on a calm zone: over
sky, or on a neutral scrim panel `rgb(7 11 20 / 0.8)` (the scrim is the one exception the house rules
allow under text on a picture), never on busy geometry. Without WebGL the page falls back to the flat
fields described below.


The name is the brief: Kickborn, born to kick. The hero is the footballer and the strike. The first
screen is a low camera beside the penalty taker: he runs up and strikes, and the ball flies into the
top corner on a streak of green light while the keeper goes the wrong way, again and again. As the
visitor scrolls, the camera moves behind the ball and the same kick becomes theirs: the aim
line of a penalty the visitor takes with a thumb, a mouse or the keyboard. After that the page is a run
of flat, full-bleed fields in the game's palette, each carrying real pictures from the game.

**Key characteristics**
- Full-bleed at every width (320px to ultrawide): fields run edge to edge, the grid stretches, only text
  measures are capped (in `ch`). No centred max-width container.
- One action colour (`{colors.action}`) for the streak, the primary button and the selected state. Gold
  (`{colors.star}`) is for awards, the moment ring and one field.
- Display type is Barlow Condensed 700 in sentence case, very large, tight; text is Inter. Two faces.
- Pictures are the game's own: live match frames captured from the game, crops of real screens, one
  raw gameplay clip. No stock, no renders presented as the app.

## Colors

### Brand
- **Action** `{colors.action}` `#1fd47a`: the strike streak, BORN, the primary button, the active list marker.
- **Gold** `{colors.star}` `#ffc83d`: the moment ring, the free-play field. Never a button
  label colour on the ground.

### Surface
- **Ground** `#070b14` is the page and the night sky (the WebGL clear colour is the same value, so the
  canvas and the page are one surface).
- **Surface** `#131c2e` and **Surface 2** `#1b2740` separate areas by tone. No outlines, no shadows.
- **Pitch** `#14532b` is the field behind the key-moments section.

### Text
- Running text is `{colors.ink}` at full strength. `{colors.ink-soft}` is only for secondary notes.
- On green and gold fields text is the field's own dark ink (`action-ink`, `star-ink`).

## Wordmark

KICKBORN in Barlow Condensed 700 caps: KICK in `{colors.ink}`, BORN in `{colors.action}`, as in the game's
logo. It is a brand asset (the bar and the footer), not a styled headline word; headlines stay one colour.
There is no symbol: the wordmark is the mark. The icon slots (favicon, touch icon, OG image) carry the
wordmark stacked KICK / BORN until the chosen Kickborn key art replaces them (`public/media/brand/`).

## Typography

- Display (hero, section titles): Barlow Condensed 700, sentence case, line-height 0.92, two lines at
  most at every width. The hero title is `{typography.display}`, section titles `{typography.head}`.
- Text: Inter 400/500/600. Body 17–19px, line-height 1.55, 45–70ch.
- Five sizes on the page: display, head, lead, body, small. Nothing below 14px.
- Both faces are self-hosted from @fontsource (OFL), latin + latin-ext only, so Turkish (ğ, ş, ı, İ)
  never falls back.

## Layout

- 12 columns, `{spacing.gutter}` outer margins on both sides, equal at every width.
- Sections are `{spacing.section}` apart, or butt edge to edge when they are fields of colour.
- Neighbouring sections never share a composition: sky title over a 3D scene → a 3D game with a HUD →
  a field with a giant control → a 50/50 split with a slider → a tile board → two unequal fields →
  a row of three tiles → the wordmark built large over the lit stadium.

## Elevation & Depth

Flat. Depth comes from the WebGL scene only. Surfaces step in tone. The only shadow on the page is on
the result panel of the penalty game, which floats over the 3D scene.

## Shapes

- `{rounded.full}` for buttons, dots, the moment frame and the switch; `{rounded.none}` for every
  field, tile and screenshot frame. Two radii, nothing in between.
- The motif: the strike streak, a ribbon of green light from the boot to the net. It runs in the
  hero's looping kick, behind every penalty the visitor takes, and on the tactics board in the
  dressing room. Round dots stay only as plain UI (list marker, score dots, the moment timer).

## Components

### Buttons
Primary: green pill, dark ink, 52px tall. Secondary: white pill on dark fields. One primary action per
screen. Store badges are not links while the stores are not live: they read "App Store, coming soon".

### The live penalty
A full-screen 3D scene with a quiet HUD: the title and one paragraph top-left, the score as five dots
top-right (green = goal, white = miss), the result word large in the middle for a second, the power
meter only while charging. Swipe, mouse drag, or arrows + Space. Five kicks then a summary panel.

### Moment frame
A circle (the dot at poster size) holding a real in-game frame, ringed in gold like the game's SHOOT
button. Its label sits under it in the game's own words.

## Do's and Don'ts

### Do
- Use real pictures from the game at large size; caption them with what they are.
- Keep every headline to two lines at every width; test 320px.
- Let the strike carry the identity: the streak, the boot, the ball into the net.
- Let fields run to the screen edges at 2560px and wider.

### Don't
- No gradients on UI, no glass, no glows, no shadows at rest, no hairlines, no eyebrow labels, no
  monospace, no index numbers, no emoji.
- No invented reviews, ratings, download counts or press. No store links until the stores are live.
- Don't style one word of a headline differently.
- Don't use violet (the game's `--accent-violet` stays inside the game).

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| ultrawide | 1920px+ | Fields stay full-bleed; type keeps scaling up to its clamp ceiling; margins grow to 56px |
| desktop | 1440px | Reference layout |
| tablet | 768px | Splits stack where a half would be under 360px; the board goes to two columns |
| phone | 390px | One column; the moment frame comes first; the HUD keeps the ball zone free for the thumb |
| narrow | 320px | Same as phone; headline sizes come down to their floor |
| landscape phone | 844×390 | The penalty camera widens so the goal fits; HUD text shrinks to small |

### Touch targets
Every control is at least 44×44px; buttons 52px. The penalty's swipe zone is the lower 70% of its
screen, so the page can still be scrolled from the top band on a phone.

### Motion
Camera and entrances follow `prefers-reduced-motion`: with it on, the camera cuts between its two
positions, the hero is a still of the strike (streak drawn, ball in the net), entrances are opacity
only, the moments do not auto-advance, the clip shows its poster.

## Iteration Guide

Change tokens here first, then `src/styles.css` `:root`. Words live in `content/copy.json` (TR, EN);
`scripts/render.mjs` writes both pages from `index.template.html`.

## Known Gaps

- The 3D figures are deliberately simple capsules; they are a stylised stand-in, not the game's art.
- The store badges point nowhere until the App Store and Google Play listings are live.
