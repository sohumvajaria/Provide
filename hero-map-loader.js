/**
 * Loads D3, TopoJSON, and hero-map.js after first paint so the critical path stays light.
 */
(function initHeroMapLoader() {
  const D3_SRC = 'https://cdn.jsdelivr.net/npm/d3@7';
  const TOPO_SRC = 'https://cdn.jsdelivr.net/npm/topojson-client@3';
  const MAP_SRC = 'hero-map.js';
  const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

  const loadedScripts = new Set();
  let loadChain = null;

  function loadScript(src) {
    if (loadedScripts.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          loadedScripts.add(src);
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        loadedScripts.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function warmAtlasCache() {
    if (!window.fetch) return;
    window.fetch(ATLAS_URL, { mode: 'cors', credentials: 'omit', priority: 'low' }).catch(() => {});
  }

  function scheduleAfterPaint(task) {
    const run = () => {
      if (document.visibilityState === 'hidden') {
        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.visibilityState !== 'hidden') task();
          },
          { once: true }
        );
        return;
      }
      task();
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(run, { timeout: 2500 });
        } else {
          window.setTimeout(run, 1);
        }
      });
    });
  }

  function loadHeroMapBundle() {
    if (loadChain) return loadChain;

    warmAtlasCache();
    loadChain = Promise.all([loadScript(D3_SRC), loadScript(TOPO_SRC)])
      .then(() => loadScript(MAP_SRC))
      .then(() => {
        if (window.ProvideHeroMap?.init) {
          window.ProvideHeroMap.init();
        }
      })
      .catch(() => {
        const container = document.getElementById('hero-map');
        if (!container) return;
        container.classList.remove('is-map-loading');
        const placeholder = container.querySelector('.hero-map-placeholder');
        if (placeholder) placeholder.remove();
        container.innerHTML =
          '<p class="hero-map-fallback">Map unavailable — <a href="explorer.html">open the explorer</a> to find food resources.</p>';
      });

    return loadChain;
  }

  function start() {
    if (!document.getElementById('hero-map')) return;
    scheduleAfterPaint(loadHeroMapBundle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
