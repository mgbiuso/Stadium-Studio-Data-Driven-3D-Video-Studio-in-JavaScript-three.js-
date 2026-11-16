# How Stadium Studio is put together

```
stadium-studio/
  index.html          the page: loads everything below, in order
  engine/studio.css   the look of the panels and buttons
  engine/core.js      shared building blocks: materials, seating tiers, walls, roofs, trees, ground
  engine/app.js       every visual style, cameras, lights, buttons, the drawing loop
  venues/yankee.js    one recipe per venue
  venues/msg.js
  data/msg-data.js    real-world data for a venue (made by data/fetch_venue.py)
```

The engine never changes when you add a venue. Every style (Daylight aerial, the iso icons,
Cutaway, Blueprint and the rest) works on any venue automatically.

## Add a venue

1. Get its data: see `data/README.md`.
2. Copy `venues/msg.js` to `venues/<name>.js` (or `yankee.js` for an open-air ballpark).
3. Change the outline, heights and details to match the photos in `real photo references/<name>/`.
4. Add one line to `index.html`, after the other venues:
   `<script src="venues/<name>.js"></script>`
   (and, if it has data, `<script src="data/<name>-data.js"></script>` near the top).
5. Open the page. The new venue gets its own button automatically.

## What a venue recipe sets

| Setting | What it does |
|---|---|
| `newVenue(key, {...})` | Name, short facts, center, the cut lines for Cutaway, and the Blueprint title block |
| Groups `base`, `lower`, `middle`, `upper`, `crown`, `roof`, `under` | The layers Exploded lifts apart |
| `V.shell`, `V.annex`, `V.city`, `V.lot` | The outer wall, attached buildings, the neighborhood, and the iso icon's lot |
| `V.camOv` | Camera angles that suit this building |
| `V.EXP` | How far each layer lifts in Exploded |
| `V.labels` | Labels for Exploded and the half-slice Cutaway |
| `V.layers` | Design layer sets for videos (see below) |

## Design layer sets

Each venue lists its sets in `V.layers`. Each set has a `key`, a button `name`, and `items` drawn in order (each one draws itself on about 0.3 seconds after the one before). Points are in the venue's model coordinates (meters); add `space:'world'` for points in a real-world city map, like Yankee Stadium's 4 train.

| Item `type` | What it draws | Main settings |
|---|---|---|
| `outline` | A glowing outline | `circle:[x,z,r]` or `pts:[[x,z],...]`, and height `y` |
| `span` | A width line across a round building | center `c:[x,y,z]`, radius `r`, `text` |
| `height` | A height line at the building's left edge | `c:[x,z]`, `r`, `y0`, `y1`, `text` |
| `dim` | A measured line between two points | `a`, `b`, `text` |
| `path` | A glowing line; `flow:true` makes dashes run along it | `pts`, `color` (`cyan` or `gold`), `dir` |
| `drop` | A dashed arrow, like street to tracks | `a`, `b` |
| `label` | A title and fact lines with a leader line to a point | `p`, `slot` (`top`, `mid`, `low`), `title`, `sub` |

Rule: every number in a label comes from the venue's data or a source written in a comment next to it.
