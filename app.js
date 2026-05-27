// ─── Config ───────────────────────────────────────────────────
const CHARLOTTE_CENTER = [35.2271, -80.8431];

const colors = {
  snap: '#3B82F6',
  food_bank: '#F97316',
  free_meals_all_ages: '#EAB308',
  free_meals_under_18: '#EC4899',
  wic: '#A855F7',
};

const CATEGORY_LABELS = {
  snap: 'SNAP Retailer',
  food_bank: 'Food Pantry',
  free_meals_all_ages: 'Free Meals (all ages)',
  free_meals_under_18: 'Free Meals (under 18)',
  wic: 'WIC Location',
};

const FILTER_TYPE_MAP = {
  snap: 'snap',
  foodbank: 'food_bank',
  'meal-all': 'free_meals_all_ages',
  'meal-under18': 'free_meals_under_18',
  wic: 'wic',
};

const CARD_CLASS_MAP = {
  snap: 'snap',
  food_bank: 'foodbank',
  free_meals_all_ages: 'meal-all',
  free_meals_under_18: 'meal-under18',
  wic: 'wic',
};

const SCARCITY_TRACKER_LABEL = 'Food Scarcity Tracker';

// ─── State ────────────────────────────────────────────────────
let map;
let markersLayer = [];
let radiusCircle = null;
let selectedMiles = 2;
let allResources = [];
let searchCenter = null;
let searchGeneration = 0;
let foodDesertLayer = null;
let foodDesertData = null;
let transitLayer = null;
let transitStopLayer = null;
let transitRouteFeatures = [];
let transitStopFeatures = [];
let transitDataLoaded = false;
let transitLoadPromise = null;
let homeMarker = null;
let shareApproxLat = null;
let shareApproxLng = null;
let resourceTravelCache = new Map();
let mapClickToSearchEnabled = false;

function isExplorerPreviewEmbed() {
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

function lockMapForPreview() {
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  if (map.tap) map.tap.disable();
  map.getContainer().style.cursor = 'default';
}

// ─── Init Map ─────────────────────────────────────────────────
function initMap() {
  const isPreview = isExplorerPreviewEmbed();

  map = L.map('map', {
    center: CHARLOTTE_CENTER,
    zoom: 12,
    zoomControl: !isPreview,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  map.on('zoomend', updateTransitStopVisibility);

  if (isPreview) {
    lockMapForPreview();
  } else {
    mapClickToSearchEnabled = true;
    map.on('click', handleMapClickToSearch);
  }
}

function getActiveCategories() {
  const active = [];
  document.querySelectorAll('.filter-cb').forEach((cb) => {
    if (cb.checked) {
      const key = FILTER_TYPE_MAP[cb.dataset.type];
      if (key) active.push(key);
    }
  });
  return active;
}

function getActiveCategoryHashIds() {
  const ids = [];
  document.querySelectorAll('.filter-cb').forEach((cb) => {
    if (cb.checked && cb.dataset.type) ids.push(cb.dataset.type);
  });
  return ids;
}

function applyCategoryFiltersFromHash(catParam) {
  const allowed = new Set(
    catParam
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
  if (!allowed.size) return;

  document.querySelectorAll('.filter-cb').forEach((cb) => {
    if (!cb.dataset.type) return;
    cb.checked = allowed.has(cb.dataset.type);
  });
}

function setRadiusFromHash(radiusParam) {
  const miles = parseInt(radiusParam, 10);
  if (![2, 5, 10].includes(miles)) return;

  selectedMiles = miles;
  document.querySelectorAll('.radius-btn').forEach((btn) => {
    const btnMiles = parseInt(btn.dataset.miles, 10);
    btn.classList.toggle('active', btnMiles === miles);
  });
}

function getAddressInputValue() {
  const input = document.getElementById('address-input');
  if (!input) return '';
  return input.value.trim().replace(/\s+/g, ' ');
}

function showAddressError(message) {
  const errorEl = document.getElementById('address-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideAddressError() {
  const errorEl = document.getElementById('address-error');
  if (!errorEl) return;
  errorEl.style.display = 'none';
}

function updateShareableHash() {
  if (!searchCenter) return;

  const address = getAddressInputValue();
  if (!address) return;

  const params = new URLSearchParams();
  params.set('address', address);
  params.set('r', String(selectedMiles));
  params.set('cat', getActiveCategoryHashIds().join(','));
  if (shareApproxLat != null && shareApproxLng != null) {
    params.set('approx', '1');
    params.set('lat', shareApproxLat.toFixed(6));
    params.set('lng', shareApproxLng.toFixed(6));
  }

  const hash = params.toString();
  if (window.location.hash.slice(1) === hash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}#${hash}`;
  window.history.replaceState(null, '', nextUrl);
}

function setCopyLinkVisible(visible) {
  const utilityBtns = document.querySelector('.results-utility-btns');
  const copyBtn = document.getElementById('copy-link-btn');
  const printBtn = document.getElementById('print-btn');

  if (utilityBtns) utilityBtns.style.display = visible ? 'flex' : 'none';
  if (copyBtn) copyBtn.style.display = visible ? '' : 'none';
  if (printBtn) printBtn.style.display = visible ? '' : 'none';

  if (copyBtn) {
    copyBtn.textContent = visible ? 'Share this search' : 'Share this search';
    copyBtn.setAttribute('aria-label', 'Share this search');
    copyBtn.title = 'Copy a shareable link to this exact search';
  }
}

function printResourceList() {
  if (!searchCenter) return;

  const address = getAddressInputValue() || '';
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const header = document.createElement('div');
  header.id = 'print-header';
  header.innerHTML = `
    <h2>Food resources near ${escapeHtml(address)} · within ${selectedMiles} miles</h2>
    <p>Found via Provide · provide-nc.org · ${escapeHtml(today)}</p>
    <p>For help finding food resources, call 2-1-1</p>
  `;
  document.body.prepend(header);

  window.addEventListener(
    'afterprint',
    () => {
      document.getElementById('print-header')?.remove();
    },
    { once: true }
  );

  window.print();
}

async function bootEmbeddedPreview() {
  document.documentElement.classList.add('explorer-preview-embed');

  const addressInput = document.getElementById('address-input');
  if (addressInput) addressInput.value = '28202';

  setRadiusFromHash('5');
  await runSearchAt(CHARLOTTE_CENTER[0], CHARLOTTE_CENTER[1]);

  const foodToggle = document.getElementById('food-desert-toggle');
  const legend = document.getElementById('food-desert-legend');
  if (foodToggle) {
    foodToggle.checked = true;
    const label = getFoodDesertToggleLabel();
    if (label) label.textContent = 'Loading...';
    try {
      await renderFoodDesertOverlay();
    } finally {
      if (foodToggle.checked && label) {
        label.textContent = SCARCITY_TRACKER_LABEL;
      }
    }
    if (legend) {
      legend.classList.remove('hidden');
      legend.hidden = false;
    }
  }

  const transitToggleEl = document.getElementById('transit-toggle');
  if (transitToggleEl && searchCenter) {
    transitToggleEl.checked = true;
    await loadTransitOverlay();
    if (transitDataLoaded) {
      buildTransitLayers(searchCenter.lat, searchCenter.lng, selectedMiles);
    }
  }

  renderAll();
  if (radiusCircle) radiusCircle.bringToFront();
  if (homeMarker) homeMarker.bringToFront();

  window.setTimeout(() => map.invalidateSize(), 100);
  window.setTimeout(() => map.invalidateSize(), 500);
}

function restoreSearchFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const address = params.get('address') || params.get('zip');
  if (!address) return;

  const addressInput = document.getElementById('address-input');
  if (addressInput) addressInput.value = address;

  const radius = params.get('r');
  if (radius) setRadiusFromHash(radius);

  const cats = params.get('cat');
  if (cats) applyCategoryFiltersFromHash(cats);

  const approxFlag = params.get('approx');
  const approxLatRaw = params.get('lat');
  const approxLngRaw = params.get('lng');

  if (approxFlag === '1' && approxLatRaw && approxLngRaw) {
    const approxLat = parseFloat(approxLatRaw);
    const approxLng = parseFloat(approxLngRaw);
    if (Number.isFinite(approxLat) && Number.isFinite(approxLng)) {
      shareApproxLat = approxLat;
      shareApproxLng = approxLng;
      runSearchAt(approxLat, approxLng, { showHomeMarker: true });
      return;
    }
  }

  shareApproxLat = null;
  shareApproxLng = null;
  doSearch();
}

async function reverseGeocodeZip(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'ProvideApp/1.0',
    },
  });
  if (!res.ok) return { zip: null, inNC: false };
  const data = await res.json();
  const postcode = data.address?.postcode;
  const state = data.address?.state;

  let inNC = state === 'North Carolina';
  const displayName = data.display_name || '';
  if (!inNC) {
    inNC = displayName.includes('North Carolina') || displayName.includes(', NC');
  }

  if (!inNC) return { zip: null, inNC: false };

  if (postcode && /^\d{5}/.test(postcode)) {
    return { zip: postcode.slice(0, 5), inNC: true };
  }
  return { zip: null, inNC: true };
}

async function handleMapClickToSearch(e) {
  if (!mapClickToSearchEnabled) return;
  const target = e.originalEvent?.target;
  if (target?.closest?.('.leaflet-interactive')) return; // ignore marker/popup clicks

  const lat = e.latlng?.lat;
  const lng = e.latlng?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const addressInput = document.getElementById('address-input');
  if (!addressInput) return;

  if (!window.ProvideDataSources) {
    showResultsMessage('<p>Data layer failed to load. Refresh the page.</p>');
    return;
  }

  let zip = null;
  let inNC = true;
  try {
    const res = await reverseGeocodeZip(lat, lng);
    zip = res.zip;
    inNC = res.inNC;
  } catch {
    zip = null;
    inNC = true;
  }

  if (!inNC) {
    showAddressError(
      'This location is outside NC — please click on a North Carolina address or ZIP.'
    );
    return;
  }

  shareApproxLat = null;
  shareApproxLng = null;

  hideAddressError();
  if (zip) {
    addressInput.value = zip;
  } else {
    addressInput.value = 'Approx location';
    shareApproxLat = lat;
    shareApproxLng = lng;
  }

  const showHomeMarker = !isZipOnlyQuery(addressInput.value);
  await runSearchAt(lat, lng, { showHomeMarker });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTractFoodAccessShareRaw(properties) {
  if (properties.lalowi1share != null && properties.lalowi1share !== '') {
    return properties.lalowi1share;
  }
  if (properties.lapop1share != null && properties.lapop1share !== '') {
    return properties.lapop1share;
  }
  return null;
}

function getFoodDesertToggleLabel() {
  const toggle = document.getElementById('food-desert-toggle');
  if (!toggle) return null;
  return toggle.closest('.scarcity-toggle')?.querySelector('.food-desert-label') ?? null;
}

function getFoodDesertStyle(feature) {
  const { lalowi1share } = feature.properties;
  const fillColor = window.ProvideDataSources.getFoodDesertColor(lalowi1share);

  if (fillColor === null) {
    return {
      fill: true,
      fillColor: '#e5e7eb',
      fillOpacity: 0.3,
      weight: 0.3,
      color: '#94a3b8',
      opacity: 1,
    };
  }

  return {
    fill: true,
    fillColor,
    fillOpacity: 0.65,
    weight: 0.3,
    color: '#94a3b8',
    opacity: 1,
  };
}

function getFoodDesertOutlineStyle() {
  return {
    fillOpacity: 0,
    weight: 2.5,
    color: '#7f1d1d',
  };
}

function formatPovertyRate(p) {
  if (p.PovertyRate == null || p.PovertyRate === undefined) return 'N/A';
  const rate = window.ProvideDataSources.normalizeFoodAccessShare(p.PovertyRate);
  if (rate === null) return 'N/A';
  return `${(rate * 100).toFixed(0)}%`;
}

function getTractCountyLine(p) {
  const county = p.County || p.county;
  if (!county) return '';
  return `<span style="color:#999;font-size:11px;">${escapeHtml(county)} County</span><br/>`;
}

function buildTractTooltipHtml(p) {
  if (window.ProvideDataSources.getFoodDesertColor(p.lalowi1share) === null) {
    return `
      <div class="food-desert-tooltip-inner">
        <span style="color:#ccc;">Data is not available</span><br/>
        ${getTractCountyLine(p)}
      </div>
    `;
  }

  const share = window.ProvideDataSources.normalizeFoodAccessShare(
    getTractFoodAccessShareRaw(p)
  );
  if (share === null) return null;

  const pct = `${(share * 100).toFixed(0)}%`;
  const desertLine =
    p.LILATracts_1And10 === 1
      ? '<span style="color:#dc2626;font-weight:600;">⚠️ USDA-designated food desert</span><br/>'
      : '';

  return `
    <div class="food-desert-tooltip-inner">
      <strong style="color:#fff;">${pct}</strong>
      <span style="color:#ccc;"> of low-income residents have low food access</span><br/>
      ${desertLine}
      ${getTractCountyLine(p)}
    </div>
  `;
}

function buildTractPopupHtml(p) {
  const share = window.ProvideDataSources.normalizeFoodAccessShare(
    getTractFoodAccessShareRaw(p)
  );
  if (share === null) return null;

  const pct = `${(share * 100).toFixed(0)}%`;
  const desertLine =
    p.LILATracts_1And10 === 1
      ? '<p style="color:#dc2626;font-weight:600;margin:0 0 8px;">⚠️ USDA-designated food desert</p>'
      : '';
  const poverty = formatPovertyRate(p);
  const income = p.MedianFamilyIncome
    ? `$${Number(p.MedianFamilyIncome).toLocaleString()}`
    : 'N/A';
  const areaType = p.Urban === 1 ? 'Urban tract' : 'Rural tract';
  const countyLine = getTractCountyLine(p);

  return `
    <div style="font-family:sans-serif;font-size:12px;min-width:200px;line-height:1.6;">
      <p style="margin:0 0 8px;">
        <strong>${pct}</strong> of low-income residents have low food access
      </p>
      ${desertLine}
      ${countyLine}
      <span style="color:#666;font-size:11px;">${areaType}</span><br/>
      <hr style="border-color:#e5e7eb;margin:8px 0;"/>
      <span style="color:#666;">Poverty rate:</span>
      <strong>${poverty}</strong><br/>
      <span style="color:#666;">Median family income:</span>
      <strong>${income}</strong>
    </div>
  `;
}

function onEachTract(feature, layer) {
  const p = feature.properties;
  const tooltipHtml = buildTractTooltipHtml(p);
  if (!tooltipHtml) return;

  layer.bindTooltip(tooltipHtml, {
    sticky: true,
    opacity: 0.95,
    className: 'food-desert-tooltip',
  });

  const popupHtml = buildTractPopupHtml(p);
  if (popupHtml) {
    layer.bindPopup(popupHtml);
  }
}

async function renderFoodDesertOverlay() {
  if (!foodDesertData) {
    try {
      const res = await fetch('data/nc-food-desert.geojson');
      if (!res.ok) throw new Error('Failed to load food desert data');
      foodDesertData = await res.json();
    } catch (err) {
      console.error('Food desert overlay error:', err);
      showFoodDesertError();
      return;
    }
  }

  removeFoodDesertOverlay();

  const fillLayer = L.geoJSON(foodDesertData, {
    style: getFoodDesertStyle,
    onEachFeature: onEachTract,
  });

  const desertFeatures = foodDesertData.features.filter(
    (feature) => feature.properties.LILATracts_1And10 === 1
  );

  const outlineLayer = L.geoJSON(
    { type: 'FeatureCollection', features: desertFeatures },
    {
      style: getFoodDesertOutlineStyle,
      interactive: false,
    }
  );

  foodDesertLayer = L.layerGroup();
  fillLayer.addTo(foodDesertLayer);
  outlineLayer.addTo(foodDesertLayer);
  foodDesertLayer.addTo(map);
  foodDesertLayer.bringToBack();
  if (radiusCircle && map.hasLayer(radiusCircle)) {
    radiusCircle.bringToFront();
  }
}

function removeFoodDesertOverlay() {
  if (foodDesertLayer) {
    map.removeLayer(foodDesertLayer);
    foodDesertLayer = null;
  }
}

function shouldShowTransitOverlayUi(options) {
  if (options && options.silent) return false;
  return Boolean(document.getElementById('transit-toggle')?.checked);
}

function haversineDistance(centerLat, centerLng, lat, lng) {
  const R = 3958.8;
  const dLat = (lat - centerLat) * Math.PI / 180;
  const dLon = (lng - centerLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(centerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function routeIntersectsRadius(routeFeature, centerLat, centerLng, radiusMi) {
  return routeFeature.geometry.coordinates.some(([lng, lat]) => {
    return haversineDistance(centerLat, centerLng, lat, lng) <= radiusMi;
  });
}

function stopInRadius(stopFeature, centerLat, centerLng, radiusMi) {
  const [lng, lat] = stopFeature.geometry.coordinates;
  return haversineDistance(centerLat, centerLng, lat, lng) <= radiusMi;
}

function showTransitNoSearchMessage() {
  const msgEl = document.getElementById('transit-no-search-msg');
  if (!msgEl) return;
  msgEl.style.display = 'inline';
  setTimeout(() => {
    msgEl.style.display = 'none';
  }, 3000);
}

function buildTransitLayers(centerLat, centerLng, radiusMi) {
  if (transitLayer) {
    map.removeLayer(transitLayer);
    transitLayer = null;
  }
  if (transitStopLayer) {
    map.removeLayer(transitStopLayer);
    transitStopLayer = null;
  }

  const routesInRadius = transitRouteFeatures.filter((feature) =>
    routeIntersectsRadius(feature, centerLat, centerLng, radiusMi)
  );
  const stopsInRadius = transitStopFeatures.filter((feature) =>
    stopInRadius(feature, centerLat, centerLng, radiusMi)
  );

  transitLayer = L.layerGroup();
  routesInRadius.forEach((feature) => {
    const color = feature.properties.color || '#6B7280';
    const latlngs = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const line = L.polyline(latlngs, { color, weight: 2.5, opacity: 0.75 });
    const routeName = escapeHtml(
      `${feature.properties.route_short_name || ''} ${feature.properties.route_long_name || ''}`.trim()
    );
    const agencyName = escapeHtml(feature.properties.agency_name || '');
    line.bindPopup(
      `<strong>${routeName}</strong><br>` +
      `<span style="color:#666;font-size:12px">${agencyName}</span>`
    );
    transitLayer.addLayer(line);
  });

  transitStopLayer = L.layerGroup();
  stopsInRadius.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = L.circleMarker([lat, lng], {
      radius: 4,
      fillColor: '#ffffff',
      fillOpacity: 1,
      color: '#555555',
      weight: 1.5,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(feature.properties.stop_name)}</strong><br>` +
      '<span style="color:#666;font-size:12px">Bus stop</span>'
    );
    transitStopLayer.addLayer(marker);
  });

  if (document.getElementById('transit-toggle')?.checked) {
    transitLayer.addTo(map);
  }
  updateTransitStopVisibility();
}

function refreshTransitLayers() {
  if (!transitDataLoaded) return;
  if (!document.getElementById('transit-toggle')?.checked) return;
  if (!searchCenter) return;

  buildTransitLayers(searchCenter.lat, searchCenter.lng, selectedMiles);
}

async function loadTransitOverlay(options = {}) {
  if (transitDataLoaded) return;
  if (!transitLoadPromise) {
    transitLoadPromise = loadTransitOverlayWork(options).finally(() => {
      transitLoadPromise = null;
    });
  }
  return transitLoadPromise;
}

async function loadTransitOverlayWork(options = {}) {
  const showUi = shouldShowTransitOverlayUi(options);
  const loadingEl = document.getElementById('transit-loading');
  const errorEl = document.getElementById('transit-error');

  if (showUi && loadingEl) loadingEl.style.display = 'inline';
  if (showUi && errorEl) errorEl.style.display = 'none';

  const geojson = await window.ProvideDataSources.loadTransitData();

  const toggleChecked = Boolean(document.getElementById('transit-toggle')?.checked);
  if (loadingEl) loadingEl.style.display = 'none';

  if (!geojson) {
    if (toggleChecked && errorEl) errorEl.style.display = 'inline';
    return;
  }

  transitDataLoaded = true;

  transitRouteFeatures = geojson.features.filter((f) => f.properties.layer === 'route');
  transitStopFeatures = geojson.features.filter((f) => f.properties.layer === 'stop');

  refreshTransitLayers();
}

function updateTransitStopVisibility() {
  if (!transitDataLoaded || !transitStopLayer) return;
  const zoom = map.getZoom();
  const toggleOn = document.getElementById('transit-toggle')?.checked;
  if (toggleOn && zoom >= 13) {
    if (!map.hasLayer(transitStopLayer)) transitStopLayer.addTo(map);
  } else if (map.hasLayer(transitStopLayer)) {
    map.removeLayer(transitStopLayer);
  }
}

function appendTransitPopupBlock(popupHtml, lat, lng) {
  const nearestStop = window.ProvideDataSources.getNearestStop(
    lat,
    lng,
    transitStopFeatures
  );
  if (!nearestStop) return popupHtml;

  return `${popupHtml}
      <div class="popup-transit">
        🚌 <strong>${escapeHtml(nearestStop.stop_name)}</strong>
        &mdash; ${nearestStop.distance_mi} mi &middot; ~${nearestStop.walk_min} min walk
      </div>`;
}

function showFoodDesertError() {
  const toggle = document.getElementById('food-desert-toggle');
  if (toggle) {
    toggle.checked = false;
    const label = getFoodDesertToggleLabel();
    if (label) {
      label.textContent = `${SCARCITY_TRACKER_LABEL} (unavailable)`;
    }
  }
  const legend = document.getElementById('food-desert-legend');
  if (legend) {
    legend.classList.add('hidden');
    legend.hidden = true;
  }
}

function buildWicPopupHtml(resource) {
  const name = escapeHtml(resource.name);
  const address = escapeHtml(resource.address);
  const phone = resource.phone ? escapeHtml(resource.phone) : '';
  const sourceChip = resource.source
    ? `<div style="margin-top:10px;"><span class="popup-source-chip">Source: ${escapeHtml(resource.source)}</span></div>`
    : '';
  const telHref = resource.phone
    ? `tel:${String(resource.phone).replace(/[^\d+]/g, '')}`
    : '';

  let popupHtml = `
    <div style="font-family: sans-serif; min-width: 180px;">
      <strong style="font-size: 13px;">${name}</strong><br/>
      <span style="font-size: 12px; color: #666;">${address}</span><br/><br/>

      <div style="
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 4px;
        padding: 5px 8px;
        font-size: 11px;
        color: #92400e;
        margin-bottom: 8px;
      ">
        📞 <strong>Appointment required</strong><br/>
        Call before visiting · Walk-ins not accepted
      </div>

      ${phone ? `
      <a href="${telHref}" style="
        display: block;
        font-size: 12px;
        color: #a855f7;
        margin-bottom: 6px;
        text-decoration: none;
      ">📱 ${phone}</a>` : ''}

      <a href="https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}"
         target="_blank"
         rel="noopener noreferrer"
         style="font-size: 12px; color: #a855f7; text-decoration: none;">
        Get Directions →
      </a>
      ${sourceChip}
    </div>
  `;

  return appendTransitPopupBlock(popupHtml, resource.lat, resource.lng);
}

function buildSnapStoreTypeBlock(resource) {
  const storeType = resource.storeType;
  if (!storeType) return '';

  const category = window.ProvideDataSources.getSnapStoreCategory(storeType);
  if (category === 'grocery') {
    return '<span class="store-type-badge store-type-grocery">🛒 Grocery Store</span>';
  }
  if (category === 'convenience') {
    return `
      <span class="store-type-badge store-type-convenience">⚠️ Convenience Store</span>
      <p class="store-type-warning">
        Limited grocery selection — may not carry fresh produce or staple foods.
        Consider calling ahead before traveling.
      </p>
    `;
  }
  return '';
}

function isSnapGroceryOnlyFilterActive() {
  const el = document.getElementById('snap-grocery-only');
  return Boolean(el && el.checked);
}

function resourcePassesMapFilters(resource, activeCategories) {
  if (!activeCategories.includes(resource.category)) return false;
  if (
    resource.category === 'snap' &&
    isSnapGroceryOnlyFilterActive() &&
    window.ProvideDataSources.getSnapStoreCategory(resource.storeType || '') !==
      'grocery'
  ) {
    return false;
  }
  return true;
}

function buildPopupHtml(resource) {
  if (resource.category === 'wic') {
    return buildWicPopupHtml(resource);
  }

  const name = escapeHtml(resource.name);
  const address = escapeHtml(resource.address);
  const hoursLine = resource.hours
    ? `<div style="font-size: 12px; color: #666; margin-top:6px;">Hours: ${escapeHtml(
        resource.hours
      )}</div>`
    : '';
  const sourceChip = resource.source
    ? `<div style="margin-top:10px;"><span class="popup-source-chip">Source: ${escapeHtml(resource.source)}</span></div>`
    : '';
  const snapStoreTypeBlock =
    resource.category === 'snap' ? buildSnapStoreTypeBlock(resource) : '';
  let popupHtml = `
    <div style="font-family: sans-serif; min-width: 160px;">
      <strong style="font-size: 13px;">${name}</strong><br/>
      ${snapStoreTypeBlock}
      <span style="font-size: 12px; color: #666;">${address}</span><br/>
      ${hoursLine}
      <br/>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}"
         target="_blank"
         rel="noopener noreferrer"
         style="font-size: 12px; color: #22c55e; text-decoration: none;">
        Get Directions →
      </a>
      ${sourceChip}
    </div>
  `;

  return appendTransitPopupBlock(popupHtml, resource.lat, resource.lng);
}

// ─── Search ───────────────────────────────────────────────────
async function runSearchAt(lat, lng, options = {}) {
  hideAddressError();

  if (options.showHomeMarker) {
    setHomeMarker(lat, lng);
  } else {
    clearHomeMarker();
  }

  searchCenter = { lat, lng };
  map.setView([lat, lng], 13);
  drawRadiusCircle(lat, lng, selectedMiles);
  map.invalidateSize();
  await loadResourcesAt(lat, lng);
}

async function doSearch() {
  const addressInput = getAddressInputValue();

  if (!addressInput) {
    setCopyLinkVisible(false);
    showAddressError('Please enter an address or ZIP code.');
    return;
  }

  shareApproxLat = null;
  shareApproxLng = null;

  if (!window.ProvideDataSources) {
    showResultsMessage('<p>Data layer failed to load. Refresh the page.</p>');
    return;
  }

  let geocoded;
  try {
    geocoded = await window.ProvideDataSources.geocodeAddress(addressInput);
  } catch {
    geocoded = null;
  }

  if (!geocoded) {
    searchGeneration += 1;
    setLoading(false);
    setCopyLinkVisible(false);
    clearHomeMarker();
    showResultsMessage('<p>Address not found</p>');
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    searchCenter = null;
    allResources = [];
    applyStatsCounts(countResourcesByCategory([]));
    return;
  }

  if (!geocoded.inNC) {
    showAddressError(
      'This address is outside NC — please enter a North Carolina address or ZIP code.'
    );
    return;
  }

  await runSearchAt(geocoded.lat, geocoded.lng, {
    showHomeMarker: !isZipOnlyQuery(addressInput),
  });
}

function isZipOnlyQuery(query) {
  return /^\d{5}$/.test(query);
}

function createHomeMarkerIcon() {
  return L.divIcon({
    className: 'home-marker-wrap',
    html: `
      <div class="home-marker" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" fill="currentColor"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function clearHomeMarker() {
  if (homeMarker) {
    map.removeLayer(homeMarker);
    homeMarker = null;
  }
}

function setHomeMarker(lat, lng) {
  clearHomeMarker();
  homeMarker = L.marker([lat, lng], {
    icon: createHomeMarkerIcon(),
    zIndexOffset: 1000,
  });
  homeMarker.addTo(map);
  homeMarker.on('add', () => {
    const el = homeMarker.getElement && homeMarker.getElement();
    if (!el) return;
    el.setAttribute('aria-label', 'Search location');
    el.setAttribute('role', 'img');
    el.setAttribute('tabindex', '-1');
  });
}

function clearMarkers() {
  markersLayer.forEach((marker) => map.removeLayer(marker));
  markersLayer = [];
}

function drawRadiusCircle(lat, lng, radiusMiles) {
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  radiusCircle = L.circle([lat, lng], {
    radius: radiusMiles * 1609.34,
    color: '#4ade80',
    fillOpacity: 0.05,
    weight: 1.5,
  }).addTo(map);
}

const WALK_MIN_PER_MILE = 20; // ~3 mph
const BUS_MPH_EST = 12; // heuristic "on-bus" time

function getResourceTravelKey(resource) {
  const name = (resource.name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return `${resource.category}|${name}|${resource.lat.toFixed(5)}|${resource.lng.toFixed(5)}`;
}

function getResourceDomKey(resource) {
  const travelKey = getResourceTravelKey(resource);
  return travelKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function estimateWalkingMinutes(centerLat, centerLng, resource) {
  const miles = haversineDistance(centerLat, centerLng, resource.lat, resource.lng);
  return miles * WALK_MIN_PER_MILE;
}

function getRouteIdIntersection(idsA, idsB) {
  if (!Array.isArray(idsA) || !Array.isArray(idsB)) return [];
  if (!idsA.length || !idsB.length) return [];
  const setA = new Set(idsA);
  return idsB.filter((id) => setA.has(id));
}

function getNearestStopCached(lat, lng, cache) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  const stop = window.ProvideDataSources.getNearestStop(
    lat,
    lng,
    transitStopFeatures
  );
  cache.set(key, stop);
  return stop;
}

function escapeValueForHtml(text) {
  return escapeHtml(text == null ? '' : String(text));
}

function showDetailPanelForResource(resource, marker) {
  if (!resource) return;

  const detailPanel = document.getElementById('detail-panel');
  const detailTypeBadge = document.getElementById('detail-type-badge');
  const detailName = document.getElementById('detail-name');
  const detailAddress = document.getElementById('detail-address');
  const detailMeta = document.getElementById('detail-meta');
  const detailActions = document.getElementById('detail-actions');
  if (!detailPanel || !detailTypeBadge || !detailName || !detailAddress || !detailMeta || !detailActions) {
    return;
  }

  if (marker) {
    map.setView([resource.lat, resource.lng], 15);
    marker.openPopup();
  }

  // Active state for whichever card matches this resource.
  document.querySelectorAll('.result-card.active').forEach((el) => {
    el.classList.remove('active');
  });
  const domKey = getResourceDomKey(resource);
  const matchingCard = document.querySelector(
    `.result-card[data-resource-key="${domKey}"]`
  );
  if (matchingCard) matchingCard.classList.add('active');

  const badgeColor = colors[resource.category];
  detailTypeBadge.textContent =
    CATEGORY_LABELS[resource.category] || resource.category;
  detailTypeBadge.style.display = 'inline-block';
  detailTypeBadge.style.padding = '4px 10px';
  detailTypeBadge.style.borderRadius = '999px';
  if (badgeColor) {
    detailTypeBadge.style.background = `${badgeColor}22`;
    detailTypeBadge.style.color = badgeColor;
    detailTypeBadge.style.border = `1px solid ${badgeColor}55`;
  } else {
    detailTypeBadge.style.background = 'transparent';
    detailTypeBadge.style.border = '1px solid rgba(148,163,184,0.4)';
    detailTypeBadge.style.color = 'var(--text)';
  }

  detailName.textContent = resource.name || '';
  detailAddress.textContent = resource.address || '';

  const travelKey = getResourceTravelKey(resource);
  const travel = resourceTravelCache.get(travelKey);

  const metaRow = (key, valHtml) => `
    <div class="detail-meta-row">
      <span class="detail-meta-key">${escapeValueForHtml(key)}</span>
      <span class="detail-meta-val">${valHtml}</span>
    </div>
  `;

  const phone = resource.phone ? String(resource.phone).trim() : '';
  const hours = resource.hours ? String(resource.hours).trim() : '';
  const snapStoreType = resource.storeType ? String(resource.storeType).trim() : '';

  const phoneHtml = phone
    ? `<a href="tel:${String(phone).replace(/[^\d+]/g, '')}" style="color: var(--leaf); text-decoration: none;">${escapeValueForHtml(
        phone
      )}</a>`
    : '';

  const snapTypeHtml = snapStoreType
    ? (() => {
        const storeCategory = window.ProvideDataSources.getSnapStoreCategory(
          snapStoreType
        );
        const label =
          storeCategory === 'grocery'
            ? 'Grocery Store'
            : storeCategory === 'convenience'
              ? 'Convenience Store'
              : 'SNAP Store';
        return `${escapeValueForHtml(snapStoreType)} · ${label}`;
      })()
    : '';

  let transitHtml = '';
  if (travel?.centerNearestStop && travel?.stopToResource) {
    transitHtml = `${metaRow(
      'Nearest stop (you)',
      `${escapeValueForHtml(travel.centerNearestStop.stop_name)} · ~${travel.centerNearestStop.walk_min} min walk`
    )}${metaRow(
      'Nearest stop (site)',
      `${escapeValueForHtml(travel.stopToResource.stop_name)} · ~${travel.stopToResource.walk_min} min walk`
    )}`;
  } else {
    transitHtml = metaRow(
      'Nearest bus stop',
      transitDataLoaded ? 'Unavailable nearby' : 'Transit data not loaded'
    );
  }

  const sourceHtml = resource.source
    ? `<span class="source-chip">${escapeValueForHtml(resource.source)}</span>`
    : '';

  const metaParts = [];
  if (phoneHtml) metaParts.push(metaRow('Phone', phoneHtml));
  if (hours) metaParts.push(metaRow('Hours', escapeValueForHtml(hours).replace(/\n/g, '<br/>')));
  if (snapTypeHtml) metaParts.push(metaRow('SNAP type', snapTypeHtml));
  metaParts.push(transitHtml);
  if (sourceHtml) metaParts.push(metaRow('Source', sourceHtml));
  detailMeta.innerHTML = metaParts.join('');

  // Actions
  detailActions.innerHTML = '';

  const origin = searchCenter ? `${searchCenter.lat},${searchCenter.lng}` : '';
  const directionsHref = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${resource.lat},${resource.lng}`;

  const directionsLink = document.createElement('a');
  directionsLink.className = 'detail-btn btn-primary';
  directionsLink.href = directionsHref;
  directionsLink.target = '_blank';
  directionsLink.rel = 'noopener noreferrer';
  directionsLink.textContent = 'Directions';
  detailActions.appendChild(directionsLink);

  const callBtn = document.createElement('button');
  callBtn.className = 'detail-btn btn-secondary';
  callBtn.type = 'button';
  callBtn.textContent = 'Call';
  if (phone) {
    callBtn.onclick = () => {
      window.location.href = `tel:${String(phone).replace(/[^\d+]/g, '')}`;
    };
  } else {
    callBtn.disabled = true;
    callBtn.style.opacity = '0.55';
    callBtn.style.cursor = 'not-allowed';
  }
  detailActions.appendChild(callBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'detail-btn btn-secondary';
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy address';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resource.address || '');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy address';
      }, 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = resource.address || '';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
      } catch {
        copyBtn.textContent = 'Copy failed';
      } finally {
        ta.remove();
        setTimeout(() => {
          copyBtn.textContent = 'Copy address';
        }, 2000);
      }
    }
  });
  detailActions.appendChild(copyBtn);

  detailPanel.classList.remove('hidden');

  // Focus trap / keyboard close
  try {
    detailPanel.dataset.open = 'true';
    const closeBtn = document.getElementById('detail-close');
    if (closeBtn) closeBtn.focus();
  } catch {
    /* noop */
  }
}

function renderMarkers(activeCategories) {
  clearMarkers();
  const visible = [];
  resourceTravelCache = new Map();

  const centerNearestStop =
    transitDataLoaded && transitStopFeatures.length && searchCenter
      ? window.ProvideDataSources.getNearestStop(
          searchCenter.lat,
          searchCenter.lng,
          transitStopFeatures
        )
      : null;

  const stopCache = new Map();

  allResources.forEach((resource) => {
    if (!resourcePassesMapFilters(resource, activeCategories)) return;

    const travelKey = getResourceTravelKey(resource);
    const walkMin = searchCenter
      ? estimateWalkingMinutes(searchCenter.lat, searchCenter.lng, resource)
      : Infinity;

    let bestMode = 'Walk';
    let bestTimeMin = walkMin;
    let centerNearestStopForResource = null;
    let stopToResource = null;
    let commonRouteIds = [];

    if (centerNearestStop) {
      centerNearestStopForResource = centerNearestStop;
      stopToResource = getNearestStopCached(
        resource.lat,
        resource.lng,
        stopCache
      );
      commonRouteIds = getRouteIdIntersection(
        centerNearestStop.route_ids,
        stopToResource?.route_ids
      );

      if (commonRouteIds.length) {
        const directMi = haversineDistance(
          searchCenter.lat,
          searchCenter.lng,
          resource.lat,
          resource.lng
        );
        const busRideMin = (directMi / BUS_MPH_EST) * 60;
        const busTotalMin =
          centerNearestStop.walk_min +
          (stopToResource?.walk_min ?? 0) +
          busRideMin;

        if (busTotalMin < walkMin) {
          bestMode = 'Bus';
          bestTimeMin = busTotalMin;
        }
      }
    }

    const marker = L.circleMarker([resource.lat, resource.lng], {
      radius: 8,
      fillColor: colors[resource.category],
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95,
    });

    marker.bindPopup(buildPopupHtml(resource));
    marker.on('click', () => {
      showDetailPanelForResource(resource, marker);
    });
    marker.on('add', () => {
      const el = marker.getElement && marker.getElement();
      if (!el) return;
      el.setAttribute(
        'aria-label',
        `${resource.name}. ${CATEGORY_LABELS[resource.category] || resource.category}.`
      );
      el.setAttribute('role', 'img');
      el.setAttribute('tabindex', '-1');
    });
    marker.addTo(map);
    markersLayer.push(marker);

    resourceTravelCache.set(travelKey, {
      bestMode,
      bestTimeMin,
      walkMin,
      centerNearestStop: centerNearestStopForResource,
      stopToResource,
      commonRouteIds,
    });

    visible.push({ resource, marker, bestMode, bestTimeMin });
  });

  if (foodDesertLayer) foodDesertLayer.bringToBack();
  if (homeMarker) homeMarker.bringToFront();

  visible.sort((a, b) => a.bestTimeMin - b.bestTimeMin);
  return visible;
}

const LIMITED_FOOD_RESULTS_HTML = `
  <div style="
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 12px;
    font-size: 12px;
    color: #999;
    margin-top: 8px;
  ">
    <strong style="color: #fff;">Limited results in this area</strong><br/>
    Call <strong style="color: #22c55e;">2-1-1</strong> or visit
    <a href="https://nc211.org" target="_blank" rel="noopener noreferrer" style="color: #22c55e;">nc211.org</a>
    for additional local food resources.
  </div>
`;

function appendLimitedFoodResultsNotice() {
  const list = document.getElementById('results-list');
  if (!list) return;

  const foodPantryResults = allResources.filter((r) => r.category === 'food_bank');
  if (foodPantryResults.length > 0 || !searchCenter) return;

  if (list.querySelector('[data-limited-food-notice]')) return;

  const notice = document.createElement('div');
  notice.setAttribute('data-limited-food-notice', '');
  notice.innerHTML = LIMITED_FOOD_RESULTS_HTML;
  list.appendChild(notice);
}

function setSearchStatus(html) {
  const status = document.getElementById('search-status');
  if (!status) return;

  if (html) {
    status.innerHTML = html;
    status.hidden = false;
  } else {
    status.innerHTML = '';
    status.hidden = true;
  }
}

function showResultsMessage(html, options = {}) {
  const hideStats = options.hideStats !== false;
  const list = document.getElementById('results-list');
  const statsBar = document.getElementById('stats-bar');

  if (!list) {
    setSearchStatus(html);
    if (hideStats && statsBar) statsBar.classList.add('hidden');
    return;
  }

  const placeholder = document.getElementById('results-placeholder');
  placeholder.innerHTML = html;
  placeholder.style.display = 'block';
  list.innerHTML = '';
  list.appendChild(placeholder);
  document.getElementById('results-count').textContent = '—';
  if (hideStats && statsBar) statsBar.classList.add('hidden');
  appendLimitedFoodResultsNotice();
}

function renderResultsPanel(visibleEntries) {
  const list = document.getElementById('results-list');
  if (!list) {
    setSearchStatus('');
    return;
  }

  const placeholder = document.getElementById('results-placeholder');
  const visibleResources = visibleEntries.map((entry) => entry.resource);

  document.getElementById('results-count').textContent =
    `Showing ${visibleResources.length} locations`;

  if (!visibleResources.length) {
    const emptyMsg = allResources.length
      ? '<p>No resources match the selected filters.</p>'
      : '<p>No resources found in this area. Try increasing the radius.</p>';
    showResultsMessage(emptyMsg, { hideStats: allResources.length === 0 });
    return;
  }

  setSearchStatus('');
  placeholder.style.display = 'none';
  list.innerHTML = '';

  const fragment = document.createDocumentFragment();

  visibleEntries.forEach(({ resource, marker, bestMode }) => {
    const cardClass = CARD_CLASS_MAP[resource.category] || 'foodbank';
    const card = document.createElement('div');
    card.className = `result-card ${cardClass}`;
    card.dataset.resourceKey = getResourceDomKey(resource);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute(
      'aria-label',
      `${resource.name}. ${CATEGORY_LABELS[resource.category] || resource.category}. ${bestMode === 'Bus' ? 'Best by bus.' : 'Best by walking.'} Activate for details.`
    );
    const badgeColor = colors[resource.category];
    const bestLabel = bestMode === 'Bus' ? 'Best: Bus' : 'Best: Walk';
    card.innerHTML = `
      <div class="result-name">${escapeHtml(resource.name)}</div>
      <div class="result-address">${escapeHtml(resource.address)}</div>
      <div class="result-meta">
        <span class="result-badge" style="background: ${badgeColor}22; color: ${badgeColor};">
          ${escapeHtml(CATEGORY_LABELS[resource.category])}
        </span>
        <span class="result-dist">${bestLabel}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      showDetailPanelForResource(resource, marker);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showDetailPanelForResource(resource, marker);
      }
    });
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
  appendLimitedFoodResultsNotice();
}

function countResourcesByCategory(resources) {
  const counts = {
    snap: 0,
    food_bank: 0,
    free_meals_all_ages: 0,
    free_meals_under_18: 0,
    wic: 0,
  };
  resources.forEach((r) => {
    if (counts[r.category] !== undefined) counts[r.category]++;
  });
  return counts;
}

function applyStatsCounts(counts) {
  document.querySelector('#stat-snap .stat-num').textContent = counts.snap;
  document.querySelector('#stat-foodbank .stat-num').textContent = counts.food_bank;
  document.querySelector('#stat-meal-all .stat-num').textContent =
    counts.free_meals_all_ages;
  document.querySelector('#stat-meal-under18 .stat-num').textContent =
    counts.free_meals_under_18;
  document.querySelector('#stat-wic .stat-num').textContent = counts.wic;
}

function updateStatsBar() {
  const activeCategories = getActiveCategories();
  const matching = allResources.filter((r) =>
    resourcePassesMapFilters(r, activeCategories)
  );
  applyStatsCounts(countResourcesByCategory(matching));

  const statsBar = document.getElementById('stats-bar');
  if (searchCenter && allResources.length > 0) {
    statsBar.classList.remove('hidden');
  }
}

function renderAll() {
  if (searchCenter && radiusCircle) {
    radiusCircle.addTo(map);
  }

  updateStatsBar();

  const activeCategories = getActiveCategories();
  const visibleEntries = renderMarkers(activeCategories);
  renderResultsPanel(visibleEntries);

  if (searchCenter) {
    updateShareableHash();
    setCopyLinkVisible(true);
  }

  refreshTransitLayers();
}

async function loadResourcesAt(lat, lng) {
  const generation = ++searchGeneration;

  setLoading(true);
  clearMarkers();
  allResources = [];
  applyStatsCounts(countResourcesByCategory([]));
  document.getElementById('detail-panel').classList.add('hidden');

  let resources = [];
  try {
    const result = await window.ProvideDataSources.fetchAllResources(
      lat,
      lng,
      selectedMiles
    );
    if (generation !== searchGeneration) return;
    resources = result.resources;
  } catch {
    if (generation !== searchGeneration) return;
    setLoading(false);
    showResultsMessage(
      '<p>Could not load map data. Please refresh and try again.</p>'
    );
    return;
  }

  if (generation !== searchGeneration) return;

  allResources = resources;
  setLoading(false);
  renderAll();
}

// ─── Loading ──────────────────────────────────────────────────
function setLoading(on) {
  const btn = document.getElementById('search-btn');
  btn.disabled = on;
  btn.textContent = on ? 'Searching...' : 'Find';
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
  const loadingText = document.getElementById('loading-text');
  if (loadingText) {
    loadingText.textContent = on ? 'Searching...' : 'Finding resources...';
  }
}

// ─── Event Listeners ──────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('address-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
document.getElementById('address-input').addEventListener('input', () => {
  hideAddressError();
});

function setLocateBtnLoading(isLoading) {
  const btn = document.getElementById('locate-btn');
  if (!btn) return;
  const textEl = btn.querySelector('.locate-btn-text');
  btn.disabled = isLoading;
  if (textEl) textEl.textContent = isLoading ? 'Locating...' : 'Current Location';
}

const locateBtn = document.getElementById('locate-btn');
if (locateBtn) {
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showAddressError('Geolocation is not supported by your browser.');
      return;
    }

    setLocateBtnLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const url =
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

        try {
          const res = await fetch(url, {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'ProvideApp/1.0',
            },
          });
          const data = await res.json();

          const inNC = data.address?.state === 'North Carolina';
          if (!inNC) {
            showAddressError('Your current location is outside NC.');
            setLocateBtnLoading(false);
            return;
          }

          const displayAddress = data.display_name || `${latitude}, ${longitude}`;
          const addressInput = document.getElementById('address-input');
          if (addressInput) addressInput.value = displayAddress;
          hideAddressError();

          await runSearchAt(latitude, longitude, { showHomeMarker: true });
        } catch {
          showAddressError(
            'Could not detect your location. Try entering an address manually.'
          );
        }

        setLocateBtnLoading(false);
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Please enter an address manually.',
          2: 'Could not determine your location. Try entering an address manually.',
          3: 'Location request timed out. Try entering an address manually.',
        };
        showAddressError(messages[err.code] || 'Location unavailable.');
        setLocateBtnLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}

document.querySelectorAll('.radius-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.radius-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMiles = parseInt(btn.dataset.miles, 10);
    if (searchCenter) {
      drawRadiusCircle(searchCenter.lat, searchCenter.lng, selectedMiles);
      loadResourcesAt(searchCenter.lat, searchCenter.lng);
      return;
    }
    if (allResources.length) renderAll();
  });
});

document.querySelectorAll('.filter-cb').forEach((cb) => {
  cb.addEventListener('change', () => {
    if (searchCenter || allResources.length) renderAll();
  });
});

const snapGroceryOnlyCb = document.getElementById('snap-grocery-only');
if (snapGroceryOnlyCb) {
  snapGroceryOnlyCb.addEventListener('change', () => {
    if (searchCenter || allResources.length) renderAll();
  });
}

document.getElementById('detail-close').addEventListener('click', () => {
  const panel = document.getElementById('detail-panel');
  if (panel) {
    panel.classList.add('hidden');
    panel.dataset.open = 'false';
  }
  document.querySelectorAll('.result-card.active').forEach((el) => el.classList.remove('active'));
});

function trapDetailPanelFocus(e) {
  const panel = document.getElementById('detail-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    document.getElementById('detail-close')?.click();
    return;
  }

  if (e.key !== 'Tab') return;

  const focusables = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const items = Array.from(focusables).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;

  const first = items[0];
  const last = items[items.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', trapDetailPanelFocus);

const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      copyLinkBtn.textContent = 'Link copied!';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Share this search';
      }, 2000);
    });
  });
}

const printBtn = document.getElementById('print-btn');
if (printBtn) {
  printBtn.addEventListener('click', printResourceList);
}

const transitToggle = document.getElementById('transit-toggle');
if (transitToggle) {
  transitToggle.addEventListener('change', async function () {
    if (this.checked) {
      if (!searchCenter) {
        this.checked = false;
        showTransitNoSearchMessage();
        return;
      }

      const loadingEl = document.getElementById('transit-loading');
      if (!transitDataLoaded && transitLoadPromise && loadingEl) {
        loadingEl.style.display = 'inline';
      }
      await loadTransitOverlay();
      if (transitDataLoaded) {
        buildTransitLayers(searchCenter.lat, searchCenter.lng, selectedMiles);
      }
    } else {
      const loadingEl = document.getElementById('transit-loading');
      const errorEl = document.getElementById('transit-error');
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (transitLayer) map.removeLayer(transitLayer);
      if (transitStopLayer) map.removeLayer(transitStopLayer);
    }
  });
}

const foodDesertToggle = document.getElementById('food-desert-toggle');
if (foodDesertToggle) {
  foodDesertToggle.addEventListener('change', async (e) => {
    const toggle = e.target;
    const legend = document.getElementById('food-desert-legend');
    const label = getFoodDesertToggleLabel();

    if (toggle.checked) {
      if (label) label.textContent = 'Loading...';
      try {
        await renderFoodDesertOverlay();
      } finally {
        if (toggle.checked && label) {
          label.textContent = SCARCITY_TRACKER_LABEL;
        }
      }
      if (toggle.checked && legend) {
        legend.classList.remove('hidden');
        legend.hidden = false;
      }
    } else {
      removeFoodDesertOverlay();
      if (legend) {
        legend.classList.add('hidden');
        legend.hidden = true;
      }
      if (label) label.textContent = SCARCITY_TRACKER_LABEL;
    }
  });
}

const drawerToggle = document.getElementById('drawer-toggle');
if (drawerToggle) {
  const body = document.body;
  const setCollapsed = (collapsed) => {
    body.classList.toggle('drawer-collapsed', collapsed);
    drawerToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    drawerToggle.textContent = collapsed ? 'List' : 'Map';
  };

  setCollapsed(false);

  drawerToggle.addEventListener('click', () => {
    setCollapsed(body.classList.contains('drawer-collapsed') ? false : true);
  });
}

// ─── Boot ─────────────────────────────────────────────────────
initMap();
loadTransitOverlay({ silent: true });
if (isExplorerPreviewEmbed()) {
  bootEmbeddedPreview();
} else {
  restoreSearchFromHash();
}
