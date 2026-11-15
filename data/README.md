# Data recipe: real-world data for any venue or landmark

One script downloads everything about a place once, and saves it where the 3D page can use it.

```
python3 data/fetch_venue.py msg             # uses saved downloads if they exist
python3 data/fetch_venue.py msg --refresh   # downloads everything again
```

Output: `stadium-studio/data/<venue>-data.js`. Raw downloads are kept in `data/<venue>/raw/` (not saved to git).

## Live trains (optional, for recording)

```
python3 data/live_trains.py
```

Leave that window open while you record. Stadium Studio (opened on this Mac) switches from the
sped-up timetable to real MTA trains at real speed: the 4 train at 161 St-Yankee Stadium and the LIRR
under MSG. Press Ctrl + C to stop. The shared link always uses the timetable.

## Add a new venue or landmark (about 10 minutes)

1. Open `data/venues.json` and copy the `msg` entry. Give it a short key, like `fenway`.
2. Fill in:
   - `center`: latitude and longitude of the middle of the building (right-click it in Google Maps to copy them).
   - `download_bbox`: south, west, north, east. About 300 m beyond the building on every side.
   - `model_box`: how much of the neighborhood the model shows, in meters from the center.
   - `shape`: `round` for drum-shaped arenas, `footprint` for everything else.
   - `city_pack`: `nyc` for anything in New York City, otherwise leave it out.
   - `wikidata`: the Q-number from the venue's Wikidata page.
   - `grid`: names of the four streets around the block (as OpenStreetMap spells them).
   - `transit` and `sport`: optional.
3. Run `python3 data/fetch_venue.py fenway`.
4. Ask Claude to make `stadium-studio/venues/fenway.js` from the MSG recipe.

## Source catalog

| Pack | Source | What it gives | Key? |
|---|---|---|---|
| Everywhere | OpenStreetMap (Overpass) | Streets, lanes, crossings, buildings, building parts with heights, trees, rail tracks, platforms, subway | No |
| Everywhere | Wikidata | Opening date, capacity, architect | No |
| NYC | Building footprints (5zhs-2jue) | Exact outline and roof height of every building | No |
| NYC | 2015 street tree census (uvpi-gqnh) | Every street tree with species and trunk size | No |
| NYC | PLUTO tax lots (64uk-42ks) | Year built, floors, building type for each lot | No |
| NYC | Planimetric sidewalks (52n9-sdep) | Exact sidewalk shapes | No |
| Transit | Any GTFS feed (MTA, NJ Transit, Amtrak, most world cities) | Real train and bus times | Usually no |
| Live | MTA GTFS-realtime (subway lines and LIRR) | Trains due at the station right now | No |
| Everywhere | OpenStreetMap nodes | Traffic signals, subway entrances, stations, elevated track | No |
| Sport | NHL web API (unofficial) | Shot and goal locations | No |

## Packs to add for other cities (when we get there)

- **Chicago, Los Angeles, San Francisco, Boston, Seattle:** each runs an open data portal with building footprints, most with heights.
- **Anywhere else in the world:** OpenStreetMap buildings (already built in as the fallback), plus Overture Maps and Microsoft building footprints, both free.
- **Other sports:** MLB (Statcast), NBA (nba_api) and NFL each need a small module like the NHL one.

## Credits

Put the credit line from `data/<venue>/credits.md` in every video caption that shows a model.
