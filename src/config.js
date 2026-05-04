// ============================================================
//  НАСТРОЙКИ API
// ============================================================

// MyMemory — бесплатно, без регистрации, 5000 слов/день
// С email лимит вырастает до 10 000 слов/день (необязательно)
const MYMEMORY_EMAIL = ''; // можно оставить пустым

// LibreTranslate — fallback если MyMemory не ответил
// Публичные инстансы (можно менять если лежит):
//   https://libretranslate.com          — официальный, нужен ключ для >5 req
//   https://translate.terraprint.co     — публичный без ключа
//   https://lt.vern.cc                  — публичный без ключа
const LIBRE_URL = 'https://translate.terraprint.co/translate';

const STORAGE_KEY_LANG  = 'site_lang';
const STORAGE_KEY_CACHE = 'site_tr_cache';
const STORAGE_KEY_REMOTE_DICT = 'site_tr_remote_dict';
const STORAGE_KEY_REMOTE_DICT_TS = 'site_tr_remote_dict_ts';
const DEFAULT_LANG      = 'ru';

const ATTR_ORIGINAL              = 'data-orig-text';
const ATTR_ORIGINAL_EN           = 'data-orig-en-text';
const ATTR_ORIGINAL_ATTR_PREFIX    = 'data-orig-attr-';
const ATTR_ORIGINAL_EN_ATTR_PREFIX = 'data-orig-en-attr-';

// Tilda почти всегда держит видимый контент внутри .t-rec / popup-контейнеров.
// Важно: scope проверяем только один раз для текущего узла,
// а не для всей цепочки предков, иначе поиск ломается на body/html.
const TRANSLATE_SCOPE_SELECTORS = [
  '#allrecords .t-rec',
  '#allrecords .t-popup',
  '#allrecords .t-store__prod-popup',
];

// Контентные обёртки, в которых Tilda обычно рендерит видимый текст.
const CONTENT_SELECTOR = [
  '.tn-atom',
  '.t-title',
  '.t-descr',
  '.t-text',
  '.t-name',
  '.t-uptitle',
  '.t-btn',
  '.t-submit',
  '.t-feed__post-content',
  '.t-feed__post-textwrapper',
  '.t-card__title',
  '.t-card__descr',
  '.t-store__card',
  '.t-store__prod-popup',
  '.t-popup__container',
  '.t-form__inputsbox',
  '.t-input-block',
  'label',
].join(', ');

// Служебные ветки, которые попадают в DOM блока, но не являются контентом страницы.
// [aria-hidden="true"] намеренно убран: Tilda ставит его на контейнеры слайдов
// и accordion-блоков, из-за чего el.closest() блокирует весь вложенный контент.
// Реальную видимость контролирует isVisible() через getComputedStyle.
const EXCLUDED_SELECTOR = [
  '.t396__carrier',
  '.t396__filter',
  '.js-feed-preloader',
  '.t-feed__post-preloader',
  '.t-popup__close',
  '.t-popup__close-wrapper',
  '.t-slds__bullet_wrapper',
  '.t-slds__bullet',
  '.t-zoomable__btn',
  '.b24-form',
  '.b24-widget-button',
].join(', ');

// Ограничения для API: только полезные видимые RU-строки.
const TRANSLATE_ONLY_VISIBLE    = true;
const API_MIN_TEXT_LENGTH       = 2;
const API_REQUIRE_CYRILLIC      = true;
const API_MAX_UNIQUE_PER_PASS   = 120;
const TRANSLATABLE_ATTRIBUTES   = ['placeholder', 'value'];

// Двуязычный поиск в каталоге: RU-запросы нормализуем в EN и добавляем RU/EN алиасы к карточкам.
const ENABLE_BILINGUAL_SEARCH = true;
const SEARCH_INPUT_SELECTORS = [
  'input[type="search"]',
  '.t-store__search input',
  '.js-store-filter-search',
  '.t-store__filter__search input',
].join(', ');
const SEARCH_PRODUCT_TITLE_SELECTORS = [
  '.t-store__card .t-card__title',
  '.t-store__card .t-card__title a',
  '.t-store__prod-popup .t-store__prod-popup__title',
  '.js-store-prod-name',
].join(', ');
const SEARCH_QUERY_DEBOUNCE_MS = 220;

// Google Sheets: публичная CSV-ссылка на таблицу с колонками RU/EN.
const GOOGLE_SHEETS_SYNC_ENABLED = true;
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1nvlPgQxW6HyGKjco5cApHZtSxOpVoMM0Xgv5AuwKzP4/edit?usp=sharing';
const GOOGLE_SHEETS_FETCH_TIMEOUT_MS = 7000;
const GOOGLE_SHEETS_SYNC_TTL_MS = 10 * 60 * 1000;

// Логи отладки переводчика (no roots, skipped и т.п.).
const TRANSLATE_DEBUG_LOGS = false;

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
]);
