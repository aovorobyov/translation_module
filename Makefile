# ============================================================
#  translation_module — Makefile
#
#  Сборка: make
#  Только бандл без минификации: make build
#  Очистка артефактов: make clean
# ============================================================

# Порядок конкатенации важен: каждый файл видит переменные из предыдущих
SRCS = \
	src/config.js \
	src/dictionary.js \
	src/matching.js \
	src/api.js \
	src/dom.js \
	src/translate.js \
	src/ui.js

OUT    = script.js
MINOUT = script.min.js

# Явный путь к terser под Node v20 — без него сборка зависает (Node v10 слишком медленный)
TERSER        := $(HOME)/.nvm/versions/node/v20.10.0/bin/terser
# "passes=1" ускоряет компрессор в ~3× без заметной разницы в размере
TERSER_FLAGS   = --compress "passes=1" --mangle

.PHONY: all build minify clean

all: minify

# Собирает все src-файлы в один IIFE-бандл
build: $(OUT)

$(OUT): $(SRCS)
	@printf '(function () {\n\n' > $@
	@cat $(SRCS) >> $@
	@printf '\n})();\n' >> $@
	@echo "✅  Built: $@"

# Минифицирует собранный бандл через terser
# ВАЖНО: входной файл идёт первым — иначе terser ждёт stdin вместо файла
minify: $(OUT)
	@$(TERSER) $(OUT) $(TERSER_FLAGS) --output $(MINOUT)
	@echo "✅  Minified: $(MINOUT)"

clean:
	rm -f $(OUT) $(MINOUT)
	@echo "🗑️   Cleaned."
