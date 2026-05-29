# Provide

**Food access intelligence for North Carolina.** Local today. Nationwide tomorrow.

**Live Link:** https://provide-nc.org/ · **Repo:** [github.com/sohumvajaria/charlotte-food-access](https://github.com/sohumvajaria/charlotte-food-access)

Custom domain planned; for now the app is hosted from this repository.

Provide is a free, public web map that helps North Carolina residents find SNAP retailers, food pantries, free meal sites, and WIC clinics near any address or ZIP code. It also overlays USDA food-access data and NC transit routes so communities can see both resources and structural barriers in one place.

This project was built for North Carolina—not as a generic national product. Search is validated to NC boundaries; datasets, transit layers, and refresh scripts are tuned to state agencies and regional partners (NC DHHS, NC 211, Food Bank of Central & Eastern North Carolina, Mecklenburg SNAP cache, statewide GTFS). The architecture is designed so additional states can be added over time without rewriting the core experience.

**No login. No API keys for end users. No build step.**

---

## What it does

Enter a street address or ZIP code in North Carolina (or use **Current Location**). Choose a **2-, 5-, or 10-mile** radius. The Explorer plots matching resources on an interactive map, with category filters, directions, and optional policy layers.

| Category | What you get |
|----------|----------------|
| **SNAP retailers** | USDA FNS data; Mecklenburg County bundled cache plus live NC queries; store-type badges (supermarket vs convenience) |
| **Food pantries** | NC 211, Feeding America ArcGIS, Food Bank CENC FoodFinder (cached JSON for CORS) |
| **Free meals (all ages)** | NC 211 soup-kitchen data |
| **Free meals (under 18)** | USDA Meals for Kids API (ArcGIS fallback) |
| **WIC locations** | NC DHHS WIC Agency Directory → `data/wic-nc.json` |

When pantry results are thin, the app points users to **[NC 211](https://nc211.org)** and **2-1-1** by phone. Provide maps and links—it does not enroll clients or deliver food.

### Map layers (Explorer)

- **Food Scarcity Tracker** — USDA Food Access Research Atlas (2019) on **2,195** NC census tracts; **353** USDA-designated food deserts highlighted
- **NC bus routes** — GTFS-derived statewide transit (**820** routes, **9,226** stops); nearest stop and walk time on popups when the layer is on

### Caseworker-friendly actions

- **Print list** — handout-ready resource list (branded for Provide)
- **Copy link** — shareable URL preserves search state in the hash
- **Google Maps** — directions from any marker

---

## Pages

| Page | File | Role |
|------|------|------|
| Landing | `index.html` | Mission, national & NC statistics, how-it-works, live map preview |
| Explorer | `explorer.html` | Full dashboard: search, filters, map, results |

---

## Data at a glance

Bundled caches (refresh via `scripts/` and `npm run`):

| Dataset | File | Count (approx.) |
|---------|------|-----------------|
| SNAP (Mecklenburg) | `data/snap-mecklenburg.json` | 693 |
| Food pantries | `data/nc211-food-pantries.json` | 502 |
| Free meal / soup kitchens | `data/nc211-soup-kitchens.json` | 188 |
| WIC clinics | `data/wic-nc.json` | 158 |
| Food Bank CENC | `data/foodbankcenc-locations.json` | 549 |
| Food access overlay | `data/nc-food-desert.geojson` | 2,195 tracts (353 deserts) |
| NC transit | `data/gtfs-nc-routes.geojson` | 820 routes, 9,226 stops |

At search time, live public APIs supplement caches (USDA ArcGIS, NC 211, Feeding America, summer meals). Geocoding uses **Nominatim** (OpenStreetMap).

### Authoritative sources

| Category | Source |
|----------|--------|
| SNAP | [USDA SNAP Retailer Locator](https://www.fns.usda.gov/snap/retailer-locator) / FNS ArcGIS |
| Food pantries | [NC 211](https://nc211.org) · [Feeding America](https://www.feedingamerica.org/find-your-local-foodbank) · [Food Bank CENC FoodFinder](https://foodfinder.foodbankcenc.org/) |
| Free meals (under 18) | [USDA Meals for Kids](https://www.fns.usda.gov/meals4kids) |
| WIC | [NC DHHS WIC Agency Directory](https://www.ncdhhs.gov/) → parsed to `data/wic-nc.json` |
| Food access | USDA Food Access Research Atlas 2019 + NC census tracts |
| Transit | NC GTFS feeds |

Provide **aggregates and presents** public data; it is not a proprietary warehouse. Always defer to **2-1-1**, county DSS, and WIC enrollment for referrals beyond what the map shows.

---

## Run locally

Static site—serve over HTTP so JSON/GeoJSON loads:

```bash
python3 -m http.server 8080
# Open http://localhost:8080/ (landing) or http://localhost:8080/explorer.html
```

Deploy to **GitHub Pages** (Settings → Pages → `main`, `/ (root)`).

### Refresh data (maintainers)

```bash
# SNAP — Mecklenburg cache
node scripts/refresh-snap-data.mjs

# WIC — fetch PDF, parse, geocode (slow)
npm run parse-wic
npm run retry-wic-geocode   # fill geocode gaps after rate limits

# Pantries & soup kitchens — NC 211 statewide hubs + Food Bank CENC
npm run refresh-food-sources
npm run test-charlotte-food

# Food desert GeoJSON
npm run prepare-food-desert

# NC transit GeoJSON
npm run refresh-gtfs
```

Node dependencies are only required for these maintenance scripts, not for day-to-day browsing.

---

## Tech stack

- Vanilla HTML, CSS, JavaScript
- [Leaflet](https://leafletjs.com/) (Explorer map)
- D3 / TopoJSON (landing hero map only)
- Nominatim, USDA FNS ArcGIS, Feeding America REST, NC 211 API
- OpenStreetMap tiles

**Privacy:** no backend database, no user accounts, no in-repo analytics; shareable state lives in the URL hash only.

---

## Roadmap: NC first, then nationwide

Today:

- Search and validation are **North Carolina only** (addresses outside NC are rejected with a clear message).
- SNAP bundled cache is **Mecklenburg County**; live USDA queries cover NC at runtime.
- Pantries, meals, WIC, food-desert, and transit layers are **statewide NC**.

Later:

- Replicate the data-pipeline pattern (`scripts/`, per-state JSON caches, state-scoped APIs) for other states.
- Generalize NC-specific layers (211, DHHS WIC, GTFS) behind state modules while keeping the same Explorer UX.

The landing page and product copy reflect this: *started in North Carolina, expanding nationwide.*

---

## Team

Built by North Carolina high school students:

- **Alan Cai** — NC School of Science and Mathematics, Class of 2027  
- **Matthew Gervescu** — Ballantyne Ridge High School, Class of 2028  
- **Sohum Vajaria** — NCSSM, Class of 2028  

Origin: Charlotte / Mecklenburg County. Scope today: all of North Carolina.

*Built for the People.*

Made with ❤️ — Alan Cai NCSSM '27, Matthew Gervescu Ballantyne Ridge '28, Sohum Vajaria NCSSM '28

---

## Links

- **Live site:** [[sohumvajaria.github.io/charlotte-food-access](https://sohumvajaria.github.io/charlotte-food-access/)](https://provide-nc.org/)
- **Source:** [github.com/sohumvajaria/charlotte-food-access](https://github.com/sohumvajaria/charlotte-food-access)
