const STAT_TILT_MAX_DEG = 9;
const STAT_SHADOW_OFFSET_PX = 16;

function isPageScrolling() {
  if (window.ProvideMotion && typeof window.ProvideMotion.isScrolling === 'function') {
    return window.ProvideMotion.isScrolling();
  }
  return document.documentElement.classList.contains('is-scrolling');
}

function cacheStatCardRect(card) {
  card.__tiltRect = card.getBoundingClientRect();
}

function clearStatCardRect(card) {
  card.__tiltRect = null;
}

function applyStatCardPointer(card, clientX, clientY) {
  if (isPageScrolling()) return;

  const rect = card.__tiltRect;
  if (!rect || !rect.width || !rect.height) return;

  const xPct = ((clientX - rect.left) / rect.width) * 100;
  const yPct = ((clientY - rect.top) / rect.height) * 100;
  const px = xPct / 100 - 0.5;
  const py = yPct / 100 - 0.5;

  card.style.setProperty('--pointer-x', `${xPct}%`);
  card.style.setProperty('--pointer-y', `${yPct}%`);
  card.style.setProperty('--tilt-x', `${py * -STAT_TILT_MAX_DEG * 2}deg`);
  card.style.setProperty('--tilt-y', `${px * STAT_TILT_MAX_DEG * 2}deg`);
  card.style.setProperty('--shadow-x', `${px * -STAT_SHADOW_OFFSET_PX}px`);
  card.style.setProperty('--shadow-y', `${py * -STAT_SHADOW_OFFSET_PX + 10}px`);
  card.style.setProperty(
    '--shade-angle',
    `${Math.atan2(py, px) * (180 / Math.PI) + 90}deg`
  );
}

function resetStatCardPointer(card) {
  card.classList.remove('is-hovering');
  clearStatCardRect(card);
  card.style.setProperty('--pointer-x', '50%');
  card.style.setProperty('--pointer-y', '50%');
  card.style.setProperty('--tilt-x', '0deg');
  card.style.setProperty('--tilt-y', '0deg');
  card.style.setProperty('--shadow-x', '0px');
  card.style.setProperty('--shadow-y', '10px');
  card.style.setProperty('--shade-angle', '135deg');
}

function initStatTilt() {
  const cards = document.querySelectorAll('[data-tilt-card]');
  if (!cards.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bindPointer =
    window.ProvideMotion && window.ProvideMotion.bindRafPointer
      ? window.ProvideMotion.bindRafPointer
      : null;

  let resizeTimer = 0;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cards.forEach((card) => {
          if (card.classList.contains('is-hovering')) {
            cacheStatCardRect(card);
          }
        });
      }, 200);
    },
    { passive: true }
  );

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      window.location.href = 'explorer.html';
    });

    if (prefersReducedMotion) return;

    const onPointer = bindPointer
      ? bindPointer((clientX, clientY) => applyStatCardPointer(card, clientX, clientY))
      : (event) => applyStatCardPointer(card, event.clientX, event.clientY);

    card.addEventListener('mouseenter', () => {
      card.classList.add('is-hovering');
      cacheStatCardRect(card);
    });

    card.addEventListener('mousemove', onPointer, { passive: true });

    card.addEventListener('mouseleave', () => {
      resetStatCardPointer(card);
    });
  });
}

initStatTilt();
