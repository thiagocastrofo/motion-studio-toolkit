# Motion Studio Toolkit — Design System

Design system of the **Motion Studio Toolkit** After Effects panel. Original work: layout idea of a
compact "toolkit" (category rail + grid of one-click tools + options drawer); every icon, animation,
colour and line of code here is our own.

The tokens live in [`client/ds.css`](../client/ds.css); the animated icon set in
[`client/icons.js`](../client/icons.js).

## 1. Principles
1. **One click, one result.** Each tile runs its tool immediately with the last options used.
2. **Options on demand.** Tools with settings open a drawer at the bottom (or Alt+click any tile).
   Nothing else covers the grid.
3. **Motion explains the tool.** Every icon has a short animation that shows what the tool does
   (Sequence cascades its bars, Align snaps to a line, Loop spins…). It plays on hover and again on run.
4. **Quiet chrome, loud result.** Neutral graphite surfaces; colour only for the accent, state
   (success / error) and the category tint.
5. **Respect the host.** Follows After Effects' light/dark brightness and "reduce motion".

## 2. Tokens
| Group | Token | Value (dark) | Use |
|---|---|---|---|
| Surface | `--st-bg` | `#1b1b1d` | panel background |
| | `--st-surface` | `#232326` | tiles, drawer |
| | `--st-surface-2` | `#2c2c30` | hover, inputs |
| | `--st-line` | `rgba(255,255,255,.07)` | hairlines |
| Text | `--st-text` / `--st-text-2` / `--st-text-3` | 92 % / 60 % / 34 % white | primary / secondary / tertiary |
| Accent | `--st-accent` | `#ff7a1a` (Studio Orange) | selection, confirm, focus |
| State | `--st-ok` / `--st-err` | `#32d17a` / `#ff5a4f` | run feedback |
| Category tints | `--c-seq` `--c-layer` `--c-key` `--c-anim` `--c-audio` `--c-util` | orange, blue, violet, pink, teal, graphite | icon tint per category |
| Space | `--s1`…`--s6` | 4 · 8 · 12 · 16 · 20 · 24 | 4-pt grid |
| Radius | `--r-xs` `--r-sm` `--r-md` `--r-lg` | 4 · 6 · 10 · 14 | concentric (inner = outer − padding) |
| Type | `--t-xs` `--t-sm` `--t-md` `--t-lg` | 10 · 11.5 · 13 · 16 | caption · label · body · title |
| Motion | `--m-fast` `--m-base` `--m-slow` | 120 · 220 · 480 ms | |
| | `--e-out` `--e-spring` | `cubic-bezier(.2,.8,.2,1)` · `cubic-bezier(.34,1.56,.64,1)` | |

The light appearance redefines only the surface, line and text tokens.

## 3. Layout
One scrolling column of cards, ordered by how often each tool is used:
```
┌ mark · Motion Studio · ⚡ (Quick Apply) ┐
│ ( Básico | Texto | Legendas )          │  pill tabs
│ ┌ Comp card: name · specs · N layers ┐ │  shows the result of the last action
│ [Sólido][Texto][Ajuste][Null ↳N]       │  create row
│ [⧉ Pre-compor            N layers  ›] │  row + options (Juntas / Separadas / Desfazer)
│ ┌ Âncora 3×3 ┐ ┌ Alinhar Comp|Sel ┐   │  two cards side by side
│ ┌ Sequência: preview lines · Intervalo [drag] · Executar ┐ + Mais opções
│ ┌ Aplicar rápido: hotkey · toggle · Testar ┐              │
└────────────────────────────────────────┘
```
- **Texto**: Presets (Text Animator Pro, Type It, saved animations 0/6) and Fatiar texto (Letras / Palavras / Linhas).
- **Legendas**: Import (.srt / .vtt / .json), summary row (select · reapply · export .srt), Look / Motion / Layout with saved looks.

## 4. Components
| Component | Class | Notes |
|---|---|---|
| Pill tabs | `.ms-tabs` | 3 equal segments, selected = raised surface |
| Card | `.ms-card` | radius `--r-lg`, hairline, header `.ms-ch` (title + mono meta) |
| Comp card | `.ms-hero` | accent glow; sub line turns into the action result for 3.5 s |
| Create tile | `.ms-btile` | icon + label, counter in `sup` |
| Row | `.ms-row` | icon · label · meta · chevron (disclosure) |
| Anchor grid | `.ms-anchor` | 3×3 dots, picked cell flashes in the accent |
| Icon button | `.ms-ib` | align / distribute glyphs |
| Drag field | `.ms-drag` | scrub left/right, double-click to type; fill shows the value |
| Run | `.ms-run` | the one prominent action of a card (accent); `.light` variant for import |
| Field row | `.st-field` | label 84 px + control |
| Segmented | `.st-seg`, `.ms-seg2` | text only, nouns |
| Toggle | `.st-toggle` | 34×20, accent when on |
| Swatch | `.ms-swatch` | colour dot over a native colour input |
| Quick Apply | `.ms-qa` | search sheet: effects + .ffx presets, ↑↓ Enter Esc |

## 5. Animated icons
Grid 24 × 24, stroke 1.75, round caps and joins, no fills except small dots.
Each icon is built from parts. A part marked `data-a="…"` animates with one verb from this list:

| Verb | Motion |
|---|---|
| `draw` | stroke draws in (dash offset) |
| `slide-x` / `slide-y` | moves 3 px and back with spring |
| `drop` | falls 4 px into place |
| `spin` | rotates 360° around the icon centre |
| `pop` | scales 0.6 → 1 with spring |
| `stagger` | children appear one after another (`--i` index) |
| `swing` | rotates ±12° |
| `pulse` | scales 1 → 1.15 → 1 |
| `blink` | opacity 1 → .2 → 1 |

Each animation plays once on hover and once more when the tool runs. With "reduce motion" on, nothing moves.
