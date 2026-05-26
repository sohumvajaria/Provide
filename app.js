// ─── Config ───────────────────────────────────────────────────
const CHARLOTTE_CENTER = [35.2271, -80.8431];

const colors = {
  snap: '#3B82F6',
  food_bank: '#F97316',
  free_meals: '#EAB308',
  wic: '#A855F7',
};

const CATEGORY_LABELS = {
  snap: 'SNAP Retailer',
  food_bank: 'Food Bank',
  free_meals: 'Free Meals',
  wic: 'WIC Location',
};

const FILTER_TYPE_MAP = {
  snap: 'snap',
  foodbank: 'food_bank',
  meal: 'free_meals',
  wic: 'wic',
};

const CARD_CLASS_MAP = {
  snap: 'snap',
  food_bank: 'foodbank',
  free_meals: 'meal',
  wic: 'wic',
};

// ─── State ────────────────────────────────────────────────────
let map;
let markersLayer = [];
let radiusCircle = null;
let selectedMiles = 2;
let allResources = [];
let searchCenter = null;

// ─── Init Map ─────────────────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: CHARLOTTE_CENTER,
    zoom: 12,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWicPopupHtml(resource) {
  const name = escapeHtml(resource.name);
  const address = escapeHtml(resource.address);
  const phone = resource.phone ? escapeHtml(resource.phone) : '';
  const telHref = resource.phone
    ? `tel:${String(resource.phone).replace(/[^\d+]/g, '')}`
    : '';

  return `
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
    </div>
  `;
}

function buildPopupHtml(resource) {
  if (resource.category === 'wic') {
    return buildWicPopupHtml(resource);
  }

  const name = escapeHtml(resource.name);
  const address = escapeHtml(resource.address);
  return `
    <div style="font-family: sans-serif; min-width: 160px;">
      <strong style="font-size: 13px;">${name}</strong><br/>
      <span style="font-size: 12px; color: #666;">${address}</span><br/><br/>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}"
         target="_blank"
         rel="noopener noreferrer"
         style="font-size: 12px; color: #22c55e; text-decoration: none;">
        Get Directions →
      </a>
    </div>
  `;
}

// ─── Geocode ZIP ──────────────────────────────────────────────
async function geocodeZip(zip) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`
  );
  const data = await res.json();
  if (!data.length) return null;
  const result = data[0];
  return { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
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

function renderMarkers(activeCategories) {
  clearMarkers();
  const visible = [];

  allResources.forEach((resource) => {
    if (!activeCategories.includes(resource.category)) return;

    const marker = L.circleMarker([resource.lat, resource.lng], {
      radius: 8,
      fillColor: colors[resource.category],
      color: '#1a1a1a',
      weight: 1.5,
      fillOpacity: 0.9,
    });

    marker.bindPopup(buildPopupHtml(resource));
    marker.addTo(map);
    markersLayer.push(marker);
    visible.push({ resource, marker });
  });

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
  const foodPantryResults = allResources.filter((r) => r.category === 'food_bank');
  if (foodPantryResults.length > 0 || !searchCenter) return;

  const list = document.getElementById('results-list');
  if (list.querySelector('[data-limited-food-notice]')) return;

  const notice = document.createElement('div');
  notice.setAttribute('data-limited-food-notice', '');
  notice.innerHTML = LIMITED_FOOD_RESULTS_HTML;
  list.appendChild(notice);
}

function showResultsMessage(html) {
  const list = document.getElementById('results-list');
  const placeholder = document.getElementById('results-placeholder');
  placeholder.innerHTML = html;
  placeholder.style.display = 'block';
  list.innerHTML = '';
  list.appendChild(placeholder);
  document.getElementById('results-count').textContent = '—';
  document.getElementById('stats-bar').classList.add('hidden');
  appendLimitedFoodResultsNotice();
}

function renderResultsPanel(visibleEntries) {
  const list = document.getElementById('results-list');
  const placeholder = document.getElementById('results-placeholder');
  const visibleResources = visibleEntries.map((entry) => entry.resource);

  document.getElementById('results-count').textContent =
    `Showing ${visibleResources.length} locations`;

  if (!visibleResources.length) {
    showResultsMessage('<p>No resources found for selected filters. Try increasing the radius.</p>');
    return;
  }

  placeholder.style.display = 'none';
  list.innerHTML = '';

  const fragment = document.createDocumentFragment();

  visibleEntries.forEach(({ resource, marker }) => {
    const cardClass = CARD_CLASS_MAP[resource.category] || 'foodbank';
    const card = document.createElement('div');
    card.className = `result-card ${cardClass}`;
    const badgeColor = colors[resource.category];
    card.innerHTML = `
      <div class="result-name">${escapeHtml(resource.name)}</div>
      <div class="result-address">${escapeHtml(resource.address)}</div>
      <div class="result-meta">
        <span class="result-badge" style="background: ${badgeColor}22; color: ${badgeColor};">
          ${escapeHtml(CATEGORY_LABELS[resource.category])}
        </span>
      </div>
    `;
    card.addEventListener('click', () => {
      map.setView([resource.lat, resource.lng], 15);
      marker.openPopup();
      document.querySelectorAll('.result-card.active').forEach((el) => el.classList.remove('active'));
      card.classList.add('active');
    });
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
  updateStats(visibleResources);
  document.getElementById('stats-bar').classList.remove('hidden');
  appendLimitedFoodResultsNotice();
}

function renderAll() {
  if (searchCenter && radiusCircle) {
    radiusCircle.addTo(map);
  }

  const activeCategories = getActiveCategories();
  const visibleEntries = renderMarkers(activeCategories);
  renderResultsPanel(visibleEntries);
}

function updateStats(visibleResources) {
  const counts = { snap: 0, food_bank: 0, free_meals: 0, wic: 0 };
  visibleResources.forEach((r) => {
    if (counts[r.category] !== undefined) counts[r.category]++;
  });
  document.querySelector('#stat-snap .stat-num').textContent = counts.snap;
  document.querySelector('#stat-foodbank .stat-num').textContent = counts.food_bank;
  document.querySelector('#stat-meal .stat-num').textContent = counts.free_meals;
  document.querySelector('#stat-wic .stat-num').textContent = counts.wic;
}

// ─── Search ───────────────────────────────────────────────────
async function doSearch() {
  const zip = document.getElementById('zip-input').value.trim();
  if (!/^\d{5}$/.test(zip)) {
    showResultsMessage('<p>Enter a valid 5-digit ZIP code.</p>');
    return;
  }

  if (!window.ProvideDataSources) {
    showResultsMessage('<p>Data layer failed to load. Refresh the page.</p>');
    return;
  }

  setLoading(true);
  clearMarkers();
  allResources = [];
  document.getElementById('detail-panel').classList.add('hidden');

  let center;
  try {
    center = await geocodeZip(zip);
  } catch {
    center = null;
  }

  if (!center) {
    setLoading(false);
    showResultsMessage('<p>ZIP code not found</p>');
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    searchCenter = null;
    return;
  }

  searchCenter = center;
  const { lat, lng } = center;
  const radiusMiles = selectedMiles;

  map.setView([lat, lng], 13);
  drawRadiusCircle(lat, lng, radiusMiles);
  map.invalidateSize();

  try {
    const result = await window.ProvideDataSources.fetchAllResources(
      lat,
      lng,
      radiusMiles
    );
    allResources = result.resources;
  } catch (e) {
    allResources = [];
    showResultsMessage('<p>Could not load map data. Please refresh and try again.</p>');
  }

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
document.getElementById('zip-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

document.querySelectorAll('.radius-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.radius-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMiles = parseInt(btn.dataset.miles, 10);
    if (searchCenter) {
      doSearch();
      return;
    }
    // If a search was run but state got reset, still update stats from current list.
    if (allResources.length) renderAll();
  });
});

document.querySelectorAll('.filter-cb').forEach((cb) => {
  cb.addEventListener('change', () => {
    if (allResources.length) renderAll();
  });
});

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  document.querySelectorAll('.result-card.active').forEach((el) => el.classList.remove('active'));
});

// ─── Boot ─────────────────────────────────────────────────────
initMap();
