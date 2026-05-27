#!/usr/bin/env node
/**
 * One-time: NC census tracts + USDA Food Access Atlas (CSV) → merged GeoJSON.
 * Usage: node scripts/prepare-food-desert.mjs
 */
import { createReadStream, createWriteStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { parse } from 'csv-parse';
import AdmZip from 'adm-zip';
import * as shapefile from 'shapefile';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');

const TRACT_URL =
  'https://www2.census.gov/geo/tiger/TIGER2010/TRACT/2010/tl_2010_37_tract10.zip';
const USDA_CSV_URL =
  'https://www.ers.usda.gov/webdocs/DataFiles/80591/FoodAccessResearchAtlasData2019.csv';
const USDA_ZIP_URL =
  'https://www.ers.usda.gov/media/5627/food-access-research-atlas-data-download-2019.zip';

async function downloadBuffer(url, label) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} download failed: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function downloadToFile(url, filePath, label) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} download failed: ${res.status}`);
  }
  if (!res.body) throw new Error(`No response body for ${label}`);
  await pipeline(res.body, createWriteStream(filePath));
}

async function buildNcTractsGeojson() {
  console.log('✓ Downloaded NC census tracts');

  const zipBuffer = await downloadBuffer(TRACT_URL, 'TIGER tracts');
  const tempDir = join(tmpdir(), `provide-tracts-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(tempDir, true);

  const shpEntry = zip
    .getEntries()
    .find((entry) => entry.entryName.endsWith('.shp'));
  if (!shpEntry) throw new Error('No .shp in TIGER zip');

  const geojson = await shapefile.read(join(tempDir, shpEntry.entryName));
  const outPath = join(DATA_DIR, 'nc-tracts.geojson');
  writeFileSync(outPath, JSON.stringify(geojson));

  console.log(`✓ Converted shapefile → ${geojson.features.length} features`);
  return geojson;
}

async function resolveUsdaCsvPath() {
  const res = await fetch(USDA_CSV_URL, { method: 'HEAD' });
  if (res.ok) {
    const csvPath = join(tmpdir(), `usda-food-access-${Date.now()}.csv`);
    await downloadToFile(USDA_CSV_URL, csvPath, 'USDA CSV');
    return csvPath;
  }

  const zipBuffer = await downloadBuffer(USDA_ZIP_URL, 'USDA ZIP');
  const zip = new AdmZip(zipBuffer);
  const csvEntry = zip
    .getEntries()
    .find(
      (entry) =>
        entry.entryName.endsWith('.csv') &&
        !/readme|variablelookup/i.test(entry.entryName)
    );
  if (!csvEntry) throw new Error('CSV not found in USDA ZIP');

  const csvPath = join(tmpdir(), `usda-food-access-${Date.now()}.csv`);
  writeFileSync(csvPath, csvEntry.getData());
  return csvPath;
}

function normalizeShare(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return null;
  const n = Number(val);
  return n > 1 ? n / 100 : n;
}

async function parseNcUsdaRows(csvPath) {
  console.log('✓ Downloaded USDA CSV');

  const ncRows = [];

  await new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => {
        if (!String(row.CensusTract).startsWith('37')) return;

        ncRows.push({
          CensusTract: String(row.CensusTract),
          County: String(row.County || '').trim(),
          LILATracts_1And10: Number(row.LILATracts_1And10),
          PovertyRate:
            Number(row.PovertyRate) > 1
              ? Number(row.PovertyRate) / 100
              : Number(row.PovertyRate),
          MedianFamilyIncome: Number(row.MedianFamilyIncome),
          lapop1share: normalizeShare(Number(row.lapop1share)),
          lalowi1share: normalizeShare(Number(row.lalowi1share)),
          lapophalfshare: Number(row.lapophalfshare),
          Urban: Number(row.Urban),
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`✓ Parsed ${ncRows.length} NC rows (FIPS 37)`);
  return ncRows;
}

function mergeTractsWithUsda(geojson, ncRows) {
  const usdaLookup = new Map(ncRows.map((row) => [row.CensusTract, row]));

  let matched = 0;
  let desertCount = 0;

  geojson.features.forEach((feature) => {
    const geoid = feature.properties.GEOID10;
    const usda = usdaLookup.get(geoid);

    if (usda) {
      matched += 1;
      feature.properties.lapop1share = usda.lapop1share;
      feature.properties.lalowi1share = usda.lalowi1share;
      feature.properties.County = usda.County;
      feature.properties.LILATracts_1And10 = usda.LILATracts_1And10;
      feature.properties.PovertyRate =
        usda.PovertyRate > 1 ? usda.PovertyRate / 100 : usda.PovertyRate;
      feature.properties.MedianFamilyIncome = usda.MedianFamilyIncome;
      feature.properties.Urban = usda.Urban;
      feature.properties.isDesert = usda.LILATracts_1And10 === 1;
      if (feature.properties.isDesert) desertCount += 1;
    } else {
      feature.properties.lapop1share = null;
      feature.properties.lalowi1share = null;
      feature.properties.isDesert = false;
    }
  });

  const unmatched = geojson.features.length - matched;
  console.log(`✓ Joined: ${matched} matched, ${unmatched} unmatched`);
  console.log(`✓ Food deserts: ${desertCount} tracts`);

  return {
    type: 'FeatureCollection',
    features: geojson.features,
  };
}

async function patchExistingGeojson() {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const geojsonPath = join(DATA_DIR, 'nc-food-desert.geojson');
  const geojson = JSON.parse(readFileSync(geojsonPath, 'utf8'));
  const csvPath = await resolveUsdaCsvPath();
  const ncRows = await parseNcUsdaRows(csvPath);
  const merged = mergeTractsWithUsda(geojson, ncRows);
  writeFileSync(geojsonPath, JSON.stringify(merged));
  const mb = statSync(geojsonPath).size / 1024 / 1024;
  console.log(`✓ Patched ${geojsonPath} — ${mb.toFixed(1)}MB`);
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (process.argv.includes('--patch')) {
    await patchExistingGeojson();
    return;
  }

  const geojson = await buildNcTractsGeojson();

  const csvPath = await resolveUsdaCsvPath();
  const ncRows = await parseNcUsdaRows(csvPath);

  const merged = mergeTractsWithUsda(geojson, ncRows);
  const outPath = join(DATA_DIR, 'nc-food-desert.geojson');
  writeFileSync(outPath, JSON.stringify(merged));

  const mb = statSync(outPath).size / 1024 / 1024;
  console.log(`✓ Saved ${outPath} — ${mb.toFixed(1)}MB`);

  if (mb > 3) {
    console.log(
      'File over 3MB — run: npx mapshaper nc-food-desert.geojson -simplify 10% -o data/nc-food-desert.geojson'
    );
    console.log('Install mapshaper if needed: npm install -g mapshaper');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
