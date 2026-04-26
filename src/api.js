// ============================================================
//  MYMEMORY API
// ============================================================

/**
 * MyMemory не поддерживает батч — переводит по одной строке.
 * Запросы запускаются параллельно через Promise.all.
 */
async function fetchMyMemory(text, langpair = 'ru|en') {
  try {
    const params = new URLSearchParams({
      q: text,
      langpair,
      ...(MYMEMORY_EMAIL ? { de: MYMEMORY_EMAIL } : {}),
    });
    const resp = await fetch(
      `https://api.mymemory.translated.net/get?${params}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    // responseStatus 200 = успех, 429 = лимит исчерпан
    if (data.responseStatus !== 200) {
      console.warn(
        '[translate] MyMemory:',
        data.responseStatus,
        data.responseDetails,
      );
      return null;
    }
    return data.responseData.translatedText || null;
  } catch (e) {
    console.warn('[translate] MyMemory fetch error:', e);
    return null;
  }
}

// ============================================================
//  LIBRETRANSLATE API (fallback)
// ============================================================

async function fetchLibre(text, source = 'ru', target = 'en') {
  try {
    const resp = await fetch(LIBRE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.translatedText || null;
  } catch (e) {
    console.warn('[translate] LibreTranslate fetch error:', e);
    return null;
  }
}

// ============================================================
//  КЭШ + ОСНОВНАЯ ФУНКЦИЯ ПЕРЕВОДА
// ============================================================

let cache = {};
try {
  cache = JSON.parse(localStorage.getItem(STORAGE_KEY_CACHE) || '{}');
} catch (_) {}

function saveCache() {
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(cache));
  } catch (_) {}
}

/**
 * Переводит один текст: кэш → MyMemory → LibreTranslate.
 * langpair: 'ru|en' (по умолчанию) или 'en|ru' для обратного перевода.
 */
async function translateViaAPI(text, langpair = 'ru|en') {
  const key = langpair + ':' + text.trim();
  if (!text.trim()) return null;
  if (cache[key]) return cache[key];

  if (translateViaAPI.inFlight[key]) {
    return translateViaAPI.inFlight[key];
  }

  const [src, tgt] = langpair.split('|');
  translateViaAPI.inFlight[key] = (async () => {
    let result = await fetchMyMemory(text.trim(), langpair);
    if (!result) result = await fetchLibre(text.trim(), src, tgt);
    if (!result) return null;

    cache[key] = result;
    saveCache();
    return result;
  })();

  try {
    return await translateViaAPI.inFlight[key];
  } finally {
    delete translateViaAPI.inFlight[key];
  }
}
translateViaAPI.inFlight = Object.create(null);

// ============================================================
//  ПРИМЕНЕНИЕ РЕЗУЛЬТАТОВ API К ТЕКСТОВЫМ УЗЛАМ
// ============================================================

async function applyAPI(pendingNodes) {
  if (!pendingNodes.length) return;

  const grouped = new Map();
  for (const item of pendingNodes) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key);
      if (!translation) return;

      for (const { node, originalText } of items) {
        const lead = originalText.match(/^\s*/)[0];
        const tail = originalText.match(/\s*$/)[0];
        node.nodeValue = lead + translation + tail;
      }
    }),
  );
}

async function applyAPIReverse(pendingNodes) {
  if (!pendingNodes.length) return;

  const grouped = new Map();
  for (const item of pendingNodes) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key, 'en|ru');
      if (!translation) return;

      for (const { node, originalText } of items) {
        const lead = originalText.match(/^\s*/)[0];
        const tail = originalText.match(/\s*$/)[0];
        node.nodeValue = lead + translation + tail;
      }
    }),
  );
}

// ============================================================
//  ПРИМЕНЕНИЕ РЕЗУЛЬТАТОВ API К АТРИБУТАМ
// ============================================================

async function applyAPIAttrs(pendingAttrs) {
  if (!pendingAttrs.length) return;

  const grouped = new Map();
  for (const item of pendingAttrs) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key);
      if (!translation) return;

      for (const { el, attr } of items) {
        el.setAttribute(attr, translation);
      }
    }),
  );
}

async function applyAPIAttrsReverse(pendingAttrs) {
  if (!pendingAttrs.length) return;

  const grouped = new Map();
  for (const item of pendingAttrs) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key, 'en|ru');
      if (!translation) return;

      for (const { el, attr } of items) {
        el.setAttribute(attr, translation);
      }
    }),
  );
}
