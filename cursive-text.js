const CURSIVE_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/allura/Allura-Regular.ttf';
const DEFAULT_FADE_MS = 700;

let cachedCursiveFont = null;
const pathLayoutCache = new Map();

function setCursiveFallback(el) {
  el.classList.add('is-fallback');
  el.classList.remove('is-loading');
}

function getCursiveText(el) {
  return el.dataset.cursiveText || el.dataset.provideTitle || 'Provide';
}

function getLetterPaths(font, text, fontSize) {
  const cacheKey = `${text}@${fontSize}`;
  if (pathLayoutCache.has(cacheKey)) {
    return pathLayoutCache.get(cacheKey);
  }

  const layout = buildLetterPaths(font, text, fontSize);
  pathLayoutCache.set(cacheKey, layout);
  return layout;
}

function buildLetterPaths(font, text, fontSize) {
  const baselineY = fontSize * 0.85;
  let x = 0;
  const chars = text.split('');
  const items = [];

  chars.forEach((char) => {
    const glyphPath = font.getPath(char, x, baselineY, fontSize);
    items.push({
      pathData: glyphPath.toPathData(2),
      bbox: glyphPath.getBoundingBox(),
    });
    x += font.getAdvanceWidth(char, fontSize);
  });

  const x1 = Math.min(...items.map((item) => item.bbox.x1));
  const y1 = Math.min(...items.map((item) => item.bbox.y1));
  const x2 = Math.max(...items.map((item) => item.bbox.x2));
  const y2 = Math.max(...items.map((item) => item.bbox.y2));
  const pad = Math.max(10, Math.round(fontSize * 0.12));

  return {
    items,
    viewBox: [x1 - pad, y1 - pad, x2 - x1 + pad * 2, y2 - y1 + pad * 2].join(' '),
  };
}

function getSvg(el) {
  return el.querySelector('.cursive-svg') || el.querySelector('.hero-title-svg');
}

function getGlyphs(el) {
  return el.querySelector('.cursive-glyphs') || el.querySelector('.hero-title-glyphs');
}

function renderCursiveGlyphs(el, font) {
  const text = getCursiveText(el);
  const fontSize = parseInt(el.dataset.fontSize || '128', 10);
  const svg = getSvg(el);
  const glyphsGroup = getGlyphs(el);
  const { items, viewBox } = getLetterPaths(font, text, fontSize);

  glyphsGroup.innerHTML = '';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  items.forEach((item) => {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', item.pathData);
    pathEl.setAttribute('class', 'cursive-letter');
    glyphsGroup.appendChild(pathEl);
  });
}

function fadeInCursive(el, font) {
  const fadeMs = parseInt(el.dataset.fadeMs || String(DEFAULT_FADE_MS), 10);
  const delayMs = parseInt(el.dataset.cursiveDelay || '0', 10);
  const svg = getSvg(el);

  renderCursiveGlyphs(el, font);
  svg.style.opacity = '0';
  svg.style.transition = `opacity ${fadeMs}ms ease`;
  el.classList.remove('is-loading');

  return new Promise((resolve) => {
    const startFade = () => {
      if (el.closest('#hero')) {
        emitHeroCursiveStart();
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          svg.style.opacity = '1';
          if (el.closest('#hero')) {
            el.classList.add('is-cursive-ready');
          }
        });
      });

      window.setTimeout(resolve, fadeMs);
    };

    if (delayMs > 0) {
      window.setTimeout(startFade, delayMs);
      return;
    }

    startFade();
  });
}

function showCursiveInstant(el, font) {
  const svg = getSvg(el);

  renderCursiveGlyphs(el, font);
  svg.style.opacity = '1';
  svg.style.transition = '';
  el.classList.remove('is-loading');
  if (el.closest('#hero')) {
    el.classList.add('is-cursive-ready');
  }
}

function emitHeroCursiveStart() {
  document.dispatchEvent(new CustomEvent('provide:hero-cursive-start'));
}

function runCursiveAnimation(el, font) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    if (el.closest('#hero')) {
      emitHeroCursiveStart();
    }
    showCursiveInstant(el, font);
    return Promise.resolve();
  }

  return fadeInCursive(el, font).catch(() => {
    const glyphs = getGlyphs(el);
    if (glyphs) glyphs.innerHTML = '';
    setCursiveFallback(el);
    if (el.closest('#hero')) {
      el.classList.add('is-cursive-ready');
    }
  });
}

function scheduleCursiveAnimation(el, font) {
  const drawOn = el.dataset.drawOn || 'load';

  if (drawOn !== 'scroll') {
    return runCursiveAnimation(el, font);
  }

  return new Promise((resolve) => {
    if (typeof IntersectionObserver === 'undefined') {
      runCursiveAnimation(el, font).then(resolve);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(el);
          runCursiveAnimation(el, font).then(resolve);
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
  });
}

function loadCursiveFont(callback) {
  if (cachedCursiveFont) {
    callback(null, cachedCursiveFont);
    return;
  }

  if (typeof opentype === 'undefined') {
    callback(new Error('opentype unavailable'));
    return;
  }

  opentype.load(CURSIVE_FONT_URL, (err, font) => {
    if (!err && font) {
      cachedCursiveFont = font;
    }
    callback(err, font);
  });
}

function runCursiveSectionParallel(items, font) {
  return Promise.all(items.map((el) => runCursiveAnimation(el, font)));
}

function initCursiveSections(font) {
  const sections = document.querySelectorAll('[data-cursive-section]');
  if (!sections.length) return;

  sections.forEach((section) => {
    const items = [...section.querySelectorAll('[data-cursive-text], [data-provide-title]')];
    if (!items.length) return;

    const runSection = () => {
      runCursiveSectionParallel(items, font);
    };

    if (typeof IntersectionObserver === 'undefined') {
      runSection();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(section);
          runSection();
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px 80px 0px' }
    );

    observer.observe(section);
  });
}

function initStandaloneCursive(font) {
  const standalone = [...document.querySelectorAll('[data-cursive-text], [data-provide-title]')].filter(
    (el) => !el.closest('[data-cursive-section]')
  );

  standalone.forEach((el) => {
    scheduleCursiveAnimation(el, font);
  });
}

function initCursiveText() {
  const cursiveEls = document.querySelectorAll('[data-cursive-text], [data-provide-title]');
  if (!cursiveEls.length) return;

  loadCursiveFont((err, font) => {
    if (err || !font) {
      cursiveEls.forEach(setCursiveFallback);
      if (document.querySelector('#hero [data-cursive-text], #hero [data-provide-title]')) {
        emitHeroCursiveStart();
      }
      return;
    }

    const heroTitle = document.querySelector('#hero [data-cursive-text], #hero [data-provide-title]');
    const heroPromise = heroTitle
      ? scheduleCursiveAnimation(heroTitle, font)
      : Promise.resolve();

    heroPromise.then(() => {
      initCursiveSections(font);
      initStandaloneCursive(font);
    });
  });
}

initCursiveText();
