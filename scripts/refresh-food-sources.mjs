#!/usr/bin/env node
/**
 * Refresh local caches for NC 211 and Food Bank CENC FoodFinder (browser CORS fallback).
 * Usage: node scripts/refresh-food-sources.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NC211_API_KEY = '21ccc53661d64eddbf492cb4f0c4492c';
const NC211_SEARCH_URL =
  'https://api.211.org/search/v1/api/search/keyword';
const FOOD_FINDER_LOCATIONS_URL =
  'https://foodfinder.foodbankcenc.org/api/v1/locations';

const NC211_RADIUS_MILES = 25;
const NC211_TOP = 100;

/** Major NC population centers — 25 mi radius each, merged statewide. */
const NC211_QUERY_ZIPS = [
  { zip: '28202', label: 'Charlotte' },
  { zip: '27601', label: 'Raleigh' },
  { zip: '27701', label: 'Durham' },
  { zip: '27401', label: 'Greensboro' },
  { zip: '27101', label: 'Winston-Salem' },
  { zip: '28801', label: 'Asheville' },
  { zip: '28401', label: 'Wilmington' },
  { zip: '28301', label: 'Fayetteville' },
  { zip: '27834', label: 'Greenville' },
  { zip: '28543', label: 'Jacksonville' },
  { zip: '28144', label: 'Salisbury' },
  { zip: '28115', label: 'Mooresville' },
  { zip: '28025', label: 'Concord' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNC211Keyword(location, distanceMiles, top) {
  const url = new URL(NC211_SEARCH_URL);
  url.searchParams.set('keyword', 'food pantry');
  url.searchParams.set('location', location);
  url.searchParams.set('distance', String(distanceMiles));
  url.searchParams.set('skip', '0');
  url.searchParams.set('top', String(top));

  const res = await fetch(url.toString(), {
    headers: { 'Api-Key': NC211_API_KEY },
  });
  if (!res.ok) throw new Error(`NC 211 search failed: ${res.status} (${location})`);
  return res.json();
}

function mapNC211Document(doc) {
  const lat = parseFloat(doc.latitudeLocation);
  const lng = parseFloat(doc.longitudeLocation);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const locationId =
    doc.idLocation || doc.idServiceAtLocation || doc.idService || doc.id;
  if (!locationId) return null;

  const address = [
    doc.address1PhysicalAddress,
    doc.cityPhysicalAddress,
    doc.statePhysicalAddress,
    doc.regionPhysicalAddress,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    nc211LocationId: String(locationId),
    name: (doc.nameService || doc.nameOrganization || 'Food Pantry').trim(),
    lat,
    lng,
    address: address || 'North Carolina',
    phone: '',
    category: 'food_bank',
  };
}

function dedupeNC211ByLocationId(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row?.nc211LocationId) continue;
    byId.set(row.nc211LocationId, row);
  }
  return [...byId.values()];
}

async function fetchNC211Statewide() {
  const merged = [];

  for (const { zip, label } of NC211_QUERY_ZIPS) {
    const data = await fetchNC211Keyword(zip, NC211_RADIUS_MILES, NC211_TOP);
    const rows = (data.results || [])
      .map((item) => mapNC211Document(item.document || item))
      .filter(Boolean);
    console.log(
      `  ${label} (${zip}): ${rows.length} rows (API count ${data.count ?? '?'})`
    );
    merged.push(...rows);
    await sleep(300);
  }

  const deduped = dedupeNC211ByLocationId(merged);
  console.log(
    `NC 211 merged: ${merged.length} raw → ${deduped.length} unique locations`
  );
  return deduped;
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
    phone: loc.phone ? String(loc.phone) : '',
    category: 'food_bank',
  };
}

async function main() {
  console.log('Fetching NC 211 food pantries (statewide ZIP hubs)...');
  const nc211Rows = await fetchNC211Statewide();

  writeFileSync(
    join(ROOT, 'data', 'nc211-food-pantries.json'),
    JSON.stringify(nc211Rows, null, 2)
  );
  console.log(`Wrote ${nc211Rows.length} NC 211 food pantry rows`);

  const ffRes = await fetch(FOOD_FINDER_LOCATIONS_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!ffRes.ok) throw new Error(`FoodFinder API failed: ${ffRes.status}`);
  const ffData = await ffRes.json();
  const ffRows = (ffData.locations || [])
    .map(mapFoodFinderLocation)
    .filter(Boolean);

  writeFileSync(
    join(ROOT, 'data', 'foodbankcenc-locations.json'),
    JSON.stringify(ffRows, null, 2)
  );
  console.log(`Wrote ${ffRows.length} Food Bank CENC locations`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
