const CURSIVE_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/allura/Allura-Regular.ttf';
const DEFAULT_DRAW_MS = 3500;

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

function animatePathStroke(pathEl, pathLength, durationMs) {
  return new Promise((resolve) => {
    if (pathLength < 1) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pathEl.style.strokeDashoffset = '0';
      resolve();
    };

    pathEl.style.strokeDasharray = `${pathLength} ${pathLength}`;
    pathEl.style.strokeDashoffset = String(pathLength);

    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      pathEl.style.strokeDashoffset = String(pathLength * (1 - progress));

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      finish();
    }

    requestAnimationFrame(frame);
    window.setTimeout(finish, durationMs + 200);
  });
}

function getSvg(el) {
  return el.querySelector('.cursive-svg') || el.querySelector('.hero-title-svg');
}

function getGlyphs(el) {
  return el.querySelector('.cursive-glyphs') || el.querySelector('.hero-title-glyphs');
}

async function animateCursive(el, font) {
  const text = getCursiveText(el);
  const fontSize = parseInt(el.dataset.fontSize || '128', 10);
  const drawMs = parseInt(el.dataset.drawMs || String(DEFAULT_DRAW_MS), 10);
  const svg = getSvg(el);
  const glyphsGroup = getGlyphs(el);
  const { items, viewBox } = getLetterPaths(font, text, fontSize);
  const msPerLetter = Math.max(100, drawMs / Math.max(items.length, 1));
  const letterStagger = Math.min(70, Math.round(msPerLetter * 0.3));

  glyphsGroup.innerHTML = '';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.classList.remove('is-loading');

  const pathEls = items.map((item) => {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', item.pathData);
    pathEl.setAttribute('class', 'cursive-letter');
    glyphsGroup.appendChild(pathEl);
    return pathEl;
  });

  await Promise.all(
    pathEls.map(
      (pathEl, index) =>
        new Promise((resolve) => {
          window.setTimeout(() => {
            const pathLength = pathEl.getTotalLength();
            animatePathStroke(pathEl, pathLength, msPerLetter).then(resolve);
          }, index * letterStagger);
        })
    )
  );
}

function showCursiveInstant(el, font) {
  const text = getCursiveText(el);
  const fontSize = parseInt(el.dataset.fontSize || '128', 10);
  const svg = getSvg(el);
  const glyphsGroup = getGlyphs(el);
  const { items, viewBox } = getLetterPaths(font, text, fontSize);

  glyphsGroup.innerHTML = '';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.classList.remove('is-loading');

  items.forEach((item) => {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', item.pathData);
    pathEl.setAttribute('class', 'cursive-letter cursive-letter--complete');
    glyphsGroup.appendChild(pathEl);
  });
}

function emitHeroCursiveStart() {
  document.dispatchEvent(new CustomEvent('provide:hero-cursive-start'));
}

function runCursiveAnimation(el, font) {
  if (el.closest('#hero')) {
    emitHeroCursiveStart();
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    showCursiveInstant(el, font);
    return Promise.resolve();
  }

  return animateCursive(el, font).catch(() => {
    const glyphs = getGlyphs(el);
    if (glyphs) glyphs.innerHTML = '';
    setCursiveFallback(el);
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
