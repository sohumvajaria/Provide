const REVEAL_THRESHOLD = 0.08;
const REVEAL_ROOT_MARGIN = '0px 0px 8% 0px';

function revealElement(el) {
  el.classList.add('is-revealed');
}

function initScrollReveal() {
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (!revealEls.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    revealEls.forEach(revealElement);
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    revealEls.forEach(revealElement);
    return;
  }

  const pending = new Set();
  let frameId = 0;

  function flushReveals() {
    frameId = 0;
    pending.forEach((el) => {
      revealElement(el);
      observer.unobserve(el);
    });
    pending.clear();
  }

  function queueReveal(el) {
    pending.add(el);
    if (frameId) return;
    frameId = window.requestAnimationFrame(flushReveals);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        queueReveal(entry.target);
      });
    },
    { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN }
  );

  revealEls.forEach((el) => observer.observe(el));
}

initScrollReveal();
