// ============================================================
//  ПЕРЕВОД АТРИБУТОВ
// ============================================================

async function processAttributes(root, lang) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

  const roots = getTranslationRoots(root);
  if (!roots.length) return;

  const needAPI = [];
  const needAPIReverse = [];

  for (const scopeRoot of roots) {
    const elements = [scopeRoot, ...scopeRoot.querySelectorAll('*')];

    for (const el of elements) {
      if (!shouldTranslateElement(el)) continue;

      for (const attr of TRANSLATABLE_ATTRIBUTES) {
        if (!el.hasAttribute(attr)) continue;
        if (attr === 'value' && !canTranslateValueAttr(el)) continue;

        const current = el.getAttribute(attr) || '';
        if (!current.trim()) continue;

        const origKey   = getAttrOriginalKey(attr);
        const origEnKey = getAttrOriginalEnKey(attr);

        if (lang === 'ru') {
          // Восстанавливаем из RU-оригинала (если был перевод RU→EN)
          if (el.hasAttribute(origKey)) {
            el.setAttribute(attr, el.getAttribute(origKey));
            el.removeAttribute(origKey);
            continue;
          }
          // Обратный перевод EN→RU для изначально английских значений
          if (!hasCyrillic(current) && hasLatin(current)) {
            if (!el.hasAttribute(origEnKey)) {
              el.setAttribute(origEnKey, current);
            }
            const origEn = el.getAttribute(origEnKey) || current;
            const { result, changed } = translateViaDictReverse(origEn);
            if (changed) {
              el.setAttribute(attr, result);
              if (hasLatin(result) && shouldSendToAPIReverse(result)) {
                needAPIReverse.push({ el, attr, originalText: origEn });
              }
            } else if (shouldSendToAPIReverse(origEn)) {
              needAPIReverse.push({ el, attr, originalText: origEn });
            }
          }
          continue;
        }

        // EN-режим: сохраняем оригинал и переводим RU→EN
        if (!el.hasAttribute(origKey)) {
          el.setAttribute(origKey, current);
        }

        const original = el.getAttribute(origKey) || current;

        if (!/[А-Яа-яЁё]/.test(original)) continue;

        const { result, changed } = translateViaDict(original);
        if (changed) {
          el.setAttribute(attr, result);

          // Если словарь перевёл только часть текста, добиваем остаток через API.
          if (hasCyrillic(result) && shouldSendToAPI(original)) {
            needAPI.push({ el, attr, originalText: original });
          }
        } else if (shouldSendToAPI(original)) {
          needAPI.push({ el, attr, originalText: original });
        }
      }
    }
  }

  await applyAPIAttrs(needAPI);
  await applyAPIAttrsReverse(needAPIReverse);
}

// ============================================================
//  ПЕРЕВОД ТЕКСТОВЫХ УЗЛОВ
// ============================================================

async function processNode(root, lang) {
  const roots = getTranslationRoots(root);
  if (!roots.length) {
    if (lang === 'en') console.log('[translate] no roots for node:', root);
    return;
  }

  const nodes = [];
  for (const scopeRoot of roots) {
    const walker = document.createTreeWalker(
      scopeRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;

          const baseEl = node.parentElement;
          if (!baseEl) return NodeFilter.FILTER_SKIP;
          if (!shouldTranslateElement(baseEl)) return NodeFilter.FILTER_SKIP;

          let el = baseEl.parentElement;
          while (el) {
            if (shouldSkip(el)) return NodeFilter.FILTER_SKIP;
            if (isExcludedElement(el)) {
              console.log('[translate] ancestor excluded:', el.className || el.tagName, '→ skipped text:', JSON.stringify(node.nodeValue.trim().slice(0, 40)));
              return NodeFilter.FILTER_SKIP;
            }
            el = el.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) nodes.push(walker.currentNode);
  }

  // ── Откат на RU / обратный перевод EN→RU ──
  if (lang === 'ru') {
    const needAPIReverse = [];

    for (const node of nodes) {
      const el = node.parentElement;
      if (el && el.hasAttribute(ATTR_ORIGINAL)) {
        // Восстановить русский оригинал (был переведён в EN-режиме)
        node.nodeValue = el.getAttribute(ATTR_ORIGINAL);
        el.removeAttribute(ATTR_ORIGINAL);
      } else {
        // Обратный перевод: английский текст → русский
        const text = node.nodeValue;
        if (!hasCyrillic(text) && hasLatin(text)) {
          // Сохраняем английский оригинал только если ещё не сохранён
          if (el && !el.hasAttribute(ATTR_ORIGINAL_EN)) {
            el.setAttribute(ATTR_ORIGINAL_EN, text);
          }
          const origEn = (el && el.getAttribute(ATTR_ORIGINAL_EN)) || text;
          const { result, changed } = translateViaDictReverse(origEn);
          if (changed) {
            node.nodeValue = result;
            if (hasLatin(result) && shouldSendToAPIReverse(result)) {
              needAPIReverse.push({ node, originalText: origEn });
            }
          } else if (shouldSendToAPIReverse(origEn)) {
            needAPIReverse.push({ node, originalText: origEn });
          }
        }
      }
    }

    await applyAPIReverse(needAPIReverse);
    await processAttributes(root, 'ru');
    return;
  }

  // ── Перевод на EN ──
  const needAPI = [];

  for (const node of nodes) {
    const el = node.parentElement;
    if (!el.hasAttribute(ATTR_ORIGINAL)) {
      el.setAttribute(ATTR_ORIGINAL, node.nodeValue);
    }

    const original = node.nodeValue;
    if (!hasCyrillic(original)) continue;
    const { result, changed } = translateViaDict(original);

    if (changed) {
      node.nodeValue = result;

      // Если после словаря осталась кириллица, отправляем до-перевод в API.
      if (hasCyrillic(result) && shouldSendToAPI(original)) {
        needAPI.push({ node, originalText: original });
      }
    } else {
      if (shouldSendToAPI(original)) {
        needAPI.push({ node, originalText: original });
      } else if (hasCyrillic(original)) {
        console.log(
          '[translate] API skipped for:', JSON.stringify(original.trim().slice(0, 60)),
          '| cyr:', (original.match(/[А-Яа-яЁё]/g) || []).length,
          '| lat:', (original.match(/[a-zA-Z]/g) || []).length,
          '| len:', original.trim().length,
        );
      }
    }
  }

  console.log(
    '[translate] roots:', roots.length,
    'text nodes:', nodes.length,
    'api queue:', needAPI.length,
  );

  await applyAPI(needAPI);
  await processAttributes(root, 'en');
}
