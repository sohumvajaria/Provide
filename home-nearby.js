/**
 * Home page: silently show "resources near me" count.
 * Uses geolocation (permission-based) + ProvideDataSources.fetchAllResources.
 */
(function initHomeNearbyCount() {
  const MILES = 5;

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

