const PREVIEW_MARKER_SPOTS = [
  { left: 28, top: 42 },
  { left: 38, top: 55 },
  { left: 45, top: 38 },
  { left: 52, top: 48 },
  { left: 58, top: 35 },
  { left: 62, top: 52 },
  { left: 48, top: 62 },
  { left: 35, top: 58 },
  { left: 55, top: 44 },
  { left: 42, top: 46 },
];

function buildMapPreview() {
  const mount = document.getElementById('map-preview-mount');
  if (!mount) return;

  const markersHtml = PREVIEW_MARKER_SPOTS.map(
    (spot, index) =>
      `<span class="preview-marker preview-marker--${index % 4}" style="left:${spot.left}%;top:${spot.top}%;" aria-hidden="true"></span>`
  ).join('');

  mount.innerHTML = `
    <div class="preview-frame">
      <div class="preview-chrome">
        <span class="preview-logo">PROVIDE</span>
        <div class="preview-chrome-stats">
          <span>ZIP search</span>
          <span>4 filters</span>
          <span>Live map</span>
        </div>
        <span class="preview-badge">Placeholder</span>
      </div>
      <div class="preview-body">
        <aside class="preview-sidebar" aria-hidden="true">
          <div class="preview-sidebar-block preview-sidebar-block--wide"></div>
          <div class="preview-sidebar-block"></div>
          <div class="preview-sidebar-block"></div>
          <div class="preview-sidebar-list">
            <div class="preview-list-row"></div>
            <div class="preview-list-row"></div>
            <div class="preview-list-row"></div>
            <div class="preview-list-row preview-list-row--short"></div>
          </div>
        </aside>
        <div class="preview-map" aria-hidden="true">
          <div class="preview-map-grid"></div>
          <div class="preview-map-scan"></div>
          <div class="preview-markers">${markersHtml}</div>
          <div class="preview-map-ring"></div>
          <p class="preview-map-label">Interactive map loads in the explorer</p>
        </div>
      </div>
    </div>
  `;
}

buildMapPreview();
