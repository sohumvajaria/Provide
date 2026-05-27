(function initProvideMotion() {
  function initOffscreenMotionPause() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const groups = document.querySelectorAll('[data-motion-group]');
    if (!groups.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('motion-paused', !entry.isIntersecting);
        });
      },
      { rootMargin: '100px', threshold: 0 }
    );

    groups.forEach((el) => observer.observe(el));
  }

  function bindRafPointer(onMove) {
    let frameId = 0;
    let clientX = 0;
    let clientY = 0;

    return function handlePointer(event) {
      clientX = event.clientX;
      clientY = event.clientY;
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        onMove(clientX, clientY);
      });
    };
  }

  window.ProvideMotion = {
    bindRafPointer,
    initOffscreenMotionPause,
  };

  function initScrollPerf() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let scrollEndTimer = 0;
    const root = document.documentElement;

    window.addEventListener(
      'scroll',
      () => {
        root.classList.add('is-scrolling');
        window.clearTimeout(scrollEndTimer);
        scrollEndTimer = window.setTimeout(() => {
          root.classList.remove('is-scrolling');
        }, 140);
      },
      { passive: true }
    );
  }

  function init() {
    initOffscreenMotionPause();
    initScrollPerf();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
