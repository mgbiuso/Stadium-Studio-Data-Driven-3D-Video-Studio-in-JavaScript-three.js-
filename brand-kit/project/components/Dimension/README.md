A measured line with short ticks at both ends and its value in capitals.

**Use it** to show size: a building's width or height, a ballpark's foul lines (`318 FT`, `408 FT`, `314 FT`), a then-vs-now comparison at the same scale.

**You provide**
- `a`, `b`: the two ends in the scene, or for round buildings a center and radius (the line then runs across the screen).
- `text`: the value and unit in capitals (`423 FT ACROSS`, `153 FT`). Feet for US places.

**Look**: a 1.6px `white` line with a `label-stroke` shadow, 6px ticks, the value in `dimension` (wide letter spacing) just above the line near its far end. No arrowheads.

**Don't** round a number past what the source says, or show more than three dimensions at once.
