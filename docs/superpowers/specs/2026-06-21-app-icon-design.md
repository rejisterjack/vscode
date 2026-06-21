# FewStepsAway — Application Icon Design

**Date:** 2026-06-21
**Status:** Approved & implemented
**Scope:** Master brand icon for the FewStepsAway editor + full platform asset set (.icns / .ico / .png).

## 1. Concept

**"Steps → goal caret"** — three ascending steps climb diagonally toward the upper-right, where an amber goal-marker peaks above the highest step. It reads at a glance as both *progress/ascent* (the staircase) and *a code caret/summit* (the marker), which matches the product's "few steps away from your goal" identity.

Composition (1024×1024 viewBox, centered):

- **Background tile** — rounded square (corner radius ~22%, `rx=224`), filled with the Gradient Ascent diagonal: indigo `#1E1B4B` (bottom-left) → violet `#4C1D95` (top-right).
- **Staircase** — a single filled stair-climb path, 3 treads, spanning x ≈ 260–764, y ≈ 392–812. Filled with a diagonal gradient indigo `#6366F1` (bottom-left) → cyan `#22D3EE` (top-right), so colour itself ascends. A soft drop-shadow lifts it off the background.
- **Goal caret** — a bold amber `#FBBF24` upward triangle seated on the top tread, backed by a soft radial amber glow (the "goal"). Centered over the top tread around (680, 320).

The diagonal motion (bottom-left → top-right) is consistent across background, steps, and goal, giving the mark a single strong direction.

## 2. Palette — "Gradient Ascent"

| Role | Colour | Hex |
|------|--------|-----|
| Background low | Deep indigo | `#1E1B4B` |
| Background high | Violet | `#4C1D95` |
| Step low | Indigo | `#6366F1` |
| Step high | Cyan | `#22D3EE` |
| Goal caret / glow | Amber | `#FBBF24` |

Indigo→violet ground + indigo→cyan ascent + a single warm amber accent. High contrast for legibility at 16px.

## 3. Asset set

Master SVG plus platform-specific rasters:

| File | Format | Purpose | Sizes |
|------|--------|---------|-------|
| `resources/icons/logo.svg` | SVG | Master, regen source | 1024 viewBox |
| `resources/darwin/code.icns` | ICNS | macOS bundle icon | 16→512 + @2x (to 1024) |
| `resources/win32/code.ico` | ICO | Windows app icon | 16/24/32/48/64/128/256 |
| `resources/linux/code.png` | PNG | Linux app icon | 512 |
| `resources/server/code-192.png` | PNG | PWA / web manifest | 192 |
| `resources/server/code-512.png` | PNG | PWA / web manifest | 512 |

## 4. Toolchain

- **rsvg-convert** (Homebrew `librsvg`) — SVG → PNG rasterization.
- **iconutil** (macOS built-in) — PNG iconset → `.icns`.
- **Node script** (`build/icon-gen/pack-ico.js`) — multi-resolution `.ico` packer (PNG-encoded entries, Vista+).

## 5. Regeneration

`build/icon-gen/build-icons.sh` rasterizes the master SVG and emits every asset into `resources/`. Re-run after editing `logo.svg`.

## 6. Design notes / rationale

- Two flat gradient shapes + one accent keeps the icon legible at 16px and crisp at 1024px.
- Sharp geometry (no fiddly bevels) chosen deliberately over decorative rounding — modern, bold, scales down cleanly.
- Diagonal consistency (one direction for ground, ascent, and goal) is the main compositional rule; do not introduce a competing axis if revising.
