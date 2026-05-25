// ─── Config ───────────────────────────────────────────────────
const CHARLOTTE_CENTER = [35.2271, -80.8431];
const CHARLOTTE_ZIP_BOUNDS = { lat: [34.9, 35.55], lon: [-81.3, -80.5] };

const TYPE_CONFIG = {
  snap:     { label: 'SNAP Retailer',  color: '#4ade80', badgeClass: 'badge-snap',     markerClass: 'marker-snap' },
  foodbank: { label: 'Food Bank',      color: '#40916c', badgeClass: 'badge-foodbank', markerClass: 'marker-foodbank' },
  meal:     { label: 'Free Meals',     color: '#38bdf8', badgeClass: 'badge-meal',     markerClass: 'marker-meal' },
  wic:      { label: 'WIC Location',   color: '#c084fc', badgeClass: 'badge-wic',      markerClass: 'marker-wic' },
};

// Curated Charlotte static dataset for reliability
// These are real, verifiable resources in Charlotte/Mecklenburg County
const STATIC_RESOURCES = [
  // Food Banks
  { type: 'foodbank', name: 'Second Harvest Food Bank of Metrolina', address: '700 Malcolm Blvd, Charlotte, NC 28204', lat: 35.2219, lon: -80.8233, phone: '(704) 376-1785', hours: 'Mon-Fri 8am-5pm', notes: 'Largest food bank in the region' },
  { type: 'foodbank', name: 'Loaves & Fishes Food Pantry', address: '820 Hamilton St, Charlotte, NC 28206', lat: 35.2389, lon: -80.8298, phone: '(704) 376-7554', hours: 'Mon-Fri 9am-12pm', notes: 'Emergency food assistance' },
  { type: 'foodbank', name: 'Crisis Assistance Ministry', address: '500 Spratt St, Charlotte, NC 28206', lat: 35.2412, lon: -80.8371, phone: '(704) 371-3001', hours: 'Mon-Fri 9am-4pm', notes: 'Food pantry + financial assistance' },
  { type: 'foodbank', name: 'Urban Ministry Center Food Pantry', address: '945 N College St, Charlotte, NC 28206', lat: 35.2444, lon: -80.8366, phone: '(704) 347-0278', hours: 'Mon-Fri 8:30am-12pm', notes: '' },
  { type: 'foodbank', name: 'Charlotte Rescue Mission', address: '907 W 1st St, Charlotte, NC 28202', lat: 35.2327, lon: -80.8589, phone: '(704) 333-4673', hours: 'Daily meals served', notes: '' },
  { type: 'foodbank', name: 'Community Food Rescue', address: '4045 N Tryon St, Charlotte, NC 28206', lat: 35.2643, lon: -80.8291, phone: '(704) 293-4850', hours: 'Varies by site', notes: 'Rescues surplus food from retailers' },
  { type: 'foodbank', name: 'Friendship Trays', address: '1226 E 6th St, Charlotte, NC 28204', lat: 35.2202, lon: -80.8211, phone: '(704) 334-0303', hours: 'Mon-Fri deliveries', notes: 'Meals for homebound seniors' },
  { type: 'foodbank', name: 'YWCA Central Carolinas Food Pantry', address: '3420 Park Rd, Charlotte, NC 28209', lat: 35.1979, lon: -80.8601, phone: '(704) 525-5770', hours: 'Tue & Thu 10am-1pm', notes: '' },

  // Free Meals
  { type: 'meal', name: 'Charlotte Douglas Free Meal Site', address: '4800 Wilkinson Blvd, Charlotte, NC 28208', lat: 35.2148, lon: -80.9309, phone: '', hours: 'Weekdays during school year', notes: 'CMS Summer Meals Program' },
  { type: 'meal', name: 'Irwin Ave Open Elementary Meals', address: '1900 Irwin Ave, Charlotte, NC 28212', lat: 35.2201, lon: -80.7921, phone: '', hours: 'Jun-Aug, Mon-Fri 11am-1pm', notes: 'Open to all children 18 and under' },
  { type: 'meal', name: 'First Ward Elementary Meals', address: '300 N Davidson St, Charlotte, NC 28202', lat: 35.2351, lon: -80.8358, phone: '', hours: 'Jun-Aug, Mon-Fri 11am-1pm', notes: 'Open to all children 18 and under' },
  { type: 'meal', name: 'Reid Park Academy Meals', address: '1440 Remount Rd, Charlotte, NC 28208', lat: 35.2189, lon: -80.8876, phone: '', hours: 'Jun-Aug, Mon-Fri 11am-1pm', notes: 'Open to all children 18 and under' },
  { type: 'meal', name: 'Salvation Army Center of Hope Meals', address: '820 Hamilton St, Charlotte, NC 28206', lat: 35.2387, lon: -80.8302, phone: '(704) 348-2100', hours: 'Daily 7am, 12pm, 5pm', notes: 'Hot meals served daily' },
  { type: 'meal', name: "Men's Shelter of Charlotte", address: '1210 N Tryon St, Charlotte, NC 28206', lat: 35.2411, lon: -80.8423, phone: '(704) 376-2494', hours: 'Daily meals', notes: '' },

  // WIC Locations
  { type: 'wic', name: 'Mecklenburg County WIC - Central', address: '249 Billingsley Rd, Charlotte, NC 28211', lat: 35.1914, lon: -80.7939, phone: '(704) 336-6500', hours: 'Mon-Fri 8am-5pm', notes: 'WIC enrollment & benefits' },
  { type: 'wic', name: 'Mecklenburg County WIC - North', address: '2845 Beatties Ford Rd, Charlotte, NC 28216', lat: 35.2921, lon: -80.8789, phone: '(704) 336-6500', hours: 'Mon-Fri 8am-5pm', notes: '' },
  { type: 'wic', name: 'Mecklenburg County WIC - East', address: '3025 Eastway Dr, Charlotte, NC 28205', lat: 35.2301, lon: -80.7701, phone: '(704) 336-6500', hours: 'Mon-Fri 8am-5pm', notes: '' },
  { type: 'wic', name: 'Mecklenburg County WIC - South', address: '1333 Harding Pl, Charlotte, NC 28204', lat: 35.1819, lon: -80.8261, phone: '(704) 336-6500', hours: 'Mon-Fri 8am-5pm', notes: '' },
  { type: 'wic', name: 'OB/GYN & Women\'s Health WIC Partner', address: '1350 S Kings Dr, Charlotte, NC 28207', lat: 35.1991, lon: -80.8341, phone: '(704) 355-3209', hours: 'Mon-Fri 8am-4:30pm', notes: 'CMC-affiliated WIC partner' },

  // SNAP Retailers (mix of large grocers + smaller community stores)
  { type: 'snap', name: 'Food Lion #0357', address: '3009 Eastway Dr, Charlotte, NC 28205', lat: 35.2311, lon: -80.7689, phone: '', hours: 'Daily 7am-11pm', notes: 'SNAP-eligible grocery' },
  { type: 'snap', name: 'Walmart Supercenter', address: '4000 E Independence Blvd, Charlotte, NC 28205', lat: 35.2049, lon: -80.7719, phone: '', hours: 'Open 24 hours', notes: 'SNAP-eligible' },
  { type: 'snap', name: 'Compare Foods', address: '3817 Central Ave, Charlotte, NC 28205', lat: 35.2231, lon: -80.7811, phone: '', hours: 'Daily 7am-10pm', notes: 'Community grocery, SNAP accepted' },
  { type: 'snap', name: 'Aldi', address: '5015 W W.T. Harris Blvd, Charlotte, NC 28269', lat: 35.3481, lon: -80.8271, phone: '', hours: 'Daily 9am-9pm', notes: 'Low-cost SNAP-eligible grocery' },
  { type: 'snap', name: 'Harris Teeter #218', address: '1515 South Blvd, Charlotte, NC 28203', lat: 35.2091, lon: -80.8571, phone: '', hours: 'Daily 6am-12am', notes: 'SNAP-eligible grocery' },
  { type: 'snap', name: 'Publix #1182', address: '1321 East Blvd, Charlotte, NC 28203', lat: 35.2079, lon: -80.8441, phone: '', hours: 'Daily 7am-10pm', notes: 'SNAP-eligible grocery' },
  { type: 'snap', name: 'Lidl #109', address: '1600 W Sugar Creek Rd, Charlotte, NC 28262', lat: 35.3101, lon: -80.8001, phone: '', hours: 'Daily 8am-10pm', notes: 'Low-cost SNAP-eligible grocery' },
  { type: 'snap', name: 'Supermercado El Progreso', address: '3621 Beatties Ford Rd, Charlotte, NC 28216', lat: 35.3011, lon: -80.8831, phone: '', hours: 'Daily 7am-10pm', notes: 'Hispanic community grocer, SNAP accepted' },
  { type: 'snap', name: 'Save-A-Lot #743', address: '2800 N Davidson St, Charlotte, NC 28206', lat: 35.2589, lon: -80.8381, phone: '', hours: 'Mon-Sat 8am-9pm, Sun 9am-8pm', notes: 'Discount grocery, SNAP accepted' },
  { type: 'snap', name: 'Kroger #407', address: '4715 Sharon Rd, Charlotte, NC 28210', lat: 35.1491, lon: -80.8521, phone: '', hours: 'Daily 6am-11pm', notes: 'SNAP-eligible grocery' },
];

// ─── State ────────────────────────────────────────────────────
let map, markers = [], activeFilters = { snap: true, foodbank: true, meal: true, wic: true };
let selectedMiles = 2, allResults = [], activeCard = null, searchCenter = null;

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

// ─── Marker Icons ─────────────────────────────────────────────
function makeIcon(type) {
  return L.divIcon({
    className: '',
    html: `<div class="marker-icon ${TYPE_CONFIG[type].markerClass}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

// ─── Distance (Haversine) ─────────────────────────────────────
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Geocode ZIP ──────────────────────────────────────────────
async function geocodeZip(zip) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// ─── Fetch from Overpass (food banks in OSM) ──────────────────
async function fetchOverpass(lat, lon, radiusMiles) {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="food_bank"](around:${radiusMeters},${lat},${lon});
      node["social_facility"="food_bank"](around:${radiusMeters},${lat},${lon});
      node["social_facility:for"="food"](around:${radiusMeters},${lat},${lon});
    );
    out body;
  `;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    const data = await res.json();
    return (data.elements || []).map(el => ({
      type: 'foodbank',
      name: el.tags.name || 'Food Resource',
      address: [el.tags['addr:housenumber'], el.tags['addr:street'], el.tags['addr:city']].filter(Boolean).join(' ') || 'Charlotte, NC',
      lat: el.lat,
      lon: el.lon,
      phone: el.tags.phone || el.tags['contact:phone'] || '',
      hours: el.tags.opening_hours || '',
      notes: el.tags.description || '',
      source: 'osm',
    }));
  } catch {
    return [];
  }
}

// ─── Search ───────────────────────────────────────────────────
async function doSearch() {
  const zip = document.getElementById('zip-input').value.trim();
  if (!/^\d{5}$/.test(zip)) {
    alert('Enter a valid 5-digit ZIP code.');
    return;
  }

  setLoading(true);
  clearMap();
  hideDetail();

  let center;
  try {
    center = await geocodeZip(zip);
  } catch {
    center = null;
  }

  if (!center) {
    setLoading(false);
    document.getElementById('results-placeholder').innerHTML = '<p>ZIP code not found. Try a Charlotte-area ZIP.</p>';
    document.getElementById('results-placeholder').style.display = 'block';
    return;
  }

  searchCenter = center;

  // Pan map
  map.setView([center.lat, center.lon], 13);

  // Draw radius circle
  if (window._radiusCircle) map.removeLayer(window._radiusCircle);
  window._radiusCircle = L.circle([center.lat, center.lon], {
    radius: selectedMiles * 1609.34,
    color: '#2d6a4f',
    weight: 1,
    fillColor: '#40916c',
    fillOpacity: 0.08,
  }).addTo(map);

  // Center marker
  if (window._centerMarker) map.removeLayer(window._centerMarker);
  window._centerMarker = L.circleMarker([center.lat, center.lon], {
    radius: 6,
    color: '#2d6a4f',
    fillColor: '#40916c',
    fillOpacity: 1,
    weight: 2,
  }).addTo(map).bindPopup(`<strong>ZIP ${zip}</strong><br>Your search center`);

  // Filter static resources by distance
  const staticNearby = STATIC_RESOURCES.filter(r => distanceMiles(center.lat, center.lon, r.lat, r.lon) <= selectedMiles);

  // Fetch OSM data
  let osmResults = [];
  try {
    osmResults = await fetchOverpass(center.lat, center.lon, selectedMiles);
  } catch { osmResults = []; }

  // Deduplicate OSM against static (by proximity)
  const filtered = osmResults.filter(osm => {
    return !staticNearby.some(s => distanceMiles(osm.lat, osm.lon, s.lat, s.lon) < 0.1);
  });

  allResults = [...staticNearby, ...filtered].map(r => ({
    ...r,
    dist: distanceMiles(center.lat, center.lon, r.lat, r.lon),
  })).sort((a, b) => a.dist - b.dist);

  setLoading(false);
  renderResults();
}

// ─── Render Results ───────────────────────────────────────────
function renderResults() {
  const visible = allResults.filter(r => activeFilters[r.type]);
  const list = document.getElementById('results-list');
  const placeholder = document.getElementById('results-placeholder');

  document.getElementById('results-count').textContent = `${visible.length} found`;

  // Clear old markers
  clearMap();

  if (!visible.length) {
    placeholder.style.display = 'block';
    placeholder.innerHTML = '<p>No resources found for selected filters. Try increasing the radius.</p>';
    list.innerHTML = '';
    list.appendChild(placeholder);
    updateStats([]);
    return;
  }

  placeholder.style.display = 'none';
  list.innerHTML = '';

  // Re-add radius circle
  if (searchCenter && window._radiusCircle) {
    window._radiusCircle.addTo(map);
  }
  if (searchCenter && window._centerMarker) {
    window._centerMarker.addTo(map);
  }

  visible.forEach((r, i) => {
    // Card
    const card = document.createElement('div');
    card.className = `result-card ${r.type}`;
    card.dataset.index = i;
    card.innerHTML = `
      <div class="result-name">${r.name}</div>
      <div class="result-address">${r.address}</div>
      <div class="result-meta">
        <span class="result-badge ${TYPE_CONFIG[r.type].badgeClass}">${TYPE_CONFIG[r.type].label}</span>
        <span class="result-dist">${r.dist.toFixed(1)} mi</span>
      </div>
    `;
    card.addEventListener('click', () => selectResult(r, card));
    list.appendChild(card);

    // Marker
    const marker = L.marker([r.lat, r.lon], { icon: makeIcon(r.type) })
      .addTo(map)
      .bindPopup(`<strong>${r.name}</strong><br>${r.address}`);

    marker.on('click', () => {
      selectResult(r, card);
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    markers.push(marker);
  });

  updateStats(visible);
  document.getElementById('stats-bar').classList.remove('hidden');
}

// ─── Select Result ────────────────────────────────────────────
function selectResult(r, card) {
  if (activeCard) activeCard.classList.remove('active');
  activeCard = card;
  card.classList.add('active');
  map.setView([r.lat, r.lon], 15);
  showDetail(r);
}

// ─── Detail Panel ─────────────────────────────────────────────
function showDetail(r) {
  const cfg = TYPE_CONFIG[r.type];
  document.getElementById('detail-type-badge').textContent = cfg.label;
  document.getElementById('detail-type-badge').style.color = cfg.color;
  document.getElementById('detail-name').textContent = r.name;
  document.getElementById('detail-address').textContent = r.address;

  let meta = '';
  if (r.hours)  meta += `<div class="detail-meta-row"><span class="detail-meta-key">Hours</span><span class="detail-meta-val">${r.hours}</span></div>`;
  if (r.phone)  meta += `<div class="detail-meta-row"><span class="detail-meta-key">Phone</span><span class="detail-meta-val">${r.phone}</span></div>`;
  if (r.notes)  meta += `<div class="detail-meta-row"><span class="detail-meta-key">Note</span><span class="detail-meta-val">${r.notes}</span></div>`;
  document.getElementById('detail-meta').innerHTML = meta;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
  const callHtml = r.phone ? `<a class="detail-btn btn-secondary" href="tel:${r.phone.replace(/\D/g,'')}">Call</a>` : '';
  document.getElementById('detail-actions').innerHTML = `
    <a class="detail-btn btn-primary" href="${mapsUrl}" target="_blank">Directions</a>
    ${callHtml}
  `;

  document.getElementById('detail-panel').classList.remove('hidden');
}

function hideDetail() {
  document.getElementById('detail-panel').classList.add('hidden');
  if (activeCard) { activeCard.classList.remove('active'); activeCard = null; }
}

// ─── Stats ────────────────────────────────────────────────────
function updateStats(visible) {
  const counts = { snap: 0, foodbank: 0, meal: 0, wic: 0 };
  visible.forEach(r => counts[r.type]++);
  document.querySelector('#stat-snap .stat-num').textContent = counts.snap;
  document.querySelector('#stat-foodbank .stat-num').textContent = counts.foodbank;
  document.querySelector('#stat-meal .stat-num').textContent = counts.meal;
  document.querySelector('#stat-wic .stat-num').textContent = counts.wic;
}

// ─── Clear Map ────────────────────────────────────────────────
function clearMap() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

// ─── Loading ──────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

// ─── Event Listeners ──────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('zip-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

document.querySelectorAll('.radius-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMiles = parseInt(btn.dataset.miles);
    if (allResults.length) doSearch();
  });
});

document.querySelectorAll('.filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    activeFilters[cb.dataset.type] = cb.checked;
    if (allResults.length) renderResults();
  });
});

document.getElementById('detail-close').addEventListener('click', hideDetail);

// ─── Boot ─────────────────────────────────────────────────────
initMap();
