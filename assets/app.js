/* assets/app.js - category-aware card loader + lazy batch render + search */
(function () {
  'use strict';

  // CONFIG
  const BATCH_SIZE = 8;
  const SENTINEL_ID = 'sentinel';
  const CARDS_CONTAINER_ID = 'cardsArea';
  const SPINNER_ID = 'spinner';
  const ENDMSG_ID = 'endMessage';
  const DEFAULT_JSON = (window.SITE_BASE || '') + '/data/default.json'; // fallback

  // HELPERS
  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => Array.from((p || document).querySelectorAll(s));
  const safe = s => s == null ? '' : String(s);

  // App state
  let allData = [];
  let idx = 0;
  let observer = null;

  // Detect data source for this page
  function getPageDataUrl() {
    // page author should set data-src on main or body
    const main = qs('main') || qs('body');
    if (main && main.dataset && main.dataset.src) {
      // If page gives absolute path, use as-is; otherwise attach site base
      return main.dataset.src;
    }
    // try page-level global variable SITE_DATA
    if (window.SITE_DATA && typeof window.SITE_DATA === 'string') return window.SITE_DATA;
    return DEFAULT_JSON;
  }

  async function fetchJson(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.error('fetchJson', url, e);
      return [];
    }
  }

  function placeholderSVG(w = 136, h = 192) {
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="#f4f6f8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#b0b7bd" font-size="13">No image</text></svg>`;
  }

  function createCard(item) {
    const title = safe(item.title);
    const desc = safe(item.desc || item.summary || '');
    const img = safe(item.img);
    const link = safe(item.link || '#');

    const article = document.createElement('article');
    article.className = 'card';
    article.innerHTML = `
      <div class="card-content">
        <div class="media">
          ${img ? `<img src="${img}" alt="${title}" loading="lazy">` : placeholderSVG()}
        </div>
        <div class="body">
          <h3 class="title">${title}</h3>
          <div class="hr"></div>
          <p class="desc">${desc}</p>
          <div class="offer-row">
            <div class="offer-text">ডিসকাউন্ট পেতে এখানে কিনুন</div>
            <a class="btn" href="${link}" target="_blank" rel="noopener noreferrer">Buy Now</a>
          </div>
        </div>
      </div>
    `.trim();
    return article;
  }

  function appendBatch() {
    const container = qs(`#${CARDS_CONTAINER_ID}`);
    if (!container) return;
    const spinner = qs(`#${SPINNER_ID}`);
    spinner && (spinner.hidden = false);

    // small delay for UX
    setTimeout(() => {
      const slice = allData.slice(idx, idx + BATCH_SIZE);
      slice.forEach(item => container.appendChild(createCard(item)));
      idx += slice.length;
      spinner && (spinner.hidden = true);

      if (idx >= allData.length) {
        const endmsg = qs(`#${ENDMSG_ID}`);
        endmsg && (endmsg.hidden = false);
        if (observer && qs(`#${SENTINEL_ID}`)) {
          try { observer.unobserve(qs(`#${SENTINEL_ID}`)); } catch (e) { /* ignore */ }
        }
      }
    }, 100);
  }

  async function loadAndStart() {
    const dataUrl = getPageDataUrl();
    allData = await fetchJson(dataUrl);
    idx = 0;
    // clear existing
    const container = qs(`#${CARDS_CONTAINER_ID}`);
    if (container) container.innerHTML = '';
    appendBatch();
    initObserver();
  }

  function initObserver() {
    const sentinel = qs(`#${SENTINEL_ID}`);
    if (!sentinel) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) appendBatch();
      });
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
  }

  // simple client-side search: filters current JSON and rerenders
  function performSearch(q) {
    q = (q || '').trim().toLowerCase();
    const container = qs(`#${CARDS_CONTAINER_ID}`);
    if (!container) return;
    container.innerHTML = '';
    idx = 0;
    qs(`#${ENDMSG_ID}`) && (qs(`#${ENDMSG_ID}`).hidden = true);

    if (!q) {
      // show first batch of full data
      appendBatch();
      return;
    }
    const results = allData.filter(item => {
      const hay = `${safe(item.title)} ${safe(item.desc || '')} ${safe(item.summary || '')}`.toLowerCase();
      return hay.includes(q);
    });
    results.forEach(item => container.appendChild(createCard(item)));
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    loadAndStart();
    // expose search
    window.performSearch = performSearch;
  });

})();
