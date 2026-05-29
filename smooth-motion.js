(function initProvideMotion() {
  function initOffscreenMotionPause() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const groups = [...document.querySelectorAll('[data-motion-group]')].filter(
      (el) => !el.closest('#hero')
    );
    if (!groups.length) return;

    const pending = new Map();
    let frameId = 0;

    function flushMotionPause() {
      frameId = 0;
      pending.forEach((isPaused, target) => {
        target.classList.toggle('motion-paused', isPaused);
      });
      pending.clear();
    }

    function queueMotionPause(target, isPaused) {
      pending.set(target, isPaused);
      if (frameId) return;
      frameId = window.requestAnimationFrame(flushMotionPause);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          queueMotionPause(entry.target, !entry.isIntersecting);
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

  function isScrolling() {
    return document.documentElement.classList.contains('is-scrolling');
  }

  window.ProvideMotion = {
    bindRafPointer,
    initOffscreenMotionPause,
    isScrolling,
  };

  function initScrollPerf() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let scrollEndTimer = 0;
    let scrollFrameId = 0;
    let isScrollActive = false;
    const root = document.documentElement;

    function markScrolling() {
      scrollFrameId = 0;
      if (!isScrollActive) {
        isScrollActive = true;
        root.classList.add('is-scrolling');
      }
    }

    function onScroll() {
      if (!scrollFrameId) {
        scrollFrameId = window.requestAnimationFrame(markScrolling);
      }

      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(() => {
        isScrollActive = false;
        root.classList.remove('is-scrolling');
      }, 140);
    }

    if (window.ProvideLenis?.onScroll) {
      window.ProvideLenis.onScroll(onScroll);
      return;
    }

    window.addEventListener(
      'provide:lenis-ready',
      () => {
        window.ProvideLenis.onScroll(onScroll);
      },
      { once: true }
    );

    if (typeof Lenis === 'undefined') {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  function init() {
    initOffscreenMotionPause();
    initScrollPerf();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
