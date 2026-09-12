---
description: UI-задача по DESIGN.md с ограниченной проверкой в браузере
agent: build
---
Загрузи skill({ id: "impeccable" }) и выполни: $ARGUMENTS

Правила слоя — `docs/conventions.md` §15 (обязательно к прочтению до правки):
режим поверхности (`operate` для продуктовых экранов, `persuade` для витрины),
токены из `DESIGN.md`, интерактив только из `app/components/ui/*`,
в движении — `transform/opacity/filter/clip-path`.

Контекст API и типичных ошибок motion-v читай локально:
`.agents/skills/motion/best-practices/vue.md`, а не из сети.

Ритуал проверки (не расширять):
1. Построить поверхность целиком, без промежуточной полировки.
2. Поднять dev-сервер и снять **один** пакетный осмотр: `?motion=off`,
   desktop 1440 и mobile 360, после `agent-browser`, файлами в
   `.impeccable/review/desktop.png` и `.impeccable/review/mobile.png`; плюс
   механический детектор impeccable по изменённым файлам.
   Изменённые UI-файлы: !`git status --porcelain app/ | cat`
3. Исправить **все** найденные дефекты одним пакетом.
4. Один подтверждающий скрин — те же файлы.
5. Один вызов субагента `impeccable-finish-reviewer` — свежий контекст вне
   цикла полировки. В пакете: оба скриншота, режим поверхности, токены из
   `DESIGN.md`, findings детектора, диффы. `disposition` передать человеку
   дословно, `material_fixes` исправить одним пакетом. Если дефекты остались,
   перечислить их и спросить человека, а не начинать третий раунд.
6. Порог готовности: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`
   зелёные + строка в DEVLOG.md с тем, что реально видно на скриншоте.
