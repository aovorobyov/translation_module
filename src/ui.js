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
  } catch (err) {
    console.error('[translate] switchLanguage failed:', err);
  }
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

function init() {
  console.log('[translate] 🚀 init started, lang:', currentLang);

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
