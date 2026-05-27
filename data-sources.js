/**
 * Provide data layer — USDA SNAP, Feeding America, NC 211, Food Bank CENC, USDA Summer Meals, WIC.
 * No API keys required.
 */
(function initProvideDataSources(global) {
  const USDA_SNAP_ARCGIS =
    'https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/snap_retailer_location_data/FeatureServer/0';
  const USDA_SUMMER_MEALS_ARCGIS =
    'https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/Summer_Meal_Site_Finder_2024_WFL1/FeatureServer/0';
  const USDA_SUMMER_MEALS_API = 'https://www.fns.usda.gov/meals4kids/api/sites';
  const FEEDING_AMERICA_FOOD_BANKS =
    'https://services1.arcgis.com/nCKYwcSONQTkPA4K/arcgis/rest/services/FeedingAmerica_FoodBanks_2023/FeatureServer/0';
  const FEEDING_AMERICA_FOOD_BANKS_FALLBACK =
    'https://services5.arcgis.com/0HvWfm6i99NZFHqu/arcgis/rest/services/Feeding_America_Food_Banks_17Mar2020_View1/FeatureServer/0';
  // Optional local caches (serve over http:// — not file://). Live USDA uses envelope queries.
  const SNAP_MECKLENBURG_JSON = 'data/snap-mecklenburg.json';
  const SNAP_NC_JSON = 'data/snap-nc.json';

  const NC211_SEARCH_URL =
    'https://api.211.org/search/v1/api/search/keyword';
  const NC211_API_KEY = '21ccc53661d64eddbf492cb4f0c4492c';
  const NC211_FOOD_JSON = 'data/nc211-food-pantries.json';
  const NC211_SOUP_KITCHENS_JSON = 'data/nc211-soup-kitchens.json';
  const FOOD_FINDER_API =
    'https://foodfinder.foodbankcenc.org/api/v1/locations';
  const FOOD_FINDER_JSON = 'data/foodbankcenc-locations.json';

  const WIC_NC_JSON = 'data/wic-nc.json';
  const GTFS_NC_ROUTES_JSON = 'data/gtfs-nc-routes.geojson';

  let snapLocalCache = null;
  let wicNorthCarolinaCache = null;
  let nc211FoodCache = null;
  let nc211SoupKitchenCache = null;
  let foodFinderCache = null;
  let transitDataCache = null;

  function milesToEnvelope(centerLat, centerLng, radiusMiles) {
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((centerLat * Math.PI) / 180));
    const pad = 1.12;
    return {
      xmin: centerLng - lngDelta * pad,
      ymin: centerLat - latDelta * pad,
      xmax: centerLng + lngDelta * pad,
      ymax: centerLat + latDelta * pad,
    };
  }

  function withinRadius(centerLat, centerLng, pointLat, pointLng, radiusMiles) {
    const R = 3958.8;
    const dLat = (pointLat - centerLat) * Math.PI / 180;
    const dLng = (pointLng - centerLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(centerLat * Math.PI / 180) * Math.cos(pointLat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMiles;
  }

  function dedupeByName(resources) {
    const seen = new Set();
    return resources.filter((r) => {
      const key = `${r.category}|${r.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function dedupeSnapRetailers(entries) {
    const byKey = new Map();
    for (const entry of entries) {
      const key = entry.name.trim().toLowerCase();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, entry);
        continue;
      }
      if (!existing.storeType && entry.storeType) {
        byKey.set(key, { ...existing, storeType: entry.storeType });
      }
    }
    return Array.from(byKey.values());
  }

  function filterByRadius(resources, centerLat, centerLng, radiusMiles) {
    return resources.filter((r) =>
      withinRadius(centerLat, centerLng, r.lat, r.lng, radiusMiles)
    );
  }

  async function arcgisQuery(baseUrl, params) {
    const url = new URL(`${baseUrl}/query`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`ArcGIS query failed: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'ArcGIS error');
    return data;
  }

  let snapStoreTypeSampleLogged = false;

  function mapSnapAttributes(attrs) {
    const lat = parseFloat(attrs.Latitude);
    const lng = parseFloat(attrs.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const storeType = String(
      attrs.Store_Type ?? attrs.store_type ?? attrs.Type ?? ''
    ).trim();
    return {
      name: attrs.Store_Name || 'SNAP Retailer',
      lat,
      lng,
      address: [
        attrs.Store_Street_Address,
        attrs.City,
        attrs.State,
        attrs.Zip_Code,
      ].filter(Boolean).join(', '),
      category: 'snap',
      storeType,
    };
  }

  function getSnapStoreCategory(storeType) {
    const t = String(storeType || '').toLowerCase().trim();
    if (!t) return 'other';

    const conveniencePatterns = [
      'convenience store',
      'convenience',
      'gas/fuel',
      'gas station',
      'dollar store',
      'pharmacy',
      'combination grocery',
    ];
    for (const pattern of conveniencePatterns) {
      if (t.includes(pattern)) return 'convenience';
    }

    const groceryPatterns = [
      'supermarket',
      'grocery store',
      'small grocery',
      'wholesale club',
      'meat/poultry',
      'meat poultry',
      'seafood specialty',
      'farmers market',
      'farmers and markets',
      'specialty food',
      'specialty store',
      'super store',
    ];
    for (const pattern of groceryPatterns) {
      if (t.includes(pattern)) return 'grocery';
    }

    if (t.includes('grocery')) return 'grocery';

    return 'other';
  }

  async function loadSnapLocalData() {
    if (snapLocalCache) return snapLocalCache;

    const merged = [];
    const paths = [SNAP_MECKLENBURG_JSON, SNAP_NC_JSON];

    for (const path of paths) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) merged.push(...rows);
      } catch {
        /* optional cache */
      }
    }

    snapLocalCache = dedupeByName(merged);
    return snapLocalCache;
  }

  async function loadSnapNorthCarolina() {
    return loadSnapLocalData();
  }

  async function fetchSnapFromArcgisEnvelope(centerLat, centerLng, radiusMiles) {
    const env = milesToEnvelope(centerLat, centerLng, Math.max(radiusMiles, 1));
    const outFields =
      'Store_Name,Store_Street_Address,City,State,Zip_Code,Store_Type,Latitude,Longitude';
    const collected = [];
    let offset = 0;
    const pageSize = 2000;

    while (true) {
      const data = await arcgisQuery(USDA_SNAP_ARCGIS, {
        where: "State='NC'",
        outFields,
        geometry: `${env.xmin},${env.ymin},${env.xmax},${env.ymax}`,
        geometryType: 'esriGeometryEnvelope',
        inSR: 4326,
        spatialRel: 'esriSpatialRelIntersects',
        returnGeometry: 'false',
        f: 'json',
        resultRecordCount: pageSize,
        resultOffset: offset,
      });

      const batch = (data.features || [])
        .map((f) => mapSnapAttributes(f.attributes))
        .filter(Boolean);
      collected.push(...batch);

      if (!data.exceededTransferLimit || batch.length < pageSize) break;
      offset += pageSize;
      if (offset >= 10000) break;
    }

    return filterByRadius(collected, centerLat, centerLng, radiusMiles);
  }

  async function fetchSnapNear(centerLat, centerLng, radiusMiles) {
    const local = await loadSnapLocalData();
    const fromLocal = filterByRadius(local, centerLat, centerLng, radiusMiles);

    try {
      const fromApi = await fetchSnapFromArcgisEnvelope(
        centerLat,
        centerLng,
        radiusMiles
      );
      const merged = dedupeSnapRetailers([...fromApi, ...fromLocal]);

      if (!snapStoreTypeSampleLogged && fromApi.length) {
        const sample = fromApi.find((r) => r.storeType);
        if (sample) {
          console.info(
            '[SNAP] storeType sample:',
            sample.name,
            '->',
            sample.storeType,
            `(${getSnapStoreCategory(sample.storeType)})`
          );
        }
        snapStoreTypeSampleLogged = true;
      }

      return merged;
    } catch {
      return fromLocal;
    }
  }

  function mapFeedingAmericaFeature(feature) {
    const attrs = feature.attributes || {};
    const geom = feature.geometry;
    if (!geom) return null;

    const lat = parseFloat(geom.y ?? attrs.Latitude ?? attrs.latitude);
    const lng = parseFloat(geom.x ?? attrs.Longitude ?? attrs.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const name =
      attrs.Food_Bank_Name ||
      attrs.Name ||
      attrs.Organization ||
      attrs.ORGANIZATION ||
      'Food Pantry';

    const address = [
      attrs.Address || attrs.Street || attrs.street,
      attrs.City || attrs.city,
      attrs.State || attrs.state,
      attrs.Zip_Code || attrs.Zip || attrs.zip,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      name: String(name).trim(),
      lat,
      lng,
      address: address || 'Charlotte, NC',
      category: 'food_bank',
    };
  }

  function mapNC211Document(doc, category) {
    const lat = parseFloat(doc.latitudeLocation);
    const lng = parseFloat(doc.longitudeLocation);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const address = [
      doc.address1PhysicalAddress,
      doc.cityPhysicalAddress,
      doc.statePhysicalAddress,
      doc.regionPhysicalAddress,
    ]
      .filter(Boolean)
      .join(', ');

    const defaultName =
      category === 'free_meals_all_ages' ? 'Free Meal Site' : 'Food Pantry';

    return {
      name: (doc.nameService || doc.nameOrganization || defaultName).trim(),
      lat,
      lng,
      address: address || 'North Carolina',
      category,
    };
  }

  async function resolveZipForCoords(centerLat, centerLng) {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${centerLat}&lon=${centerLng}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ProvideApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const postcode = data.address?.postcode;
    if (postcode && /^\d{5}/.test(postcode)) return postcode.slice(0, 5);
    return null;
  }

  async function geocodeAddress(query) {
    const cleaned = query.trim().replace(/\s+/g, ' ');
    if (!cleaned) return null;

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', cleaned);
      url.searchParams.set('countrycodes', 'us');
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('addressdetails', '1');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'ProvideApp/1.0' },
      });
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.length) return null;

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const displayName = result.display_name || cleaned;
      let inNC = false;
      if (result.address?.state === 'North Carolina') {
        inNC = true;
      } else if (
        displayName.includes('North Carolina') ||
        displayName.includes(', NC')
      ) {
        inNC = true;
      }

      return { lat, lng, displayName, inNC };
    } catch {
      return null;
    }
  }

  async function loadNC211FoodCache() {
    if (nc211FoodCache) return nc211FoodCache;
    try {
      const res = await fetch(NC211_FOOD_JSON);
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) {
          nc211FoodCache = rows;
          return nc211FoodCache;
        }
      }
    } catch {
      /* optional cache */
    }
    nc211FoodCache = [];
    return nc211FoodCache;
  }

  async function fetchNC211KeywordFromApi(
    centerLat,
    centerLng,
    radiusMiles,
    keyword,
    category
  ) {
    const zip = await resolveZipForCoords(centerLat, centerLng);
    const location =
      zip || `${centerLat.toFixed(4)},${centerLng.toFixed(4)}`;

    const url = new URL(NC211_SEARCH_URL);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('location', location);
    url.searchParams.set('distance', String(Math.max(radiusMiles, 1)));
    url.searchParams.set('skip', '0');
    url.searchParams.set('top', '100');

    const res = await fetch(url.toString(), {
      headers: { 'Api-Key': NC211_API_KEY },
    });
    if (!res.ok) throw new Error(`NC 211 search failed: ${res.status}`);
    const data = await res.json();

    return (data.results || [])
      .map((item) => mapNC211Document(item.document || item, category))
      .filter(Boolean);
  }

  async function fetchNC211FromApi(centerLat, centerLng, radiusMiles) {
    return fetchNC211KeywordFromApi(
      centerLat,
      centerLng,
      radiusMiles,
      'food pantry',
      'food_bank'
    );
  }

  async function fetchNC211(centerLat, centerLng, radiusMiles) {
    try {
      const live = await fetchNC211FromApi(centerLat, centerLng, radiusMiles);
      if (live.length) {
        return filterByRadius(live, centerLat, centerLng, radiusMiles);
      }
    } catch {
      /* CORS or network — fall back to bundled cache */
    }

    const cached = await loadNC211FoodCache();
    return filterByRadius(cached, centerLat, centerLng, radiusMiles);
  }

  function mapSoupKitchenCacheRow(row) {
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const address =
      [
        row.address,
        row.city,
        row.state,
        row.zip,
      ]
        .filter(Boolean)
        .join(', ') || 'North Carolina';

    return {
      name: String(row.name || 'Free Meal Site').trim(),
      lat,
      lng,
      address,
      phone: row.phone ? String(row.phone) : '',
      category: 'free_meals_all_ages',
    };
  }

  async function loadNC211SoupKitchenCache() {
    if (nc211SoupKitchenCache) return nc211SoupKitchenCache;
    try {
      const res = await fetch(NC211_SOUP_KITCHENS_JSON);
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) {
          nc211SoupKitchenCache = rows
            .map(mapSoupKitchenCacheRow)
            .filter(Boolean);
          return nc211SoupKitchenCache;
        }
      }
    } catch {
      /* optional cache */
    }
    nc211SoupKitchenCache = [];
    return nc211SoupKitchenCache;
  }

  async function fetchFreeMealsAllAgesNear(centerLat, centerLng, radiusMiles) {
    try {
      const live = await fetchNC211KeywordFromApi(
        centerLat,
        centerLng,
        radiusMiles,
        'soup kitchen',
        'free_meals_all_ages'
      );
      if (live.length) {
        return filterByRadius(live, centerLat, centerLng, radiusMiles);
      }
    } catch {
      /* CORS or network — fall back to bundled cache */
    }

    const cached = await loadNC211SoupKitchenCache();
    return filterByRadius(cached, centerLat, centerLng, radiusMiles);
  }

  function mapFoodFinderLocation(loc) {
    const lat = parseFloat(loc.latitude);
    const lng = parseFloat(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      name: String(loc.name || 'Food Assistance Site').trim(),
      lat,
      lng,
      address: String(loc.address || '')
        .replace(/\s+/g, ' ')
        .trim(),
      category: 'food_bank',
    };
  }

  async function loadFoodFinderLocations() {
    if (foodFinderCache) return foodFinderCache;

    try {
      const res = await fetch(FOOD_FINDER_API, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const rows = (data.locations || [])
          .map(mapFoodFinderLocation)
          .filter(Boolean);
        if (rows.length) {
          foodFinderCache = rows;
          return foodFinderCache;
        }
      }
    } catch {
      /* try bundled cache */
    }

    try {
      const res = await fetch(FOOD_FINDER_JSON);
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length) {
          foodFinderCache = rows;
          return foodFinderCache;
        }
      }
    } catch {
      /* optional cache */
    }

    foodFinderCache = [];
    return foodFinderCache;
  }

  async function fetchFoodBankCenc(centerLat, centerLng, radiusMiles) {
    const locations = await loadFoodFinderLocations();
    return filterByRadius(locations, centerLat, centerLng, radiusMiles);
  }

  /**
   * Feeding America food pantry locator (public ArcGIS REST).
   */
  async function fetchFeedingAmericaFoodBanks(centerLat, centerLng, radiusMiles) {
    const xmin = centerLng - 0.5;
    const ymin = centerLat - 0.5;
    const xmax = centerLng + 0.5;
    const ymax = centerLat + 0.5;

    const queryParams = {
      where: '1=1',
      outFields: '*',
      geometry: `${xmin},${ymin},${xmax},${ymax}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      returnGeometry: 'true',
      outSR: 4326,
      f: 'json',
    };

    let data;
    try {
      data = await arcgisQuery(FEEDING_AMERICA_FOOD_BANKS, queryParams);
    } catch {
      data = await arcgisQuery(FEEDING_AMERICA_FOOD_BANKS_FALLBACK, queryParams);
    }

    const mapped = (data.features || [])
      .map(mapFeedingAmericaFeature)
      .filter(Boolean);

    const arcgisNearby = filterByRadius(mapped, centerLat, centerLng, radiusMiles);
    const [nc211, cenc] = await Promise.all([
      fetchNC211(centerLat, centerLng, radiusMiles),
      fetchFoodBankCenc(centerLat, centerLng, radiusMiles),
    ]);
    return dedupeByName([...arcgisNearby, ...nc211, ...cenc]);
  }

  function mapSummerMealSite(item) {
    const lat = parseFloat(
      item.lat ?? item.latitude ?? item.Latitude ?? item.y ?? item.Y
    );
    const lng = parseFloat(
      item.lng ?? item.lon ?? item.longitude ?? item.Longitude ?? item.x ?? item.X
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const name =
      item.name ||
      item.siteName ||
      item.Site_Name ||
      item.site_name ||
      'Summer Meal Site';

    const address =
      item.address ||
      item.siteAddress ||
      [
        item.address1 || item.Site_Address1 || item.street,
        item.city || item.Site_City,
        item.state || item.Site_State,
        item.zip || item.Site_Zip,
      ]
        .filter(Boolean)
        .join(', ') ||
      'Charlotte, NC';

    return {
      name: String(name).trim(),
      lat,
      lng,
      address: String(address).trim(),
      category: 'free_meals_under_18',
    };
  }

  function parseSummerMealsApiPayload(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.sites)) return data.sites;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.features)) {
      return data.features.map((f) => ({
        ...(f.attributes || {}),
        lat: f.geometry?.y,
        lng: f.geometry?.x,
      }));
    }
    return [];
  }

  async function fetchSummerMealsFromArcgis(centerLat, centerLng, radiusMiles) {
    const env = milesToEnvelope(centerLat, centerLng, Math.max(radiusMiles, 2));
    const data = await arcgisQuery(USDA_SUMMER_MEALS_ARCGIS, {
      geometry: `${env.xmin},${env.ymin},${env.xmax},${env.ymax}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      where: "Site_State='NC'",
      outFields: 'Site_Name,Site_Address1,Site_Address2,Site_City,Site_State,Site_Zip',
      returnGeometry: 'true',
      outSR: 4326,
      f: 'json',
      resultRecordCount: 2000,
    });

    const mapped = (data.features || [])
      .map((f) =>
        mapSummerMealSite({
          Site_Name: f.attributes?.Site_Name,
          Site_Address1: f.attributes?.Site_Address1,
          Site_Address2: f.attributes?.Site_Address2,
          Site_City: f.attributes?.Site_City,
          Site_State: f.attributes?.Site_State,
          Site_Zip: f.attributes?.Site_Zip,
          lat: f.geometry?.y,
          lng: f.geometry?.x,
        })
      )
      .filter(Boolean);

    return filterByRadius(mapped, centerLat, centerLng, radiusMiles);
  }

  async function fetchSummerMealsNear(centerLat, centerLng, radiusMiles) {
    try {
      const url =
        `${USDA_SUMMER_MEALS_API}?lat=${centerLat}&lng=${centerLng}&radius=${radiusMiles}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Summer meals API failed: ${res.status}`);
      const data = await res.json();
      const rows = parseSummerMealsApiPayload(data)
        .map(mapSummerMealSite)
        .filter(Boolean);
      if (rows.length) return rows;
      throw new Error('Summer meals API returned no sites');
    } catch {
      return fetchSummerMealsFromArcgis(centerLat, centerLng, radiusMiles);
    }
  }

  async function loadWicNorthCarolina() {
    if (wicNorthCarolinaCache) return wicNorthCarolinaCache;

    const res = await fetch(WIC_NC_JSON);
    if (!res.ok) throw new Error(`WIC data failed to load: ${res.status}`);
    const locations = await res.json();
    if (!Array.isArray(locations)) throw new Error('Invalid WIC data format');

    wicNorthCarolinaCache = locations.filter(
      (r) =>
        r &&
        typeof r.name === 'string' &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng)
    );
    console.log(`Loaded ${wicNorthCarolinaCache.length} NC WIC clinics`);
    return wicNorthCarolinaCache;
  }

  async function fetchWicNear(centerLat, centerLng, radiusMiles) {
    const locations = await loadWicNorthCarolina();
    return filterByRadius(locations, centerLat, centerLng, radiusMiles);
  }

  async function fetchAllResources(centerLat, centerLng, radiusMiles) {
    const safe = async (fn) => {
      try {
        return await fn();
      } catch {
        return [];
      }
    };

    const [snap, foodBanks, mealsAllAges, summerMeals, wic] = await Promise.all([
      safe(() => fetchSnapNear(centerLat, centerLng, radiusMiles)),
      safe(() => fetchFeedingAmericaFoodBanks(centerLat, centerLng, radiusMiles)),
      safe(() => fetchFreeMealsAllAgesNear(centerLat, centerLng, radiusMiles)),
      safe(() => fetchSummerMealsNear(centerLat, centerLng, radiusMiles)),
      safe(() => fetchWicNear(centerLat, centerLng, radiusMiles)),
    ]);

    return {
      resources: dedupeByName([
        ...snap,
        ...foodBanks,
        ...mealsAllAges,
        ...summerMeals,
        ...wic,
      ]),
    };
  }

  async function loadTransitData() {
    if (transitDataCache) return transitDataCache;

    try {
      const res = await fetch(GTFS_NC_ROUTES_JSON);
      if (!res.ok) throw new Error(`GTFS data failed to load: ${res.status}`);
      const geojson = await res.json();
      if (
        !geojson ||
        geojson.type !== 'FeatureCollection' ||
        !Array.isArray(geojson.features)
      ) {
        throw new Error('Invalid GTFS GeoJSON format');
      }
      transitDataCache = geojson;
      return transitDataCache;
    } catch (err) {
      console.error('loadTransitData failed:', err);
      return null;
    }
  }

  function normalizeFoodAccessShare(value) {
    if (value === null || value === undefined) return null;
    let v = Number(value);
    if (Number.isNaN(v)) return null;
    if (v > 1) v = v / 100;
    return v;
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((x) => {
      const h = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return h.length === 1 ? `0${h}` : h;
    }).join('')}`;
  }

  function lerpColor(hex1, hex2, t) {
    const [r1, g1, b1] = hexToRgb(hex1);
    const [r2, g2, b2] = hexToRgb(hex2);
    return rgbToHex(
      r1 + (r2 - r1) * t,
      g1 + (g2 - g1) * t,
      b1 + (b2 - b1) * t
    );
  }

  function getFoodDesertColor(value) {
    if (value === null || value === undefined || value === '') return null;

    const v = parseFloat(value);
    const normalized = v > 1 ? v / 100 : v;
    if (Number.isNaN(normalized)) return null;

    if (normalized <= 0.2) {
      const t = normalized / 0.2;
      return lerpColor('#4ade80', '#facc15', t);
    }
    if (normalized <= 0.4) {
      const t = (normalized - 0.2) / 0.2;
      return lerpColor('#facc15', '#f97316', t);
    }
    if (normalized <= 0.65) {
      const t = (normalized - 0.4) / 0.25;
      return lerpColor('#f97316', '#dc2626', t);
    }
    return '#dc2626';
  }

  function getNearestStop(lat, lng, stopFeatures) {
    if (!stopFeatures || stopFeatures.length === 0) return null;

    let nearest = null;
    let minDistanceMi = Infinity;

    for (const feature of stopFeatures) {
      const [sLng, sLat] = feature.geometry.coordinates;
      const R = 3958.8;
      const dLat = (sLat - lat) * Math.PI / 180;
      const dLon = (sLng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceMi = R * c;

      if (distanceMi < minDistanceMi) {
        minDistanceMi = distanceMi;
        nearest = feature;
      }
    }

    const distance_mi = Math.round(minDistanceMi * 10) / 10;
    const walk_min = Math.ceil(distance_mi / 0.05);

    return {
      stop_name: nearest.properties.stop_name,
      route_ids: nearest.properties.route_ids || [],
      distance_mi,
      walk_min,
    };
  }

  global.ProvideDataSources = {
    fetchAllResources,
    fetchSnapNear,
    fetchFeedingAmericaFoodBanks,
    fetchNC211,
    fetchFoodBankCenc,
    fetchSummerMealsNear,
    fetchFreeMealsAllAgesNear,
    fetchWicNear,
    loadSnapNorthCarolina,
    loadWicNorthCarolina,
    loadTransitData,
    getNearestStop,
    getSnapStoreCategory,
    getFoodDesertColor,
    normalizeFoodAccessShare,
    geocodeAddress,
  };
})(window);
