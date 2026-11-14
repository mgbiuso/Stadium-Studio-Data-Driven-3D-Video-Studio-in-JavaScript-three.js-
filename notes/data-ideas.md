# Data ideas: sources, combinations and where we paused

Last updated: 2026-11-14. Brainstorm notes for future builds.

## Where we paused

- Built one sample: `examples/earthquake-attention.html` (scroll story plus live earthquake map).
- Mike liked both parts, and preferred the **live map**.
- Leaning: US first, open to global. Wants live visuals with some polished one-time pieces.
- Unsure yet what this is for (personal, portfolio or public).
- Suggested next build: **27, Live planet dashboard**, then **28**.

Open questions for next time:
1. Does the Live planet dashboard appeal, or does another shortlist item pull harder?
2. US only, or the whole world?
3. What was the draw of the live map: that it was current, that it was a map, or that you could explore it?

## Live-map shortlist

27, 28, 29, 36 (the earth right now). 31, 33 (things moving). 39, 38, 24 (people and attention). 2, 8 (baseball).

## The glue rule

Two datasets only combine well when they share a glue column:
- **Place**: latitude and longitude, or a code (country, county, census tract).
- **Time**: a date or timestamp.
- **Identity**: a shared ID. Wikidata is the master key, since one entry holds a thing's TMDB, MusicBrainz, Open Library and MLB IDs plus coordinates.

## Sources and access (checked 2026-11-13 unless noted)

Tags: [No key], [Free key], [Unofficial] = works but not promised, personal use.

- **Baseball**: MLB Stats API [No key, Unofficial, non-commercial]. Statcast [Unofficial]. Retrosheet. Lahman. pybaseball (Python tool).
- **Other sports**: nflverse. nba_api [Unofficial]. NHL API [No key, Unofficial]. StatsBomb Open Data. FastF1 / OpenF1.
- **Government and economy**: Data.gov. Census API [Free key, required since May 2026]. FRED [Free key]. BLS [Free key]. SEC EDGAR. USAspending and Treasury Fiscal Data. City portals such as NYC Open Data.
- **World and society**: World Bank. Our World in Data. UN Data, OECD, IMF, Eurostat. WHO.
- **Weather, earth, space**: NWS API [No key]. Open-Meteo [No key, 10,000 calls a day, non-commercial only]. NOAA Climate Data (old v2 service looks stale since 2022, use the newer Access Data Service). USGS earthquakes [No key]. NASA APIs [Free key]. OpenAQ [Free key, about 60 requests a minute].
- **Maps and movement**: OpenStreetMap. Natural Earth. Census TIGER. GTFS transit feeds. OpenSky [about 400 credits a day anonymous, about 4,000 with a free account].
- **Culture and knowledge**: Wikipedia, Wikidata, Pageviews [No key, new rate limits in 2026]. MusicBrainz. Open Library, Project Gutenberg. TMDB [Free key, non-commercial]. Met, Art Institute of Chicago, Smithsonian. Library of Congress.
- **Science and nature**: GBIF, iNaturalist. eBird [Free key]. openFDA. CDC. OpenAlex [Free key, required since Feb 2026].
- **Tech**: GitHub API. Hacker News API. Stack Exchange API.
- **Markets**: Frankfurter. CoinGecko [Free key, monthly cap]. Alpha Vantage [Free key, 25 requests a day].
- **Catalogs**: public-apis (GitHub). Kaggle, Hugging Face. Google Dataset Search. TidyTuesday. The Pudding data (active). FiveThirtyEight data (frozen since Feb 2025).

Not re-verified, from memory: World Bank, IMF, OECD, Eurostat, WHO, USGS, NWS, TMDB, MusicBrainz, Open Library, museum APIs, GBIF, iNaturalist, eBird, Frankfurter, BLS, nba_api, OpenF1.

Safe if this ever goes public or commercial: government, Wikimedia, NASA, USGS and museum data. Check terms first for Open-Meteo, MLB, NHL and TMDB.

## The 60 combinations

Format: name: sources. Glue. Live or One-time.

### A. Baseball
1. Weather and the long ball: Statcast + MLB Stats API + Open-Meteo history. Ballpark + game time. One-time.
2. Tonight's ballpark forecast board: MLB schedule + NWS + Natural Earth. Place + time. Live.
3. 150 years in one timeline: Lahman + Retrosheet + Statcast via pybaseball IDs. Player ID. One-time.
4. Where ballplayers come from: Lahman + Natural Earth + World Bank. Birth country. One-time.
5. Fame versus performance: MLB Stats API + Wikidata + Pageviews. Player ID. Live.
6. Payroll in real dollars: Lahman salaries (to 2016) + FRED + Census. Year + metro. One-time.
7. Travel miles and tired teams: MLB schedule + venue coordinates + Natural Earth. Place. One-time.
8. Smoke games: MLB schedule + OpenAQ. Place + time. Live.
9. Getting to the game: venue + GTFS + OpenStreetMap + Census tracts. Place. One-time.

### B. Other sports
10. Cold-weather football: nflverse + Open-Meteo history. Stadium + kickoff. One-time.
11. F1 in the rain: FastF1/OpenF1 + Open-Meteo + circuit maps. Circuit + time. One-time.
12. Soccer shot maps and player origins: StatsBomb + Wikidata + Natural Earth. Player identity. One-time.
13. The attention spike: any league API + Pageviews. Player or team + date. Live.
14. Sports city scorecard: all leagues + Census + FRED. Metro. Live.
15. Home advantage across sports: MLB + NHL + nba_api + nflverse + StatsBomb. Same statistic. One-time.

### C. Places and people
16. World development explorer: World Bank + Our World in Data + WHO + Natural Earth. Country + year.
17. Rich-country comparison: OECD + Eurostat + IMF + World Bank. Country + year.
18. Health and wealth: WHO + World Bank + UN + Our World in Data. Country + year.
19. Neighborhood portrait: Census + TIGER + OpenStreetMap + city data. Tract. One-time.
20. Transit deserts: GTFS + Census + TIGER + OpenStreetMap. Place. One-time.
21. Where federal money lands: USAspending + Census + TIGER + BLS. County. Live monthly.
22. Jobs map: BLS + FRED + TIGER. County + month. Live monthly.
23. US health map: CDC + Census + TIGER + OpenAQ. County or tract. One-time.
24. City pulse: 311 + NWS + GTFS. Place + time. Live.
25. Heat and the city: city tree and 311 data + Open-Meteo + Census + TIGER. Tract + date. One-time.
26. Rates and housing: FRED + Census + BLS. Metro + month. Live monthly.

### D. Earth and sky
27. Live planet dashboard: USGS + NASA natural events + NWS alerts + Natural Earth. Place + time. Live.
28. Who lives near the shaking: USGS + Census or World Bank + OpenStreetMap. Place. Live.
29. Wildfire smoke tracker: NASA fires + OpenAQ + NWS wind + Census. Place + time. Live.
30. Climate stripes for any town: Open-Meteo history + NOAA + Our World in Data. Place + year. One-time.
31. Sky traffic and storms: OpenSky + Open-Meteo or NWS + Natural Earth. Place + time. Live, regional.
32. Flying and emissions: OpenSky + Our World in Data + World Bank. Country + year. One-time.
33. Bird migration on the wind: eBird + Open-Meteo + Natural Earth. Place + date. Live daily.
34. Spring is arriving earlier: iNaturalist or GBIF + temperature history. Place + date. One-time.
35. Nature in the city: iNaturalist + OpenStreetMap + Census + city trees. Place. Live.
36. Can I see it tonight?: NASA asteroids and daily image + Open-Meteo clouds. Location + time. Live.
37. The air you breathe and how long you live: OpenAQ + WHO + World Bank. Country. One-time.
38. How fast the world looks up a disaster: USGS + Pageviews + Wikidata. Event + time. Live. (Sample built.)

### E. Culture and knowledge
39. What the world is curious about today: Pageviews + Wikidata + Natural Earth. Wikidata ID. Live daily.
40. The movie release bump: TMDB + Pageviews + Open Library. Wikidata ID. Live.
41. A map of music: MusicBrainz + Wikidata + Natural Earth + Pageviews. Wikidata ID + place.
42. Where art comes from: Met + Art Institute + Smithsonian + Wikidata + Natural Earth. Artist + place + year. One-time.
43. Then and now by place: Library of Congress + OpenStreetMap + Census. Place. One-time.
44. The life of a book: Gutenberg + Open Library + Pageviews. Author and title. One-time.
45. Old headlines against real events: Library of Congress newspapers + FRED. Date. One-time.
46. Legacy curve: Wikidata + Pageviews + MusicBrainz or TMDB. Wikidata ID. Live.
47. Do we study what harms us?: OpenAlex + WHO + Our World in Data + Pageviews. Disease + year. One-time.
48. World map of research: OpenAlex + World Bank + Natural Earth. Country.
49. Medicine in the spotlight: openFDA + Pageviews + OpenAlex. Drug name + date. Live.

### F. Tech
50. Hype cycle tracker: GitHub + Hacker News + Stack Exchange + Pageviews. Technology + date. Live.
51. Tech talk versus the stock: Hacker News + SEC EDGAR + Alpha Vantage. Company + date. Live daily.
52. Where open source is written: GitHub + Natural Earth + World Bank. Country. One-time, messier.

### G. Money
53. Economy dashboard: FRED + BLS + Treasury + Alpha Vantage. Date. Live.
54. Currency and cost of living: Frankfurter + IMF or World Bank + OECD. Country + date. Live daily.
55. Company X-ray: SEC EDGAR + Alpha Vantage + USAspending + Pageviews. Company ID. Live.
56. Crypto versus attention: CoinGecko + Pageviews + Hacker News + GitHub. Coin + date. Live.

### H. Catalogs as building blocks
57. Refresh a Pudding story: a Pudding dataset + the live source behind it.
58. History plus fresh: a Kaggle or Hugging Face bulk file + a live API.
59. Extend a frozen archive: FiveThirtyEight sports ratings + league APIs.
60. Fill the missing piece: Data.gov, Google Dataset Search, public-apis. TidyTuesday for practice.

## Lessons from the sample build

- Wikipedia reader counts are stored by article title. A renamed article splits its counts, which is why Salt Lake City replaced Puerto Rico.
- Save the story's data inside the page and let only the live panel call the internet.
- Port 8765 on this Mac is used by another project. Use a different port for previews.
