<template>
  <div class="min-h-dvh bg-background text-foreground">
    <!-- header -->
    <header class="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <div class="flex items-center gap-2 text-sm font-medium">
          <span class="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">Ф</span>
          <span>Фабрика идей</span>
          <span class="rounded-full bg-surface-cream px-2 py-0.5 text-xs font-medium text-foreground">DESIGN.md → tailwind v4</span>
        </div>
        <span class="text-xs text-muted-foreground">shadcn-vue · cssVariables: true · <code class="rounded bg-muted px-1 py-0.5">app/assets/css/tailwind.css</code></span>
      </div>
    </header>

    <main class="mx-auto max-w-[1200px] px-6 py-10 space-y-10">
      <!-- intro -->
      <section class="space-y-3">
        <h1 class="text-[32px] font-bold leading-none tracking-[-0.01em] text-primary">Темизация через CSS-переменные</h1>
        <p class="max-w-[68ch] text-sm leading-6 text-muted-foreground">
          Палитра экспортирована из <code class="rounded bg-muted px-1 py-0.5 text-foreground">DESIGN.md</code> командой
          <code class="rounded bg-muted px-1 py-0.5">npx @google/design.md export --format css-tailwind DESIGN.md</code>
          в <code class="rounded bg-muted px-1 py-0.5">app/assets/css/tailwind.css</code> (<code class="bg-muted px-1 py-0.5">@theme inline</code>).
          Семантические токены shadcn (<code class="bg-muted px-1">bg-background</code>, <code class="bg-muted px-1">text-foreground</code>, <code class="bg-muted px-1">bg-primary</code> …) мапятся на
          <code class="bg-muted px-1">:root</code>/<code class="bg-muted px-1">.dark</code> переменные — смена <code class="bg-muted px-1">:root</code> перекрашивает всё без правок в компонентах.
          Фирменные токены DESIGN.md (<code class="bg-muted px-1">bg-surface-cream</code>, <code class="bg-muted px-1">bg-surface-tint</code>, <code class="bg-muted px-1">text-primary-soft</code> …) доступны напрямую.
        </p>
      </section>

      <!-- tokens -->
      <section class="grid gap-6 md:grid-cols-2">
        <div class="rounded-xl border bg-card p-5">
          <h2 class="text-sm font-medium">Семантические токены shadcn</h2>
          <p class="mt-1 text-xs text-muted-foreground">Используй как <code class="bg-muted px-1">bg-background</code> / <code class="bg-muted px-1">text-foreground</code> — компоненты shadcn уже так делают.</p>
          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg border bg-background p-3"><div class="size-6 rounded bg-primary" /><div class="mt-2 font-medium">primary</div><div class="text-muted-foreground">#1650C8</div></div>
            <div class="rounded-lg border bg-card p-3"><div class="size-6 rounded bg-secondary" /><div class="mt-2 font-medium">secondary</div><div class="text-muted-foreground">#CD8BFF (lilac)</div></div>
            <div class="rounded-lg border bg-muted p-3"><div class="size-6 rounded bg-accent" /><div class="mt-2 font-medium">accent</div><div class="text-muted-foreground">#FFB922 (orange)</div></div>
            <div class="rounded-lg border bg-card p-3"><div class="size-6 rounded bg-muted" /><div class="mt-2 font-medium">muted</div><div class="text-muted-foreground">#F2F1EE</div></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <span class="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">bg-primary</span>
            <span class="rounded-full border bg-card px-3 py-1 text-xs">border</span>
            <span class="rounded-full bg-muted px-3 py-1 text-xs">bg-muted</span>
          </div>
        </div>

        <div class="rounded-xl border bg-card p-5">
          <h2 class="text-sm font-medium">Фирменные токены DESIGN.md</h2>
          <p class="mt-1 text-xs text-muted-foreground">Прямые утилиты из экспорта — без обёрток.</p>
          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg bg-surface-cream p-3 border"><div class="size-6 rounded bg-primary-container" /><div class="mt-2 font-medium">surface-cream</div><div class="text-muted-foreground">#FFEEC9</div></div>
            <div class="rounded-lg bg-surface-tint p-3 border"><div class="size-6 rounded bg-primary-soft" /><div class="mt-2 font-medium">surface-tint</div><div class="text-muted-foreground">#DEE7F6</div></div>
            <div class="rounded-lg bg-inverse-surface text-inverse-on-surface p-3"><div class="size-6 rounded bg-secondary" /><div class="mt-2 font-medium">inverse-surface</div><div class="text-muted-foreground text-inverse-on-surface/70">#111111</div></div>
            <div class="rounded-lg bg-success-soft p-3 border"><div class="size-6 rounded bg-success" /><div class="mt-2 font-medium">success-soft</div><div class="text-muted-foreground">#DFF3E8</div></div>
          </div>
        </div>
      </section>

      <!-- components demo -->
      <section class="space-y-4">
        <h2 class="text-sm font-medium">Компоненты shadcn-vue на этих токенах</h2>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[#1147B8]">Primary · bg-primary</button>
          <button class="inline-flex h-12 items-center justify-center rounded-full bg-secondary px-6 text-sm font-medium text-secondary-foreground">Lilac · bg-secondary</button>
          <button class="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground">Orange · bg-accent</button>
          <button class="inline-flex h-12 items-center justify-center rounded-full border bg-background px-6 text-sm font-medium">Secondary · border</button>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-xl border bg-card p-5">
            <div class="text-xs font-medium text-muted-foreground">card · bg-card</div>
            <div class="mt-2 text-sm leading-6">Карточка использует <code class="bg-muted px-1">bg-card</code> / <code class="bg-muted px-1">text-card-foreground</code> — в <code class="bg-muted px-1">.dark</code> становится тёмной без правок.</div>
          </div>
          <div class="rounded-xl bg-surface-cream p-5 border">
            <div class="text-xs font-medium text-muted-foreground">DESIGN.md · bg-surface-cream</div>
            <div class="mt-2 text-sm leading-6">Highlight-секции бренда — напрямую через фирменный токен.</div>
          </div>
          <div class="rounded-xl bg-inverse-surface text-inverse-on-surface p-5">
            <div class="text-xs font-medium opacity-70">hero · bg-inverse-surface</div>
            <div class="mt-2 text-sm leading-6">Чёрные hero-полосы: <code class="bg-white/10 px-1">bg-inverse-surface</code> + <code class="bg-white/10 px-1">text-inverse-on-surface</code>.</div>
          </div>
        </div>
      </section>

      <!-- radius -->
      <section class="rounded-xl border bg-card p-5">
        <h2 class="text-sm font-medium">Радиусы — 1:1 из DESIGN.md</h2>
        <p class="mt-1 text-xs text-muted-foreground">sm 8 · md 12 · lg 16 · xl 24 · full 999px (pill). shadcn-шкала <code class="bg-muted px-1">calc(var(--radius)*…)</code> не переопределяет бренд.</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <div class="size-16 rounded-sm bg-primary" />
          <div class="size-16 rounded-md bg-primary" />
          <div class="size-16 rounded-lg bg-primary" />
          <div class="size-16 rounded-xl bg-primary" />
          <div class="h-16 rounded-full bg-primary px-6 flex items-center text-primary-foreground text-xs">rounded-full 999px</div>
        </div>
      </section>
    </main>
  </div>
</template>
