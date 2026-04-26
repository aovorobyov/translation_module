# translation_module

Скрипт переключения языка (RU ↔ EN) для проекта OPENUP MODELS на **Tilda**.  
Вставляется в *Настройки сайта → Свой JS / HEAD* в виде одного минифицированного файла.

---

## Как это работает

1. На странице появляются две кнопки с классами `.ru-btn` и `.en-btn`.
2. При клике на «EN» скрипт обходит все текстовые узлы и атрибуты (`placeholder`, `value` кнопок) внутри контентных блоков Tilda и:
   - сначала ищет перевод в локальном **словаре** (`src/dictionary.js`),
   - если не нашёл — отправляет запрос в **MyMemory API**, при неудаче — в **LibreTranslate**;
   - результаты сохраняются в `localStorage` (кэш).
3. При возврате в «RU» восстанавливается оригинальный русский текст из `data`-атрибутов элементов.
4. **MutationObserver** автоматически переводит динамически добавляемый контент (попапы, слайдеры, табы).

---

## Структура репозитория

```
translation_module/
├── src/
│   ├── config.js       — константы, настройки API, CSS-селекторы Tilda
│   ├── dictionary.js   — словарь переводов RU → EN (фразы, имена, UI-строки)
│   ├── matching.js     — построение DICT_LOWER/DICT_REVERSE, алгоритм матчинга,
│   │                     функции detectCase / applyCase / translateViaDict*
│   ├── api.js          — HTTP-клиенты MyMemory и LibreTranslate, кэш,
│   │                     функции applyAPI* / applyAPIAttrs*
│   ├── dom.js          — фильтры DOM-элементов (shouldSkip, isVisible,
│   │                     getTranslationRoots, canTranslateValueAttr и др.)
│   ├── translate.js    — processNode (текстовые узлы) и processAttributes
│   └── ui.js           — init, switchLanguage, MutationObserver, bindButtons,
│                         injectStyles, стартовый код DOMContentLoaded
├── script.js           — собранный IIFE-бандл (генерируется через `make build`)
├── script.min.js       — минифицированная версия для вставки в Tilda
│                         (генерируется через `make`)
├── Makefile            — правила сборки
└── README.md
```

> `script.js` и `script.min.js` — **артефакты сборки**, не редактируются вручную.  
> Источник истины — файлы в `src/`.

---

## Сборка

Требования: **Node.js** (для `npx terser`).

| Команда | Что делает |
|---------|-----------|
| `make` | Собирает бандл и минифицирует → `script.min.js` |
| `make build` | Только конкатенация → `script.js` (без минификации) |
| `make minify` | Минифицирует уже собранный `script.js` |
| `make clean` | Удаляет `script.js` и `script.min.js` |

Сборка конкатенирует `src/*.js` в строгом порядке, оборачивает в `(function () { ... })();` и запускает `terser --compress --mangle`.

---

## Как добавить/изменить перевод

Открой `src/dictionary.js` и отредактируй объект `DICTIONARY`:

```js
// Длинные фразы — ВЫШЕ коротких (матчинг идёт по убыванию длины)
'Связаться с нами': 'Contact us',
'Наша миссия':      'Our mission',
// Регистр ключа не важен — 'купить' == 'Купить'
```

После правок запусти `make` — готовый `script.min.js` вставь в Tilda.

---

## Настройка API

Все настройки находятся в `src/config.js`:

| Переменная | Назначение |
|---|---|
| `MYMEMORY_EMAIL` | Email для увеличения лимита MyMemory до 10 000 слов/день (необязательно) |
| `LIBRE_URL` | URL публичного инстанса LibreTranslate (fallback) |
| `API_MAX_UNIQUE_PER_PASS` | Максимум уникальных строк в одном проходе API (по умолчанию 120) |
| `TRANSLATE_SCOPE_SELECTORS` | CSS-селекторы Tilda-блоков, внутри которых работает перевод |
| `CONTENT_SELECTOR` | Список классов контентных элементов Tilda |
| `EXCLUDED_SELECTOR` | Служебные элементы, которые нужно пропускать |

---

## Вставка в Tilda

1. Запустить `make` — получить `script.min.js`.
2. Скопировать содержимое файла.
3. В Tilda: *Настройки сайта → Дополнительно → JS в HEAD* → вставить.
4. Опубликовать сайт.
