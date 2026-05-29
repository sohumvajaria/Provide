/**
 * Home page: silently show "resources near me" count.
 * Uses geolocation (permission-based) + ProvideDataSources.fetchAllResources.
 */
(function initHomeNearbyCount() {
  const MILES = 5;
  const DATA_SOURCES_SRC = 'data-sources.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
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
      script.defer = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function scheduleDeferred(task) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(task, { timeout: 4000 });
        } else {
          window.setTimeout(task, 50);
        }
      });
    });
  }

  function setStatus(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  async function run() {
    const el = document.getElementById('hero-nearby-count');
    if (!el) return;

    if (!navigator.geolocation) {
      setStatus(el, '');
      return;
    }

    // Don't prompt aggressively: only run if user has already granted, or they click later.
    // (Chrome: permissions API helps us avoid a prompt.)
    try {
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        if (p.state !== 'granted') {
          setStatus(el, '');
          return;
        }
      }
    } catch {
      // If permissions API fails, fall back to a best-effort silent attempt.
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setStatus(el, '');
          return;
        }

        if (!window.ProvideDataSources?.fetchAllResources) {
          setStatus(el, '');
          return;
        }

        try {
          const result = await window.ProvideDataSources.fetchAllResources(
            latitude,
            longitude,
            MILES
          );
          const count = Array.isArray(result?.resources) ? result.resources.length : 0;
          if (!count) {
            setStatus(el, '');
            return;
          }
          setStatus(el, `${count} food resources within ${MILES} miles of you`);
        } catch {
          setStatus(el, '');
        }
      },
      () => setStatus(el, ''),
      { timeout: 6000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function start() {
    loadScript(DATA_SOURCES_SRC)
      .then(run)
      .catch(() => {});
  }

  function bootstrap() {
    scheduleDeferred(start);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();

