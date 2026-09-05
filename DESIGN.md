---
version: alpha
name: Фабрика идей
description: >-
  Дизайн-система бренда «Фабрика идей»: тёплый белый холст, синие заголовки
  Outfit Bold, кремовые секции с лучевым sunburst-декором, контрастные чёрные
  hero-полосы и живые pill-кнопки в лиловом и оранжевом.
category: Brands
surface: web
colors:
  primary: "#1650C8"            # Headline Blue — заголовки, primary-CTA, графики
  on-primary: "#FFFDF9"         # текст и иконки на синем
  primary-container: "#1E4FC4"  # глубокий синий — фон gradient-карточек
  on-primary-container: "#FFFDF9"
  primary-soft: "#E4EAFB"       # светлая синяя подложка чипов и иконок
  secondary: "#CD8BFF"          # Lilac — pill-кнопки, statement-текст на чёрном
  on-secondary: "#111111"       # Ink на лиловом (белый не проходит по контрасту)
  secondary-soft: "#F1E4FE"     # светлая лиловая подложка чипов
  tertiary: "#FFB922"           # Orange — pill-кнопки, amber-плитки, градиенты
  on-tertiary: "#111111"        # Ink на оранжевом (белый не проходит)
  background: "#FFFDF9"         # Warm White — холст страницы
  foreground: "#111111"         # Ink — основной текст и фон hero-секций
  surface: "#F2F1EE"            # Warm Surface — панели и карточки 2-го уровня
  surface-bright: "#FFFFFF"     # белые карточки на тёплом холсте
  surface-cream: "#FFEEC9"      # Cream — highlight-секции и sunburst-декор
  surface-tint: "#DEE7F6"       # холодная голубая подложка витрин и мокапов
  muted: "#6E675C"              # Warm Gray — вторичный текст и метаданные
  border: "#E2DFD8"             # линии, каркас, разделители
  inverse-surface: "#111111"    # фон контрастных hero-секций
  inverse-on-surface: "#FFFDF9" # светлый текст на чёрном
  success: "#2B7350"            # функциональный статус «хорошо»
  success-soft: "#DFF3E8"       # подложка статуса «хорошо»
typography:
  display-xl:
    fontFamily: Outfit
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  display-lg:
    fontFamily: Outfit
    fontSize: 44px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
  title-md:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.35
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Outfit
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  label-sm:
    fontFamily: Outfit
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.02em"
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  section-y: 96px
  container-max: 1200px
  gutter: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  button-primary-hover:
    backgroundColor: "#1147B8"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  button-accent-lilac:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  button-accent-orange:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  button-inverse:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 48px
  chip-blue:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  chip-lilac:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  chip-cream:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  chip-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 6px
  card:
    backgroundColor: "{colors.surface-bright}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-cream:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-highlight-blue:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.title-md}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-inverse:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.title-md}"
    rounded: "{rounded.xl}"
    padding: 24px
  panel-showcase:
    backgroundColor: "{colors.surface-tint}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: 32px
  stat-tile:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.foreground}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
    padding: 16px
  stat-tile-accent:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
    padding: 16px
  input-field:
    backgroundColor: "{colors.surface-bright}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  input-label:
    typography: "{typography.label-sm}"
    textColor: "{colors.muted}"
  nav-bar:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    height: 72px
  sidebar-item-active:
    backgroundColor: "{colors.surface-cream}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  tooltip-blue:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 8px
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  headline-on-light:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.headline-lg}"
  display-statement-on-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.display-lg}"
  body-on-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.body-md}"
  eyebrow-on-light:
    typography: "{typography.label-sm}"
    textColor: "{colors.muted}"
  eyebrow-on-dark:
    typography: "{typography.label-sm}"
    textColor: "{colors.inverse-on-surface}"
---

## Overview

«Фабрика идей» — бренд, который выглядит как опытный коллега: читаемый, надёжный, тёплый, но не стерильный. Система построена на контрасте двух миров. Первый — тёплый белый холст `#FFFDF9` вместо стерильного чистого белого, кремовые секции, синие заголовки Outfit Bold и мягкий лучевой sunburst-декор. Второй — контрастные чёрные hero-полосы `#111111`, которые задают ритм длинным страницам: на них выходят крупные statement-тексты и ключевые утверждения бренда.

Целевая аудитория — команды и продукты, которым нужны ясность и доверие: интерфейсы, лендинги, презентационные материалы, социальные сети. Эмоциональная цель — «нам можно верить, с нами не скучно». Плотность информации средняя: воздух важнее украшательств, но без холодной пустоты. Там, где не хватает явного правила, решайте в пользу читаемости и тепла: скруглённые формы, мягкие радиусы, живой акцент вместо неона.

## Colors

Палитра держится на тёплой нейтральной базе и трёх активных цветах. Токены в frontmatter — нормативные значения; ниже — роли и правила применения.

- **Primary — Headline Blue `#1650C8`:** главный акцент. Заголовки (Bold), primary-кнопки, ссылки, активные элементы графиков, синие gradient-карточки. На тёплом белом даёт контраст 6.5:1, на кремовом — 5.8:1.
- **Secondary — Lilac `#CD8BFF`:** pill-кнопки и чипы (текст — Ink), крупные statement-абзацы на чёрных hero-секциях, вторая линия в графиках и кольцевых диаграммах.
- **Tertiary — Orange `#FFB922`:** pill-кнопки и чипы (текст — Ink), amber-плитки фактов, стартовый цвет amber-градиентов, акцентные иконки и логотип-глиф.
- **Background — Warm White `#FFFDF9`:** холст страницы. Не заменять чистым белым: тёплый подтон — часть характера бренда.
- **Foreground — Ink `#111111`:** основной текст и фон контрастных hero-секций.
- **Surface — Warm Surface `#F2F1EE`:** панели, вторичные карточки, сайдбары.
- **Surface Cream `#FFEEC9`:** highlight-секции, кремовые плитки, тон sunburst-декора.
- **Muted — Warm Gray `#6E675C`:** вторичный текст, подписи, метаданные (контраст 5.5:1 на холсте).
- **Border `#E2DFD8`:** линии, каркас карточек, разделители таблиц.
- **Inverse — чёрная hero-полоса:** фон `#111111`, текст `#FFFDF9`.

Правила применения цвета:

- Заголовки — всегда Headline Blue `#1650C8`, вес Bold. Основной текст — Ink `#111111`, вторичный — Warm Gray `#6E675C`.
- Hero-секции: фон `#111111`, светлый текст `#FFFDF9`. Синий `#1650C8` для текста на чёрном запрещён — контраст ниже 3:1.
- Pill-кнопки: фон `#CD8BFF` или `#FFB922`, текст Ink `#111111`. Белый текст на этих акцентах не проходит по контрасту — не применять.
- Кремовые секции `#FFEEC9` — highlight-блоки между обычными секциями; синие заголовки на кремовом сохраняют контраст 5.8:1.
- Blue-градиентные карточки: базовый `#1E4FC4`, текст `#FFFDF9` (контраст 7:1).
- Статусы: «хорошо/улучшение» — зелёный `#2B7350` на `#DFF3E8`; предупреждение — Orange с Ink; ошибка — насыщенный красный, вводится точечно и не входит в бренд-палитру.

Градиенты — фирменный приём, описаны в разделе Imagery.

## Typography

Единственная гарнитура — **Outfit**, загружается с весами 400 / 500 / 700. Промежуточные начертания браузером не синтезировать: если нужен «полужирный» — берите 500 или 700, не `font-weight: 600`. Fallbacks: system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif.

Шкала из 10 уровней (токены — в frontmatter):

- **display-xl (64 / 700):** главные hero-заголовки лендингов и баннеров, цвет — Headline Blue на светлом или Warm White на чёрном.
- **display-lg (44 / 500):** крупные statement-абзацы на чёрных hero-полосах, цвет — Lilac `#CD8BFF`; lineHeight 1.25 держит широкие строки читаемыми.
- **headline-lg (32 / 700):** заголовки секций на светлом — всегда Headline Blue.
- **headline-md (24 / 700):** заголовки маркетинговых карточек и историй.
- **title-md (18 / 500):** заголовки карточек в интерфейсе («Профили», «Визиты»), имена, значения плиток.
- **body-lg (18 / 400):** лид-абзацы, подзаголовки секций, цвет — Muted или Ink.
- **body-md (16 / 400):** основной текст.
- **body-sm (14 / 400):** подписи, вспомогательный текст таблиц, оси графиков.
- **label-md (15 / 500):** кнопки, пункты навигации, поля форм.
- **label-sm (13 / 500):** чипы, теги, eyebrow-надзаголовки, шапки таблиц.

Eyebrow-надзаголовки — sentence case, без CAPS: на светлых секциях Warm Gray, на чёрных — Warm White. Цифры и метрики набираются Outfit 500/700; табличные данные — 400, статусы — 500.

## Layout

Система координат — **8px baseline grid**. Все отступы кратны 8 (допустим полу-шаг 4px для микро-правок внутри чипов и иконок).

- Контейнер: max-width 1200px, боковые поля 24px (мобильные) / 64px (десктоп), 12-колоночная сетка с gutter 24px.
- Вертикальный ритм секций: 96px между логическими блоками, 128px перед чёрными hero-полосами и после них.
- Карточки: внутренний паддинг 24px, межкарточные отступы 24px; ряды плиток-фактов — 4 колонки с отступом 16px.
- Таблицы: высота строки 56px, разделитель 1px `#E2DFD8`, шапка — label-sm Warm Gray.
- Формы: вертикальный шаг полей 16px, подпись над полем 8px, кнопка после последнего поля 24px.
- Навигация: топ-бар 72px; в интерфейсах — левый иконочный сайдбар 72–80px.

Страница живёт ритмом трёх типов секций: **тёплая светлая** (холст, контент, карточки) → **чёрная hero-полоса** (statement, ритм) → **кремовая highlight-секция** (факты, цифры, плитки). Чередуйте их, чтобы длинные страницы дышали; две чёрные полосы подряд не ставят.

## Elevation & Depth

Система почти плоская: иерархию строят тон и каркас, а не тени.

- Уровень 0 — холст `#FFFDF9`; уровень 1 — панели `#F2F1EE` и кремовые секции `#FFEEC9`; уровень 2 — белые карточки `#FFFFFF` с рамкой 1px `#E2DFD8`.
- Тени запрещены на статичных элементах интерфейса: граница 1px + перепад тона решают всё.
- Исключения, где мягкая рассеянная тень уместна: плавающие тултипы и дропдауны, device-мокапы на градиентных витринах, 3D-объекты. Формула: `0 24px 64px rgba(17, 17, 17, 0.18)`, без резких краёв.
- Sunburst-декор — самый нижний слой секции, под контентом, с приглушённой прозрачностью 40–70%; он не конкурирует с текстом и не перекрывает карточки.
- Тултипы и всплывающие карточки (например, значение на графике) — верхний слой: синяя плашка `#1650C8` с белым текстом и лёгкой тенью.

## Shapes

Форма языка — мягкая геометрия без острых углов.

- Базовый радиус 8px: поля ввода, тултипы, маленькие плитки.
- Карточки и панели: 16px; крупные медиа-карточки, витрины и мокапы: 24px.
- Pill-кнопки, чипы, поисковые поля, сегменты-переключатели: 999px (full).
- Иконки и аватары — круги; иконные кнопки сайдбара — скруглённый квадрат 12px.
- Границы везде 1px, цвет `#E2DFD8`; двойные и пунктирные рамки в UI не используются (пунктир допустим только в construction-grid декоре бренда).
- Фирменный **sunburst**: 8–12 лучей со скруглёнными концами, расходящихся из центра или угла; тона — только кремовые (`#FFEEC9` на `#FFFDF9` или `#111111`; на кремовых секциях — тон-в-тон `#FFF3DC`). Не более одного декоративного пятна на секцию.
- Логотип-глиф — «солнечный человек»: фигура из скруглённых лучей, цвет Orange `#FFB922` на светлом или Cream на чёрном.

## Components

### Buttons

Одна основная кнопка на экран. Все кнопки — pill (radius 999px), высота 48px, паддинг 12px/24px, типографика label-md.

- **Primary** — синяя pill `#1650C8`, текст Warm White; главный CTA («Записаться», «Отправить»). Hover — `#1147B8`. Часто несёт стрелку-иконку ↗ справа.
- **Accent (lilac / orange)** — фон `#CD8BFF` или `#FFB922`, текст Ink. Живые вторичные действия и промо-кнопки; оранжевая — теплее и «громче», лиловая — мягче.
- **Secondary** — белая pill с рамкой 1px `#E2DFD8`, текст Ink; альтернативные действия, «Продолжить с Google/Apple», кнопки в формах.
- **Inverse** — чёрная pill, текст Warm White; на светлых секциях и градиентных баннерах («Подписаться»).
- Иконные кнопки: круг 40px, фон Warm Surface, иконка Ink; точка-уведомление — Orange.

### Chips & Tags

Pill-чипы высотой 28–32px, типографика label-sm. Варианты: `chip-blue` (подложка `#E4EAFB`, текст синий), `chip-lilac` (`#F1E4FE`, Ink), `chip-cream` (`#FFEEC9`, Ink), `chip-success` (`#DFF3E8`, зелёный). Ряд из 2–4 чипов ставят над заголовком или под ним (как теги этапов «Брифинг / Онбординг / Исследование»). Статусные теги таблиц — те же чипы: «Завершено» cream, «Запланировано» lilac, «Улучшается» success.

### Cards & Tiles

- **Карточка по умолчанию:** белый фон, радиус 16px, паддинг 24px, заголовок title-md, текст body-md, каркас 1px `#E2DFD8`.
- **card-cream / card-surface:** кремовые и серые варианты для группировки и highlight-блоков.
- **Плитка фактов** (Location / Niche / Services / Timeline): иконка-глиф сверху, подпись label-sm Warm Gray, значение Bold Ink; фон cream, одна из четырёх может быть amber (`stat-tile-accent`) — та, что важнее.
- **Gradient-карточка (blue):** фон-градиент `#4D7FE3 → #1743B8`, радиус 24px, белый заголовок и текст, декор из 3D-стеклянных сфер; кнопка-ссылка со стрелкой ↗.
- **card-inverse:** чёрная карточка для цитат и заявлений на светлых секциях.
- Стопки карточек (лента записей, документы): белые pill-карточки 12px лежат с нахлёстом 8–12px на amber-градиентной подложке, у каждой — иконка и стрелка ↗.

### Forms & Inputs

- Поле: белый фон, радиус 8px, высота 44px, рамка 1px `#E2DFD8`; фокус — рамка `#1650C8` 2px. Placeholder — Warm Gray.
- Подпись над полем — label-sm Warm Gray, 8px до поля; хелпер — body-sm Warm Gray, 4px после; ошибка — красная рамка и body-sm красного.
- Primary-кнопка формы — синяя pill на всю ширину колонки (как «Создать аккаунт» в онбординге).
- Сегменты-переключатели (роль «Пациент / Врач»): группа pill в контейнере `#F2F1EE`; активный сегмент — `#E4EAFB` с синим текстом, неактивный — прозрачный с Ink.
- Экраны форм живут на белых карточках 16px внутри секции; заголовок экрана — headline-md Ink, помощник — body-sm Warm Gray.

### Navigation

- Топ-бар: глиф + вордмарк слева (Ink), меню label-md, справа — аватар-чип (имя + роль, chevron) и одна primary-pill.
- Сайдбар интерфейса: кремовая колонка `#FBF7EF`, глиф бренда сверху, иконки Ink/Warm Gray, активный пункт — скруглённый квадрат с cream-подложкой и оранжевым глифом; внизу — аватар.
- Поиск — pill-поле с иконкой лупы на фоне `#F2F1EE`.
- Хлебные крошки и eyebrow-метки разделов («О проекте», «Процесс») — label-sm.

### Data & Charts

- Линейный график: линия `#1650C8` 2px со скруглёнными концами, точки 6px, пунктирная сетка `#E2DFD8`, подписи дней body-sm Warm Gray; диапазон нормы — штриховка или заливка `#E4EAFB` 40%.
- Area-график (этапы, часы): линия цветом акцента + градиентная заливка вниз до прозрачности (синий / лиловый / оранжевый — по смыслу ряда).
- Кольцевой прогресс: толстая дуга 12–16px со скруглёнными концами, трек Cream; сегменты Amber и Lilac; в центре — цифра 500/700; галочки-статусы — белые круги с цветной обводкой.
- Значение-тултип — `tooltip-blue`: синяя плашка, дата и метрика, стрелка ↗.
- Сегменты данных окрашиваются строго токенами: primary → secondary → tertiary, зелёный — только статус.

### Tooltips & Overlays

Тултип — 8px радиус, паддинг 8px/12px, появляется у точки данных или иконки; на тёмном фоне допустим вариант «белая плашка + Ink». Дропдауны-меню — белая карточка 12px, тень по правилам Elevation, пункты 40px с hover-подложкой `#F2F1EE`.

### Decor

Sunburst и градиенты — единственные декоративные элементы; правила — в Imagery. Помните: декор никогда не кладётся поверх текста и не сокращает контраст ниже норм из Colors.

## Voice & Tone

- **Adjectives:** читаемый, надёжный, тёплый.
- **Tone:** пишем как опытный коллега — коротко, по делу, живым языком. Структура и конкретика — как в технической документации, тепло — как в хорошем письме человеку, а не рассылке «уважаемый клиент».

Messaging pillars:

1. Читаемость важнее украшательства.
2. Надёжность без канцелярита.
3. Тепло — в деталях, а не в пафосе.

Vocabulary:

- **Use:** просто, по делу, с человеческой интонацией; короткие фразы, активные глаголы; обращение на «вы» со строчной.
- **Avoid:** канцелярит («осуществляем деятельность»), стерильные формулировки, неоновые метафоры, «инновационный» и «уникальный» без фактуры.

Примеры: «Соберём прототип за неделю — и покажем, как он работает» вместо «Мы осуществляем комплексную разработку инновационных решений». CTA — глагол: «Записаться», «Собрать», «Отправить», а не «Узнать больше» в каждом экране.

## Imagery

Стиль иллюстрации и декора — мягкая плоская векторная графика с тёплой палитрой. Главное действующее лицо — **sunburst**: расходящиеся лучи со скруглёнными концами.

- **Sunburst-паттерн:** лучи из центра или угла секции; кремовые тона (`#FFEEC9` на тёплом белом и на чёрном, `#FFF3DC` тон-в-тон на кремовом). Прозрачность 40–70%, слой строго под контентом. Максимум одно декоративное пятно на секцию.
- **Градиентные витрины:** device-мокапы (ноутбук, планшет, телефон) стоят под углом на градиентной подложке с большой мягкой тенью. Наборы градиентов: amber `#FFD98E → #FFB922 → #F59B00` (продуктовые витрины, плитки), peach `#FFF0D9 → #FFC795 → #EFA36B` (финальные баннеры), showcase-blue `#A9C0F2 → #5D87E8` (мобильные экраны), promo-blue `#4D7FE3 → #1743B8` (промо-карточки со стеклянными 3D-сферами).
- **Витринная подложка:** холодно-голубая панель `#DEE7F6` с крупными белыми мягкими фигурами (quatrefoil/sunburst) — для соцсетей и показа экранов; текст на ней — Ink.
- **Фотографии:** реальные люди за работой, тёплый естественный свет, лёгкий тёплый грейдинг; кадры живут в карточках радиусом 24px или на всю ширину секции. Стоковые «белые детали на белом» — нет.
- **3D-акценты:** стеклянные сферы и мягкие объёмные фигуры — только на синих промо-карточках, 1–2 объекта на карточку.
- **Construction-grid:** чертёжная сетка с пунктирными окружностями поверх гигантского глифа — декор для «о бренде» и обложек; линии Warm White на синем `#1E4FC4`.
- **Avoid:** резкие неоновые градиенты, чистый стерильный белый как фон секций, холодные серые, глитч и киберпанк, фотографии с синюшным тонированием.

## Do's and Don'ts

- Do держите холст тёплым: фон страницы — только `#FFFDF9`; чистый `#FFFFFF` — лишь внутри карточек.
- Don't не ставьте синий текст `#1650C8` на чёрный — контраст ниже 3:1; на чёрном живут Warm White и Lilac.
- Don't не кладите белый текст на лиловые и оранжевые поверхности — только Ink `#111111`.
- Do одна primary-кнопка на экран; остальные действия — secondary, accent или иконные.
- Do максимум один sunburst-пятна на секцию, всегда под контентом.
- Don't не используйте веса 600 и синтетические полужирные — только 400 / 500 / 700.
- Do чередуйте ритм секций: светлая → чёрная полоса → кремовая; две чёрные полосы подряд — ошибка.
- Do проверяйте пары фон/текст по WCAG AA (4.5:1): все пары токенов в frontmatter уже проходят проверку.
- Don't не добавляйте новые цвета вне палитры; зелёный — только функциональный статус.
- Do заголовки — всегда Headline Blue Bold на светлом; на чёрном — Warm White, statement-абзацы — Lilac.
- Don't не заменяйте pill-кнопки прямоугольными: radius 999px — часть узнаваемости.
- Do декор и градиенты не трогают контент: текст всегда на сплошной подложке или поверх затемнённой области.
