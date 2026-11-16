# Penn Station and what's under MSG: sources and open questions

## Sources in use

| What | Source | Used for |
|---|---|---|
| Track depth | Transactions of the American Society of Civil Engineers, vol. 68 (1910), general description paper (`sources/general-description-1910.txt`): "The level of the track system below the street surface varies from 39 to 58 ft., and is from 7 to 10 ft. below mean high water" | Rails 42 ft (12.9 m) below the street at the Garden |
| Street elevation | NYC building footprints, `ground_elevation` (about 34 to 37 ft NAVD88 at the Garden) | Turning "below high water" into feet below the street |
| High water | NOAA station 8518750 (The Battery) datums: MHW 1.96 ft NAVD88 (1983-2001 epoch); about 0.75 ft lower in 1910 at roughly 2.8 mm a year | Same |
| LIRR concourse | Wikipedia, "Pennsylvania Station (1910–1963)": 18 ft above the tracks | Lower concourse level |
| Levels | OpenStreetMap: concourses at levels -1 and -2, tracks at -3 (203 features at Penn) | Order of the levels; the upper concourse depth is approximate |
| Subway entrances | MTA Subway Entrances and Exits: 2024 (data.ny.gov i9wp-a4ja) | 28 entrances in the model area, stairs to the 1 2 3 and A C E |
| The dig | ASCE 1910 papers (`sources/terminal-station-west-1910.txt`, `sources/east-river-division-1910.txt`): retaining walls on 31st, 33rd and 7th Ave; about 50 ft average depth west of 9th Ave; 9th Ave carried on steel | "The dig" era |
| Buildings cleared | Wikipedia: "some 500 buildings had to be demolished" | Dig label |
| Weather | NOAA daily summaries, Central Park (USW00094728): Nov 27, 1910 46/35°F dry; Oct 28, 1963 66/51°F, 0.10 in rain; Feb 11, 1968 20/8°F | Opening-day note, history facts |
| Landmarks | NYC Open Data buis-pvji and skyk-mpzq: 1,448 individual landmarks (first Oct 14, 1965), 141 historic district records | The payoff fact |

The 1910 papers are public domain (Project Gutenberg editions on the Internet Archive).

## Numbers that disagree (decide before publishing)

| | ASCE 1910 paper | Wikipedia (model uses) |
|---|---|---|
| Building | 774 × 433 ft | 788 × 432 ft |
| Main waiting room | 277 × 103 ft, 150 ft high | 314 ft 4 in × 108 ft 8 in, 150 ft |
| Track depth | 39 to 58 ft | 36 or 45 ft |

The model now uses the 1910 paper for the tracks. The building and waiting room still use Wikipedia's numbers.

## Not available yet

- **NYC 3D Building Model (2014):** now in use. The citywide CityGML zip (916 MB, 13.8 GB unzipped) sits in `data/nyc3d/raw` (not in git). The data recipe reads only delivery area DA12 straight from the zip and keeps buildings inside the model box, matched to today's footprints by BIN. Buildings newer than 2014 stay as extruded footprints.
- **1 ft elevation model (LIDAR 2010):** a 26.6 GB download. Footprint ground elevations cover what the model needs.
- **1924 and 1951 aerial photos:** viewable on NYCityMap; no public download path found.
- **1911 and 1916 atlases:** the NYPL Map Warper that lined them up with today's map was retired (it redirects to a 2021 archive). The scans remain in NYPL Digital Collections.
- **Bedrock:** now in use. USGS data release (DeMott, Stumm, Como and Finkelstein, 2023, doi:10.5066/P911CSI3): 101 construction borings near MSG (WPA and NYC DEP), interpolated into a 10 m grid. Rock sits 2 to 12 m (7 to 38 ft) below the street around the Garden, so the tracks run in a trench cut into Manhattan schist. Files in `data/geology/raw`.
- **Basements:** NYC Building Elevation and Subgrade (bsin-59hv) only says whether a building has space below grade. Shown one story (3.5 m) deep: an approximation.
- **Moynihan Train Hall:** skylight 92 ft high, four vaults over the old 150 x 200 ft sorting room (SOM; ASCE Civil Engineering, 2022). Placed over the sunken hall in the 2014 3D model of the Farley Building; the vault direction is approximate.
