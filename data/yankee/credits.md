# Yankee Stadium model: sources and credits

## Short credit line (for captions)

Map data © OpenStreetMap contributors. Building and tree data: NYC Open Data. Train times: MTA.

## What came from where

| Part of the model | Source | Accuracy |
|---|---|---|
| Where the stadium sits and which way it faces | OpenStreetMap field outline (home plate and center field) | Measured |
| Neighboring buildings and their heights | NYC Open Data building footprints | Measured |
| Facade style, water tanks | NYC PLUTO (year built, floors, building type) | Style chosen from the building's age |
| Streets, crosswalks, sidewalks | OpenStreetMap, NYC planimetric sidewalks | Measured |
| Street trees | 2015 NYC street tree census (species, trunk size) | Measured positions, sizes from trunk width |
| The 4 train's elevated track and the 161 St station | OpenStreetMap | Measured path, simplified structure |
| 4 trains, 6 to 7 pm | MTA subway GTFS schedule, Wednesday Nov 18, 2026 | Real times |
| Live trains (when data/live_trains.py runs) | MTA GTFS-realtime | Real arrivals |
| Opening year, capacity | Wikidata (Q753529) | Fact |
| Builder, cost, groundbreaking (blueprint title block) | Public records as summarized on Wikipedia | Check before quoting on camera |

## What is artistic, not measured

- The stadium itself is still the hand-built study model, placed on its real spot. Its shape follows the photos, not survey data.
- Seat colors, signage and scoreboard graphics: simplified, no team logos copied.
