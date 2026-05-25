const PROVIDE_TITLE_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/allura/Allura-Regular.ttf';
const PROVIDE_TITLE_TEXT = 'Provide';
const PROVIDE_TITLE_DRAW_MS = 3500;

let cachedProvideFont = null;

function setTitleFallback(titleEl) {
  titleEl.classList.add('is-fallback');
  titleEl.classList.remove('is-loading');
}

function buildLetterPaths(font, fontSize) {
  const baselineY = fontSize * 0.85;
  let x = 0;
  const letters = PROVIDE_TITLE_TEXT.split('');
  const items = [];

  letters.forEach((char) => {
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
  const pad = 18;

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

async function animateProvideTitle(titleEl, items, viewBox) {
  const svg = titleEl.querySelector('.hero-title-svg');
  const fillsGroup = titleEl.querySelector('.hero-title-fills');
  const strokesGroup = titleEl.querySelector('.hero-title-strokes');
  const drawMs = parseInt(titleEl.dataset.drawMs || String(PROVIDE_TITLE_DRAW_MS), 10);
  const msPerLetter = drawMs / items.length;

  fillsGroup.innerHTML = '';
  strokesGroup.innerHTML = '';

  svg.setAttribute('viewBox', viewBox);
  titleEl.classList.remove('is-loading');

  for (const item of items) {
    const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fillPath.setAttribute('d', item.pathData);
    fillPath.setAttribute('class', 'hero-title-letter-fill');
    fillsGroup.appendChild(fillPath);

    const strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    strokePath.setAttribute('d', item.pathData);
    strokePath.setAttribute('class', 'hero-title-letter-stroke');
    strokesGroup.appendChild(strokePath);

    const pathLength = strokePath.getTotalLength();
    await animatePathStroke(strokePath, pathLength, msPerLetter);

    fillPath.classList.add('is-visible');
    strokePath.classList.add('is-done');
  }
}

function showTitleInstant(titleEl, items, viewBox) {
  const svg = titleEl.querySelector('.hero-title-svg');
  const fillsGroup = titleEl.querySelector('.hero-title-fills');
  const strokesGroup = titleEl.querySelector('.hero-title-strokes');

  strokesGroup.innerHTML = '';
  fillsGroup.innerHTML = '';
  svg.setAttribute('viewBox', viewBox);
  titleEl.classList.remove('is-loading');

  items.forEach((item) => {
    const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fillPath.setAttribute('d', item.pathData);
    fillPath.setAttribute('class', 'hero-title-letter-fill is-visible');
    fillsGroup.appendChild(fillPath);
  });
}

function runTitleAnimation(titleEl, font) {
  const fontSize = parseInt(titleEl.dataset.fontSize || '128', 10);
  const { items, viewBox } = buildLetterPaths(font, fontSize);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    showTitleInstant(titleEl, items, viewBox);
    return Promise.resolve();
  }

  return animateProvideTitle(titleEl, items, viewBox).catch(() => {
    titleEl.querySelector('.hero-title-fills').innerHTML = '';
    titleEl.querySelector('.hero-title-strokes').innerHTML = '';
    setTitleFallback(titleEl);
  });
}

function scheduleTitleAnimation(titleEl, font) {
  const drawOn = titleEl.dataset.drawOn || 'load';

  if (drawOn !== 'scroll') {
    return runTitleAnimation(titleEl, font);
  }

  return new Promise((resolve) => {
    if (typeof IntersectionObserver === 'undefined') {
      runTitleAnimation(titleEl, font).then(resolve);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(titleEl);
          runTitleAnimation(titleEl, font).then(resolve);
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(titleEl);
  });
}

function loadProvideFont(callback) {
  if (cachedProvideFont) {
    callback(null, cachedProvideFont);
    return;
  }

  if (typeof opentype === 'undefined') {
    callback(new Error('opentype unavailable'));
    return;
  }

  opentype.load(PROVIDE_TITLE_FONT_URL, (err, font) => {
    if (!err && font) {
      cachedProvideFont = font;
    }
    callback(err, font);
  });
}

function initProvideTitles() {
  const titleEls = document.querySelectorAll('[data-provide-title]');
  if (!titleEls.length) return;

  loadProvideFont((err, font) => {
    if (err || !font) {
      titleEls.forEach(setTitleFallback);
      return;
    }

    titleEls.forEach((titleEl) => {
      scheduleTitleAnimation(titleEl, font);
    });
  });
}

initProvideTitles();
