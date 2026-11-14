# Madison Square Garden model: sources and credits

Paste the short credit line into every video caption that shows this model.

## Short credit line (for captions)

Map data © OpenStreetMap contributors. Building data: NYC Open Data. Train times: MTA LIRR. Shot data: NHL.

## What came from where

| Part of the model | Source | Accuracy |
|---|---|---|
| Drum size and roof height (129 m across, 44.4 m tall) | NYC Open Data, Building Footprints | Measured |
| Low side buildings, glass boxes, corner towers, Two Penn Plaza | OpenStreetMap building parts | Measured heights |
| Neighboring buildings (62 pieces) | NYC Open Data, Building Footprints | Measured outline and roof height |
| Streets, sidewalks, crosswalks, street trees | OpenStreetMap | Measured positions |
| Penn Station tracks 1 to 21, platforms 1 to 11, subway lines | OpenStreetMap | Measured positions, depth approximate |
| LIRR trains, 5 to 6 pm | MTA LIRR GTFS schedule, Wednesday Nov 18, 2026 | Real times. Which track each train uses is made up for the picture. |
| Rangers shot map | NHL play-by-play, 41 home games, 2025-26 | Real shot locations |
| Opening date, capacity | Wikidata (Q186125) | Fact |

## What is artistic, not measured

- Panel and fin colors, the ceiling look, seat colors: matched by eye to the reference photos.
- Banner layout and the center-ice design: simplified. No team logos are copied.
- Video screen text on the building and the scoreboard: made up.
- The rink's direction inside the arena: not confirmed by data.

## Rules to remember

- OpenStreetMap requires the credit "© OpenStreetMap contributors" wherever its data is shown.
- The NHL data comes from an unofficial feed. Fine for commentary and stats; do not sell products built on it.
- To refresh everything: `python3 data/fetch_venue.py msg --refresh`
