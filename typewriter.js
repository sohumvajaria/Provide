const TYPEWRITER_CHAR_MS = 24;
const TYPEWRITER_PUNCTUATION_MS = 120;

function getTypewriterDelay(char) {
  if ('.—,;:!?>'.includes(char)) {
    return TYPEWRITER_CHAR_MS + TYPEWRITER_PUNCTUATION_MS;
  }
  return TYPEWRITER_CHAR_MS;
}

function prepareTypewriterElement(el) {
  const fullText = el.textContent.trim();

  el.textContent = '';
  el.classList.add('is-typewriter');

  const spacer = document.createElement('span');
  spacer.className = 'typewriter-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.textContent = fullText;

  const live = document.createElement('span');
  live.className = 'typewriter-live';

  const output = document.createElement('span');
  output.className = 'typewriter-output';

  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.setAttribute('aria-hidden', 'true');

  live.appendChild(output);
  live.appendChild(cursor);
  el.appendChild(spacer);
  el.appendChild(live);
  el.setAttribute('aria-label', fullText);

  return { output, cursor, fullText };
}

function runTypewriter(output, cursor, fullText) {
  let index = 0;

  function tick() {
    if (index >= fullText.length) {
      cursor.classList.add('is-done');
      return;
    }

    const char = fullText[index];
    output.textContent += char;
    index += 1;
    window.setTimeout(tick, getTypewriterDelay(char));
  }

  tick();
}

function initTypewriter() {
  const elements = document.querySelectorAll('[data-typewriter]');
  if (!elements.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  elements.forEach((el) => {
    const { output, cursor, fullText } = prepareTypewriterElement(el);
    const startDelay = parseInt(el.dataset.typewriterDelay || '0', 10);
    const trigger = el.closest('.home-how-step') || el.closest('#hero-copy') || el;

    const start = () => {
      if (el.dataset.typewriterStarted === 'true') return;
      el.dataset.typewriterStarted = 'true';

      if (prefersReducedMotion) {
        output.textContent = fullText;
        cursor.classList.add('is-done');
        return;
      }

      window.setTimeout(() => runTypewriter(output, cursor, fullText), startDelay);
    };

    const isHeroQuote = el.classList.contains('hero-quote-text');

    if (isHeroQuote) {
      document.addEventListener('provide:hero-cursive-start', () => start(), { once: true });
      window.setTimeout(() => {
        if (el.dataset.typewriterStarted !== 'true') {
          start();
        }
      }, 1500);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(trigger);
          start();
        });
      },
      { threshold: 0.3, rootMargin: '0px 0px -32px 0px' }
    );

    observer.observe(trigger);
  });
}

initTypewriter();
