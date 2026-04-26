// ============================================================
//  РЕГИСТР
// ============================================================

function detectCase(str) {
  const letters = str.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (!letters) return 'lower';
  if (letters === letters.toUpperCase()) return 'upper';
  if (
    letters[0] === letters[0].toUpperCase() &&
    letters.slice(1) === letters.slice(1).toLowerCase()
  )
    return 'title';
  if (letters === letters.toLowerCase()) return 'lower';
  return 'mixed';
}

function applyCase(translation, profile) {
  switch (profile) {
    case 'upper':
      return translation.toUpperCase();
    case 'title':
      return (
        translation.charAt(0).toUpperCase() +
        translation.slice(1).toLowerCase()
      );
    case 'lower':
      return translation.toLowerCase();
    default:
      return translation;
  }
}

// ============================================================
//  ПОДГОТОВКА СЛОВАРЕЙ
// ============================================================

// Прямой словарь (RU → EN), ключи приведены к нижнему регистру
const DICT_LOWER = {};
for (const [k, v] of Object.entries(DICTIONARY)) {
  DICT_LOWER[k.toLowerCase()] = v;
}
// Сортировка по убыванию длины: длинные фразы матчим раньше коротких
const DICT_KEYS = Object.keys(DICT_LOWER).sort((a, b) => b.length - a.length);

// Обратный словарь (EN → RU), значения приведены к нижнему регистру
const DICT_REVERSE_LOWER = {};
for (const [k, v] of Object.entries(DICTIONARY)) {
  const vl = v.toLowerCase();
  if (!DICT_REVERSE_LOWER[vl]) DICT_REVERSE_LOWER[vl] = k;
}

// Псевдонимы — дополнительные английские варианты → русский
// (нельзя выразить через DICTIONARY из-за ограничения уникальности ключей)
const DICT_REVERSE_ALIASES = {
  'alexendre': 'Александр',   // дубль: Alexander / Aleksandr
  'alexander': 'Александр',
  'alexandra': 'Александра',  // дубль: Alexandra / Aleksandra
  'alexendra': 'Александра',
  'ksenia': 'Ксения',         // дубль: Ksenia / Kseniia
  'sofiya': 'София',           // дубль: Sofiya / Sofia
  'julia': 'Юлия',             // дубль: Julia / Yulia
  'tatiana': 'Татьяна',        // дубль: Tatiana / Tatyana
  'elizaveta': 'Елизавета',    // дубль: Elizaveta / Elisabeth
  'sophie': 'Софи',            // дубль: Sophie / Sofi
};
Object.assign(DICT_REVERSE_LOWER, DICT_REVERSE_ALIASES);

const DICT_REVERSE_KEYS = Object.keys(DICT_REVERSE_LOWER).sort(
  (a, b) => b.length - a.length,
);

// ============================================================
//  МАТЧИНГ
// ============================================================

// Матчим ключи словаря только как целые токены/фразы,
// чтобы не ломать слова вроде "подростковый" → "подheightковый".
function buildTokenAwareRegex(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const edge = '[^0-9A-Za-zА-Яа-яЁё]';
  return new RegExp(`(^|${edge})(${escaped})(?=$|${edge})`, 'gi');
}

function translateViaDictReverse(text) {
  const trimmed = text.trim();
  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (DICT_REVERSE_LOWER[lower] !== undefined) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return {
      result:
        lead +
        applyCase(DICT_REVERSE_LOWER[lower], detectCase(normalized)) +
        tail,
      changed: true,
    };
  }

  let result = normalized;
  let changed = false;
  for (const key of DICT_REVERSE_KEYS) {
    result = result.replace(buildTokenAwareRegex(key), (m, lead, found) => {
      changed = true;
      return lead + applyCase(DICT_REVERSE_LOWER[key], detectCase(found));
    });
  }
  if (changed) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return { result: lead + result + tail, changed: true };
  }
  return { result: text, changed: false };
}

function translateViaDict(text) {
  const trimmed = text.trim();
  // Нормализуем пробелы/переносы — Tilda может рендерить текст с \n внутри блока.
  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (DICT_LOWER[lower] !== undefined) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return {
      result:
        lead + applyCase(DICT_LOWER[lower], detectCase(normalized)) + tail,
      changed: true,
    };
  }

  let result = normalized;
  let changed = false;
  for (const key of DICT_KEYS) {
    result = result.replace(buildTokenAwareRegex(key), (m, lead, found) => {
      changed = true;
      return lead + applyCase(DICT_LOWER[key], detectCase(found));
    });
  }
  if (changed) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return { result: lead + result + tail, changed: true };
  }
  return { result: text, changed: false };
}
