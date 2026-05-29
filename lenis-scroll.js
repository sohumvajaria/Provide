/**
 * Lenis smooth scroll for the home page (index.html).
 * Explorer uses overflow:hidden and does not initialize Lenis.
 */
(function initProvideLenisScroll() {
  if (!document.body.classList.contains('page-home')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Lenis === 'undefined') return;
  if (window.ProvideLenis) return;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
  });

  let rafId = 0;
  function raf(time) {
    lenis.raf(time);
    rafId = requestAnimationFrame(raf);
  }
  rafId = requestAnimationFrame(raf);

  const scrollCallbacks = new Set();
  lenis.on('scroll', () => {
    scrollCallbacks.forEach((callback) => {
      callback();
    });
  });

  const heroMap = document.getElementById('hero-map');

  function pauseLenisForMap() {
    lenis.stop();
  }

  function resumeLenisForMap() {
    lenis.start();
  }

  if (heroMap) {
    heroMap.addEventListener('pointerdown', pauseLenisForMap);
    heroMap.addEventListener('pointerup', resumeLenisForMap);
    heroMap.addEventListener('pointercancel', resumeLenisForMap);
    heroMap.addEventListener('pointerleave', resumeLenisForMap);
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    scrollCallbacks.clear();
    lenis.destroy();
    window.ProvideLenis = null;
  }

  window.ProvideLenis = {
    instance: lenis,
    onScroll(callback) {
      scrollCallbacks.add(callback);
      return () => scrollCallbacks.delete(callback);
    },
    stop: () => lenis.stop(),
    start: () => lenis.start(),
    destroy,
  };

  window.dispatchEvent(new CustomEvent('provide:lenis-ready'));
  window.addEventListener('pagehide', destroy, { once: true });
})();
