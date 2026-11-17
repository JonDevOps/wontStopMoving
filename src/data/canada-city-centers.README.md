# Canadian marketplace city coordinates

`canada-city-centers.json` contains approximate place coordinates from [GeoNames](https://www.geonames.org/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Extracted November 17, 2026 from https://download.geonames.org/export/dump/CA.zip . Province codes were checked against https://download.geonames.org/export/dump/admin1CodesASCII.txt .

Rebuild from an extracted `CA.txt` with `node scripts/build-canada-city-centers.mjs /path/to/CA.txt` at the repository root. The script matches names and aliases within each province against the existing city directory, prefers the more populated place on duplicate names, and preserves all existing city routes. It includes populated places and neighborhoods; it excludes abandoned and historic places.

792 existing Canadian city routes have matched coordinates. Unmatched entries include spelling variants, counties and combined place names; those routes remain available and use explicit provider city coverage. Coordinates are approximate search centers, never a guarantee that a provider will serve an address. Public marketplace results credit GeoNames.
