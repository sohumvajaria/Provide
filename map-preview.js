const EXPLORER_PREVIEW_WIDTH = 1280;
const EXPLORER_PREVIEW_HEIGHT = 720;
const EXPLORER_PREVIEW_SRC = 'explorer.html?preview=1';

function fitExplorerPreviewFrame() {
  const shell = document.querySelector('.explorer-preview-shell');
  const stage = document.querySelector('.explorer-preview-stage');
  const frame = document.getElementById('explorer-preview-frame');
  if (!shell || !stage || !frame) return;

  const scale = shell.clientWidth / EXPLORER_PREVIEW_WIDTH;
  const scaledHeight = EXPLORER_PREVIEW_HEIGHT * scale;

  stage.style.height = `${scaledHeight}px`;
  frame.style.width = `${EXPLORER_PREVIEW_WIDTH}px`;
  frame.style.height = `${EXPLORER_PREVIEW_HEIGHT}px`;
  frame.style.transform = `scale(${scale})`;
  frame.style.transformOrigin = 'top left';
}

function loadExplorerPreviewFrame(frame) {
  if (!frame || frame.src) return;
  frame.src = EXPLORER_PREVIEW_SRC;
}

function scheduleExplorerPreviewLoad(mount, frame) {
  if (typeof IntersectionObserver === 'undefined') {
    loadExplorerPreviewFrame(frame);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadExplorerPreviewFrame(frame);
        observer.disconnect();
      });
    },
    { rootMargin: '240px 0px', threshold: 0 }
  );

  observer.observe(mount);
}

function buildMapPreview() {
  const mount = document.getElementById('map-preview-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="explorer-preview-shell">
      <div class="explorer-preview-stage">
        <iframe
          id="explorer-preview-frame"
          class="explorer-preview-frame"
          title="Provide explorer preview — Charlotte ZIP 28202 with food access layers"
          tabindex="-1"
        ></iframe>
      </div>
    </div>
  `;

  const frame = document.getElementById('explorer-preview-frame');
  if (frame) {
    frame.addEventListener('load', fitExplorerPreviewFrame);
  }

  scheduleExplorerPreviewLoad(mount, frame);

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(fitExplorerPreviewFrame);
    observer.observe(mount);
  } else {
    window.addEventListener('resize', fitExplorerPreviewFrame);
  }

  fitExplorerPreviewFrame();
}

buildMapPreview();
