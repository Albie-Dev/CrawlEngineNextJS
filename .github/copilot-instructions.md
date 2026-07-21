# Kolia Design Theme & Coding Conventions

## Color System

### CSS Variables (theme-aware, defined in `app/globals.css`)

```css
:root {
  --bg-primary: #f4f6f8;       /* Page background */
  --bg-secondary: #ffffff;      /* Card/surface background */
  --bg-tertiary: #f8fafc;      /* Subtle hover/active background */
  --text-primary: #0f172a;     /* Headings, main text */
  --text-secondary: #334155;   /* Body text */
  --text-muted: #64748b;       /* Secondary/muted text */
  --border-color: #e2e8f0;     /* Borders, dividers */
  --kolia-green: #0F8C6F;     /* Brand green */
}

.dark {
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-tertiary: #1f2937;
  --text-primary: #f3f4f6;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border-color: #374151;
}
```

### Tailwind Custom Colors (defined in `tailwind.config.ts`)

| Usage | Class | CSS Variable |
|-------|-------|-------------|
| Page bg | `bg-bgPrimary` | `var(--bg-primary)` |
| Card/surface bg | `bg-bgSecondary` | `var(--bg-secondary)` |
| Hover/active bg | `bg-bgTertiary` | `var(--bg-tertiary)` |
| Heading text | `text-textPrimary` | `var(--text-primary)` |
| Body text | `text-textSecondary` | `var(--text-secondary)` |
| Muted text | `text-textMuted` | `var(--text-muted)` |
| Borders | `border-borderColor` | `var(--border-color)` |

### Kolia Brand Colors (fixed, not theme-aware)

| Color | Hex | Usage |
|-------|-----|-------|
| `kolia-ink` | `#102033` | Dark text, active nav item |
| `kolia-midnight` | `#0A1422` | Darker variant |
| `kolia-green` | `#0F8C6F` | Brand accent, success states |
| `kolia-mint` | `#DFF4ED` | Light green backgrounds |
| `kolia-gold` | `#C89A2D` | Accent |
| `kolia-amber` | `#FFF5D8` | Light amber backgrounds |
| `kolia-line` | `#DCE5EA` | Borders (light mode only) |

## Rules for Implementing UI

### 1. ALWAYS use CSS variable classes instead of hardcoded colors

✅ **Correct:**
```tsx
<div className="bg-bgSecondary text-textPrimary border border-borderColor">
```

❌ **Wrong:**
```tsx
<div className="bg-white text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800">
```

### 2. Badge color convention (for status/scores)

All badges MUST have dark mode variants using `dark:bg-*-900/30` and `dark:text-*-400`:

```tsx
// Success/green badges
"bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"

// Error/red badges  
"bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"

// Warning/orange badges
"bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400"

// Info/blue badges
"bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"

// Neutral badges
"bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
```

### 3. Icon container convention

All icon wrapper divs MUST have dark mode variant:

```tsx
// Brand green icon
<div className="bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green">
  <Icon />
</div>

// Orange icon
<div className="bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400">
  <Icon />
</div>
```

### 4. StatCard iconBg prop convention

When passing `iconBg` and `iconColor` as props, always include dark variants:

```tsx
<StatCard
  iconBg="bg-kolia-mint dark:bg-emerald-900/40"
  iconColor="text-kolia-green"
/>
```

### 5. Avoid `dark:` prefix with hardcoded colors

❌ **Wrong:** `dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800`
✅ **Correct:** Use CSS variable classes (`bg-bgSecondary`, `text-textPrimary`, `border-borderColor`)

The CSS variables automatically switch in dark mode — no `dark:` prefix needed.

### 6. RSuite DateRangePicker dark mode

DO NOT override rsuite classes inline. All rsuite dark mode overrides are in `app/globals.css` using `html.dark .rs-*` selectors (to cover portal-rendered popups).

### 7. Recharts tick values

When using `scale="log"` on Recharts axes, always provide explicit `ticks` array to prevent duplicate keys:

```tsx
<XAxis
  type="number"
  scale="log"
  ticks={[0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]}
  // ...
/>
```

## Dark Mode Activation

Dark mode is toggled by adding/removing `dark` class on `<html>` element via `ThemeContext`. The theme is persisted in `localStorage` with key `theme` (values: `"light"`, `"dark"`, `"system"`).

## Summary

When writing UI code in this project:
1. Use `bg-bgSecondary` instead of `bg-white` or `dark:bg-slate-900`
2. Use `text-textPrimary` instead of `text-kolia-ink` or `dark:text-slate-100`
3. Use `border-borderColor` instead of `border-kolia-line` or `dark:border-slate-800`
4. All badges need `dark:bg-*-900/30` and `dark:text-*-400`
5. Icon containers need `dark:bg-*-900/40` or `dark:bg-emerald-900/40`
