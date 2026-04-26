// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СТРОК
// ============================================================

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text || '');
}

function hasLatin(text) {
  return /[a-zA-Z]/.test(text || '');
}

function isMainlyRussian(text) {
  // Отправляем в API только текст, в котором кириллицы больше, чем латиницы.
  // Это исключает двуязычные метки вида «Имя | Name», «Telegram username» и т.п.
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[a-zA-Z]/g) || []).length;
  return cyr >= Math.max(lat, 1);
}

function isMainlyEnglish(text) {
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[a-zA-Z]/g) || []).length;
  return lat >= Math.max(cyr, 1);
}

function shouldSendToAPI(text) {
  const trimmed = text.trim();
  if (trimmed.length < API_MIN_TEXT_LENGTH) return false;
  // Пропускаем строки без единой буквы (цифры, символы, пунктуация).
  // Намеренно НЕ используем /u-флаг: \W в unicode-режиме матчит кириллицу как "не \w".
  if (!/[А-Яа-яЁёa-zA-Z]/.test(trimmed)) return false;
  if (API_REQUIRE_CYRILLIC && !hasCyrillic(trimmed)) return false;
  if (!isMainlyRussian(trimmed)) return false;
  return true;
}

function shouldSendToAPIReverse(text) {
  const trimmed = text.trim();
  if (trimmed.length < API_MIN_TEXT_LENGTH) return false;
  if (!hasLatin(trimmed)) return false;
  // Пропускаем email-адреса
  if (trimmed.includes('@')) return false;
  // Пропускаем CSS/код
  if (/[{};]/.test(trimmed)) return false;
  if (!isMainlyEnglish(trimmed)) return false;
  return true;
}

// ============================================================
//  ФИЛЬТРЫ ЭЛЕМЕНТОВ DOM
// ============================================================

function shouldSkip(el) {
  return (
    SKIP_TAGS.has(el.tagName) ||
    el.hasAttribute('data-skip-translate') ||
    el.classList.contains('ru-btn') ||
    el.classList.contains('en-btn')
  );
}

function isInTranslateScope(el) {
  if (!TRANSLATE_SCOPE_SELECTORS.length) return true;
  const selector = TRANSLATE_SCOPE_SELECTORS.join(', ');
  if (el.closest(selector)) return true;
  return !document.querySelector(selector);
}

function isExcludedElement(el) {
  if (!EXCLUDED_SELECTOR) return false;
  return !!el.closest(EXCLUDED_SELECTOR);
}

function isContentElement(el) {
  if (!CONTENT_SELECTOR) return true;
  return !!el.closest(CONTENT_SELECTOR);
}

function isVisible(el) {
  if (!TRANSLATE_ONLY_VISIBLE) return true;
  if (!el || !el.isConnected) return false;
  if (el.closest('[hidden]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return true;
}

function shouldTranslateElement(el) {
  if (!el) return false;
  if (!isInTranslateScope(el)) return false;
  if (shouldSkip(el)) return false;
  if (isExcludedElement(el)) return false;
  if (!isContentElement(el)) return false;
  if (!isVisible(el)) return false;
  return true;
}

function getTranslationRoots(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];
  if (!TRANSLATE_SCOPE_SELECTORS.length) return [root];

  const selector = TRANSLATE_SCOPE_SELECTORS.join(', ');
  const candidates = [];

  if (root.matches && root.matches(selector)) {
    candidates.push(root);
  }

  if (root.querySelectorAll) {
    candidates.push(...root.querySelectorAll(selector));
  }

  if (!candidates.length && root.closest && root.closest(selector)) {
    candidates.push(root);
  }

  const unique = [];
  for (const candidate of candidates) {
    if (!candidate || unique.includes(candidate)) continue;
    unique.push(candidate);
  }

  return unique.filter((candidate) => {
    return !unique.some(
      (other) => other !== candidate && other.contains(candidate),
    );
  });
}

// ============================================================
//  АТРИБУТЫ: КЛЮЧИ ДЛЯ ХРАНЕНИЯ ОРИГИНАЛЬНЫХ ЗНАЧЕНИЙ
// ============================================================

function getAttrOriginalKey(attr) {
  return `${ATTR_ORIGINAL_ATTR_PREFIX}${attr}`;
}

function getAttrOriginalEnKey(attr) {
  return `${ATTR_ORIGINAL_EN_ATTR_PREFIX}${attr}`;
}

function canTranslateValueAttr(el) {
  if (el.tagName !== 'INPUT') return false;
  const type = (el.getAttribute('type') || '').toLowerCase();
  return type === 'button' || type === 'submit' || type === 'reset';
}
