Stadium Studio is a working name. When the channel has its real name, change it here, in the index title and on the cover; nothing else names it.

The channel makes short vertical videos about real places: stadiums first, then landmarks. Every video pairs a clean 3D model with a surprising, provable fact. The brand is a night-time blueprint: deep navy ground, crisp white measurements, and glowing cyan lines for anything that moves.

## Content fundamentals

- **Every number is real and sourced.** Put the source in the description or as a fact line (`MTA DATA`, `LIBRARY OF CONGRESS`). If a number can't be sourced, leave it out.
- **Plain words, short lines.** Write the way you'd explain it to a friend at the game: "There's a train station under this arena." No hype words ("insane", "mind-blowing").
- **Case:** on-video titles and labels in capitals (`PENNSYLVANIA STATION`, `314 FT`). Descriptions and captions in sentence case.
- **Units:** feet for US places (`423 FT ACROSS`), with meters only when the source gives meters. Dates as `NOV 27, 1910` on video, "November 27, 1910" in text.
- **Voice:** first person singular for narration ("I measured...") and second person for the hook ("You've walked over this...").
- **No emoji** on video or title cards. Hashtags only in the post caption.
- **Credits:** archive photos carry "Library of Congress, Prints and Photographs Division." AI-made shots, if any, get the platform's AI label switched on.

## Visual foundations

**Color**
- Ground is `night-900`; panels and cards sit on `night-800`; hairlines are `line`.
- Text is `ink`; secondary text and source lines are `muted`. Both pass 4.5:1 on `night-900` and `night-800` in both themes.
- `glow-cyan` is the signature: outlines of the building, flowing train lines, arrows. Use it for the one thing the viewer should follow.
- `glow-gold` only pairs with `glow-cyan` (a second flow line, the opposite direction). `gold` is the short rule under a title, nothing else.
- `granite` marks the past in then-vs-now videos (1910 labels, the old building's outline). Never use it for today.
- `white` with `label-stroke` behind it for every measurement and leader line drawn over the 3D picture.
- `signal-red` only for recording and LIVE marks.
- `navy` is the block color for blueprint sheets, cover blocks and end cards.

**Type**
- Titles in the display family, capitals, tight: `video-title` for title cards, `layer-title` for labels on the picture, `layer-title-small` when a second label shares the frame.
- Measurements in `dimension` (display family, wide letter spacing, about 0.08em).
- Fact lines under a label, eyebrows and all numbers that line up in `fact-line` and `eyebrow` (mono family, tabular figures).
- Body copy (descriptions, the website later) in `body`.
- Load the three families from Google Fonts: Barlow Condensed 500/600/700, Barlow 400/500/600, IBM Plex Mono 400/500.

**Layout on a 1080 × 1920 video**
- Keep words out of the apps' zones: the top 8%, a right column 15% wide from 36% to 80% of the height, and the bottom 20%.
- Labels sit at the left (6% in) in three slots: top at 16% of the height, mid at 42%, low at 64%. One label per slot.
- The building gets the middle of the frame. Leader lines run from the label's underline to a dot on the exact spot it names.
- Captions (one word at a time, from CapCut) sit just above the bottom zone, centered. They are never part of the design layer.

**Motion**
- The design layer draws itself on: each item starts 0.28 s after the one before and takes 0.7 s. Lines grow first, then text fades in.
- Flow lines move their dashes about 42 px per second; arrows drop at about 36 px per second.
- Then-vs-now switches take 2.4 s with an ease in and out: today sinks while the past rises in the same spot, from the same camera.
- Camera moves are slow in, slow out. Orbits of 360° are linear so they loop.

**Shapes and borders**
- Cards: `radius-lg`, a `line` border, no drop shadows on video. Buttons and label boxes: `radius-md`.
- Dimension lines end in short ticks, never arrowheads. Arrowheads are only for flow and drops.

## Logo

There is no logo yet. Set the name in the display family at 700, capitals, with the `gold` rule under it. Don't draw a mark until the real name is chosen.

## Iconography

No icon set and no emoji. The picture carries the meaning: outlines, measured lines, flowing lines and labels. When a symbol is unavoidable (a recording dot), use a plain shape in its token color.

## Components

- `LayerLabel`: a title, fact lines and a leader line to the spot it names.
- `Dimension`: a measured line with ticks and a value.
- `FlowLine`: a glowing dashed line for trains, crowds or loads, with an optional arrow.

All three are drawn by Stadium Studio's design layer (`stadium-studio/engine/layer.js`); these cards show how they look and when to use them.
