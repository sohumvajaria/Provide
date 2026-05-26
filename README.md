# Provide

A web app that maps food resources in Charlotte, NC by ZIP code. **Provide** opens with a landing page (`index.html`) and interactive US map; the ZIP search tool lives on `explorer.html`.

Built for the 2026 Congressional App Challenge, NC-12.

## What it does

Enter a ZIP code. The app finds SNAP retailers, food banks, free meal sites, and WIC locations within your chosen radius and plots them on a map.

## Features

- ZIP code geocoding via Nominatim (OpenStreetMap)
- Radius filter: 2, 5, or 10 miles
- Category filters: SNAP, Food Banks, Free Meals, WIC
- USDA SNAP Retailer Locator data (all Mecklenburg County retailers)
- Feeding America food bank locator (public ArcGIS REST)
- USDA Summer Meals Site Finder API
- Statewide NC WIC clinics from the official NC DHHS directory (`data/wic-nc.json`)
- No API keys required
- Directions via Google Maps
- Fully responsive

## Data Sources

| Category | Source |
|----------|--------|
| SNAP | [USDA SNAP Retailer Locator](https://www.fns.usda.gov/snap/retailer-locator) — Mecklenburg County, NC (`data/snap-mecklenburg.json`) |
| Food banks | [Feeding America](https://www.feedingamerica.org/find-your-local-foodbank) ArcGIS · [NC 211](https://nc211.org) Search API · [Food Bank CENC FoodFinder](https://foodfinder.foodbankcenc.org/) (`data/*.json` cache for browser CORS) |
| Free meals | [USDA Meals for Kids API](https://www.fns.usda.gov/meals4kids) (ArcGIS fallback) |
| WIC | [NC DHHS WIC Agency Directory](https://www.ncdhhs.gov/ladirectorylist2272025publication/open) — parsed to `data/wic-nc.json` (~147 clinics) |

## Run locally

No build step needed. Serve over HTTP so `data/snap-mecklenburg.json` loads:

```bash
python3 -m http.server 8080
# Open http://localhost:8080/explorer.html
```

Or deploy to GitHub Pages (Settings → Pages → `main` branch, `/ (root)`).

Refresh SNAP data:

```bash
node scripts/refresh-snap-data.mjs
```

Refresh WIC data (fetches PDF, geocodes; takes several minutes):

```bash
npm run parse-wic
# Or fill in geocode gaps after rate limits:
npm run retry-wic-geocode
```

Refresh food pantry caches (NC 211 statewide via 13 city ZIP hubs at 25 mi + Food Bank CENC):

```bash
npm run refresh-food-sources
npm run test-charlotte-food
```

## Tech

- Vanilla HTML/CSS/JS
- Leaflet.js for maps
- Nominatim for geocoding
- USDA FNS ArcGIS services
- Feeding America ArcGIS REST

## Team

Built for Rep. Alma Adams (NC-12) Congressional App Challenge 2026.
