A glowing dashed line whose dashes move, for anything that flows: trains, crowds, loads.

**Use it** for the motion a video is about: trains under the arena, the 4 train on its elevated track, fans leaving the Garden. One color per direction: `glow-cyan` first, `glow-gold` for the second line or the opposite direction.

**You provide**
- `pts`: the path through the scene.
- `color`: `cyan` or `gold`; `dir`: 1 or -1 for which way the dashes run.
- Optional `drop` arrows from the street down to the line (dashed, with an arrowhead).

**Look**: a 3.2px dashed core (14 on, 16 off) with a soft glow of the same color, over a faint 7px band at 20% opacity. Dashes move about 42 px per second.

**Don't** use more than two colors, or let a flow line stand for something that doesn't move.
