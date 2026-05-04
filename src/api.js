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

function loadRemoteDictionaryCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMOTE_DICT) || '{}';
    const ts = Number(localStorage.getItem(STORAGE_KEY_REMOTE_DICT_TS) || 0);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { entries: null, ts: 0 };
    return { entries: parsed, ts };
  } catch (_) {
    return { entries: null, ts: 0 };
  }
}

function saveRemoteDictionaryCache(entries) {
  try {
    localStorage.setItem(STORAGE_KEY_REMOTE_DICT, JSON.stringify(entries));
    localStorage.setItem(STORAGE_KEY_REMOTE_DICT_TS, String(Date.now()));
  } catch (_) {}
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

function parseGoogleSheetsCSV(text) {
  const rows = (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) return {};

  // Заголовки могут быть не в первой строке (часто A2/B2),
  // поэтому ищем их в первых строках файла.
  let headerRowIndex = -1;
  let ruIndex = -1;
  let enIndex = -1;

  const scanLimit = Math.min(rows.length, 12);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const headers = parseCSVLine(rows[rowIndex]).map((h) => h.toLowerCase());
    const maybeRu = headers.findIndex((h) => ['ru', 'рус', 'русский'].includes(h));
    const maybeEn = headers.findIndex((h) => ['en', 'eng', 'english', 'англ', 'английский'].includes(h));
    if (maybeRu !== -1 && maybeEn !== -1) {
      headerRowIndex = rowIndex;
      ruIndex = maybeRu;
      enIndex = maybeEn;
      break;
    }
  }

  if (headerRowIndex === -1 || ruIndex === -1 || enIndex === -1) {
    console.warn('[translate] Google Sheets: expected RU/EN headers not found in first rows');
    return {};
  }

  const entries = {};
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const cols = parseCSVLine(rows[i]);
    const ru = (cols[ruIndex] || '').trim();
    const en = (cols[enIndex] || '').trim();
    if (!ru || !en) continue;
    entries[ru] = en;
  }

  return entries;
}

function normalizeGoogleSheetsCSVUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const isGoogleSheets = /(^|\.)docs\.google\.com$/.test(parsed.hostname);
    const sheetMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!isGoogleSheets || !sheetMatch) return raw;

    const sheetId = sheetMatch[1];
    const gid = parsed.searchParams.get('gid') || '0';

    // Если уже export csv или pubcsv — оставляем как есть.
    if (parsed.pathname.includes('/export') || parsed.searchParams.get('output') === 'csv') {
      return raw;
    }

    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  } catch (_) {
    return raw;
  }
}

async function fetchGoogleSheetsDictionary() {
  if (!GOOGLE_SHEETS_SYNC_ENABLED || !GOOGLE_SHEETS_CSV_URL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_SHEETS_FETCH_TIMEOUT_MS);
  const csvUrl = normalizeGoogleSheetsCSVUrl(GOOGLE_SHEETS_CSV_URL);
  console.log('[translate] Google Sheets URL:', csvUrl);

  try {
    const response = await fetch(csvUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn('[translate] Google Sheets fetch failed:', response.status);
      return null;
    }

    const csv = await response.text();
    if (/<!doctype html>|<html/i.test(csv)) {
      console.warn('[translate] Google Sheets response is HTML, expected CSV. Check table access and URL format.');
      return null;
    }

    const parsed = parseGoogleSheetsCSV(csv);
    console.log('[translate] Google Sheets parsed entries:', Object.keys(parsed).length);
    return parsed;
  } catch (err) {
    console.warn('[translate] Google Sheets fetch error:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function syncDictionaryFromGoogleSheets() {
  if (!GOOGLE_SHEETS_SYNC_ENABLED || !GOOGLE_SHEETS_CSV_URL) return 0;

  const { entries: cachedEntries, ts } = loadRemoteDictionaryCache();
  const cachedSize = cachedEntries && typeof cachedEntries === 'object'
    ? Object.keys(cachedEntries).length
    : 0;
  const isFresh = ts > 0 && Date.now() - ts < GOOGLE_SHEETS_SYNC_TTL_MS;

  if (isFresh && cachedEntries && cachedSize > 0) {
    const changed = mergeDictionaryEntries(cachedEntries);
    console.log('[translate] Google Sheets dictionary source: cache, rows:', cachedSize, 'applied:', changed);
    return changed;
  }

  if (isFresh && cachedSize === 0) {
    console.warn('[translate] Google Sheets cache is empty, forcing refetch');
  }

  const entries = await fetchGoogleSheetsDictionary();
  if (!entries) {
    if (cachedEntries && cachedSize > 0) {
      const changed = mergeDictionaryEntries(cachedEntries);
      console.log('[translate] Google Sheets dictionary source: fallback cache, rows:', cachedSize, 'applied:', changed);
      return changed;
    }
    console.warn('[translate] Google Sheets dictionary unavailable, no cache rows');
    return 0;
  }

  const fetchedSize = Object.keys(entries).length;
  if (fetchedSize > 0) {
    saveRemoteDictionaryCache(entries);
  } else {
    console.warn('[translate] Google Sheets fetched 0 rows, cache not overwritten');
  }

  const changed = mergeDictionaryEntries(entries);
  console.log('[translate] Google Sheets dictionary source: network, rows:', fetchedSize, 'applied:', changed);
  return changed;
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
