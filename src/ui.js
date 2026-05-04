// ============================================================
//  СОСТОЯНИЕ ЯЗЫКА
// ============================================================

let currentLang;
try {
  currentLang = localStorage.getItem(STORAGE_KEY_LANG) || DEFAULT_LANG;
} catch (_) {
  currentLang = DEFAULT_LANG;
}
let observer = null;
const searchInputDebouncers = new WeakMap();

// ============================================================
//  КНОПКИ ПЕРЕКЛЮЧЕНИЯ
// ============================================================

function setActiveButton(lang) {
  document
    .querySelectorAll('.ru-btn')
    .forEach((el) => el.classList.toggle('active', lang === 'ru'));
  document
    .querySelectorAll('.en-btn')
    .forEach((el) => el.classList.toggle('active', lang === 'en'));
}

async function switchLanguage(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  } catch (_) {}
  setActiveButton(lang);
  try {
    await processNode(document.body, lang);
    applyBilingualSearchSupport(document.body);
  } catch (err) {
    console.error('[translate] switchLanguage failed:', err);
  }
}

// ============================================================
//  ДВУЯЗЫЧНЫЙ ПОИСК
// ============================================================

function buildSearchAlias(text) {
  const value = (text || '').trim();
  if (!value) return null;

  let ru = value;
  let en = value;

  if (hasCyrillic(value)) {
    const direct = translateViaDict(value).result.trim();
    if (direct && !hasCyrillic(direct)) en = direct;
  } else if (hasLatin(value)) {
    const reverse = translateViaDictReverse(value).result.trim();
    if (reverse && hasCyrillic(reverse)) ru = reverse;
  }

  if (!ru || !en || ru.toLowerCase() === en.toLowerCase()) return null;
  return `${ru} ${en}`;
}

function injectSearchAliasIntoTitle(titleEl) {
  if (!titleEl || titleEl.nodeType !== Node.ELEMENT_NODE) return;
  if (titleEl.querySelector('.tr-search-alias')) return;

  const titleText = (titleEl.textContent || '').trim();
  if (!titleText) return;

  const alias = buildSearchAlias(titleText);
  if (!alias) return;

  const aliasEl = document.createElement('span');
  aliasEl.className = 'tr-search-alias';
  aliasEl.setAttribute('data-skip-translate', '1');
  aliasEl.setAttribute('aria-hidden', 'true');
  aliasEl.style.cssText = 'position:absolute;left:-99999px;width:1px;height:1px;overflow:hidden;';
  aliasEl.textContent = ` ${alias}`;

  titleEl.appendChild(aliasEl);
}

function enhanceSearchAliases(root) {
  if (!ENABLE_BILINGUAL_SEARCH || !SEARCH_PRODUCT_TITLE_SELECTORS) return;
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

  if (root.matches && root.matches(SEARCH_PRODUCT_TITLE_SELECTORS)) {
    injectSearchAliasIntoTitle(root);
  }

  if (!root.querySelectorAll) return;
  root
    .querySelectorAll(SEARCH_PRODUCT_TITLE_SELECTORS)
    .forEach(injectSearchAliasIntoTitle);
}

async function normalizeSearchInput(input) {
  if (!input || input.dataset.trSearchLock === '1') return;

  const raw = (input.value || '').trim();
  if (!raw || !hasCyrillic(raw)) return;

  let normalized = translateViaDict(raw).result.trim();
  if (!normalized || hasCyrillic(normalized)) {
    const apiValue = await translateViaAPI(raw, 'ru|en');
    if (apiValue) normalized = apiValue.trim();
  }

  if (!normalized || hasCyrillic(normalized)) return;
  if (normalized.toLowerCase() === raw.toLowerCase()) return;

  input.dataset.trSearchLock = '1';
  input.setAttribute('data-search-original-query', raw);
  input.value = normalized;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.trSearchLock = '0';
}

function bindSearchInput(input) {
  if (!input || input.dataset.trSearchBound === '1') return;
  input.dataset.trSearchBound = '1';

  input.addEventListener('input', () => {
    const prev = searchInputDebouncers.get(input);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      normalizeSearchInput(input).catch((err) => {
        console.warn('[translate] search normalize failed:', err);
      });
    }, SEARCH_QUERY_DEBOUNCE_MS);

    searchInputDebouncers.set(input, timer);
  });
}

function bindBilingualSearchInputs(root) {
  if (!ENABLE_BILINGUAL_SEARCH || !SEARCH_INPUT_SELECTORS) return;
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

  if (root.matches && root.matches(SEARCH_INPUT_SELECTORS)) {
    bindSearchInput(root);
  }

  if (!root.querySelectorAll) return;
  root.querySelectorAll(SEARCH_INPUT_SELECTORS).forEach(bindSearchInput);
}

function applyBilingualSearchSupport(root) {
  if (!ENABLE_BILINGUAL_SEARCH) return;
  enhanceSearchAliases(root);
  bindBilingualSearchInputs(root);
}

// ============================================================
//  MUTATION OBSERVER — попапы, слайдеры, табы
// ============================================================

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        processNode(added, currentLang).catch((err) => {
          console.error('[translate] mutation translate failed:', err);
        });
        applyBilingualSearchSupport(added);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
//  ОБРАБОТЧИКИ КЛИКОВ
// ============================================================

function bindButtons() {
  function scheduleSwitch(lang) {
    // Запускаем перевод после завершения текущего цикла клика,
    // чтобы не ломать внутренние обработчики Tilda.
    setTimeout(() => {
      switchLanguage(lang);
    }, 0);
  }

  document.addEventListener('click', (e) => {
    const ruBtn = e.target.closest('.ru-btn');
    const enBtn = e.target.closest('.en-btn');

    if (ruBtn) {
      console.log('[translate] ru-btn clicked');
      scheduleSwitch('ru');
    }
    if (enBtn) {
      console.log('[translate] en-btn clicked');
      scheduleSwitch('en');
    }
  });
}

// ============================================================
//  СТИЛИ АКТИВНОЙ КНОПКИ
// ============================================================

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .ru-btn.active .tn-atom__button-text,
    .en-btn.active .tn-atom__button-text {
      color: #9E9E9E !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function init() {
  console.log('[translate] 🚀 init started, lang:', currentLang);

  try {
    await syncDictionaryFromGoogleSheets();
  } catch (err) {
    console.warn('[translate] Google Sheets sync failed:', err);
  }

  applyBilingualSearchSupport(document.body);

  injectStyles();
  console.log('[translate] ✅ styles injected');

  bindButtons();
  console.log('[translate] ✅ buttons bound');

  startObserver();
  console.log('[translate] ✅ observer started');

  if (currentLang === 'en') {
    setActiveButton('en');
    console.log('[translate] ✅ active button set → EN');
    setTimeout(() => {
      console.log('[translate] ⏳ starting page translation...');
      processNode(document.body, 'en').then(() => {
        console.log('[translate] ✅ page translation done');
      });
    }, 400);
  } else {
    setActiveButton('ru');
    console.log('[translate] ✅ active button set → RU');
    // При старте в RU-режиме страница уже на русском — переводить нечего.
    // Обратный перевод EN→RU нужен только при явном переключении языка пользователем.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
