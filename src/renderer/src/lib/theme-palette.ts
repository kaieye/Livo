/**
 * Full desktop theme palette adapted to the existing Apple-style color scheme.
 *
 * This is the single source of truth for non-accent design tokens. Values are
 * mirrored statically in `styles/tokens.css` so the very first paint has no
 * flash, and applied at runtime by `lib/appearance.ts` so theme switches are
 * driven entirely by this palette.
 *
 * Token format:
 * - `*` surface/text/sidebar/border/elevated tokens are stored as
 *   space-separated RGB triplets (e.g. "255 255 255") so Tailwind can apply
 *   alpha via `rgb(var(--token) / <alpha-value>)`.
 * - `accentText` / `tabBarInactive` / `dragHandle` are ready-to-use CSS color
 *   strings (they are never used with Tailwind alpha modifiers).
 */
export interface ThemePalette {
  isDark: boolean
  /** App background / base surface (RGB triplet). */
  surface: string
  /** Secondary surface — cards, inputs, code blocks (RGB triplet). */
  surfaceSecondary: string
  /** Tertiary surface — nested/hover surfaces (RGB triplet). */
  surfaceTertiary: string
  /** Elevated surface — popovers, floating panels (RGB triplet). */
  elevated: string
  /** Primary text (RGB triplet). */
  text: string
  /** Secondary text (RGB triplet). */
  textSecondary: string
  /** Muted / tertiary text (RGB triplet). */
  textTertiary: string
  /** Navigation surface — sidebar / tab bar (RGB triplet). */
  sidebar: string
  /** Sidebar hover surface (RGB triplet). */
  sidebarHover: string
  /** Dividers / borders (RGB triplet). */
  border: string
  /** Text/icon color rendered on top of the accent color. */
  accentText: string
  /** Inactive tab/nav item color. */
  tabBarInactive: string
  /** Drag handle / resize affordance color. */
  dragHandle: string
}

export const LIGHT_PALETTE: ThemePalette = {
  isDark: false,
  surface: '255 255 255',
  surfaceSecondary: '245 245 247',
  surfaceTertiary: '232 232 237',
  elevated: '250 250 252',
  text: '29 29 31',
  textSecondary: '110 110 115',
  textTertiary: '174 174 178',
  sidebar: '245 245 247',
  sidebarHover: '232 232 237',
  border: '210 210 215',
  accentText: '#ffffff',
  tabBarInactive: 'rgb(110 110 115)',
  dragHandle: 'rgba(15, 23, 42, 0.18)',
}

export const DARK_PALETTE: ThemePalette = {
  isDark: true,
  surface: '28 28 30',
  surfaceSecondary: '44 44 46',
  surfaceTertiary: '58 58 60',
  elevated: '62 62 66',
  text: '245 245 247',
  textSecondary: '161 161 166',
  textTertiary: '110 110 115',
  sidebar: '28 28 30',
  sidebarHover: '44 44 46',
  border: '56 56 58',
  accentText: '#ffffff',
  tabBarInactive: 'rgb(161 161 166)',
  dragHandle: 'rgba(255, 255, 255, 0.22)',
}

export function getPalette(isDark: boolean): ThemePalette {
  return isDark ? DARK_PALETTE : LIGHT_PALETTE
}

/**
 * Maps a {@link ThemePalette} to its CSS custom-property name/value pairs.
 * Keep this in sync with `styles/tokens.css`.
 *
 * Two naming schemes are emitted so both consumers work:
 * - Tailwind triplet tokens (`--color-surface`, `--color-text`, …) consumed via
 *   `rgb(var(--token) / <alpha-value>)` in `tailwind.config.ts`.
 * - Semantic color tokens (`--color-bg-primary`,
 *   `--color-text-primary`, `--color-border-secondary`, …) consumed directly as
 *   full colors in arbitrary classes like `bg-[var(--color-bg-primary)]` by the
 *   desktop pages.
 *
 * `--color-text-secondary` / `--color-text-tertiary` are emitted as full colors
 * for direct use; their Tailwind triplet counterparts use the `-rgb` suffix.
 */
export function paletteToCssVariables(
  palette: ThemePalette,
): Record<string, string> {
  const rgb = (triplet: string) => `rgb(${triplet})`
  return {
    // Tailwind triplet tokens (alpha-aware).
    '--color-surface': palette.surface,
    '--color-surface-secondary': palette.surfaceSecondary,
    '--color-surface-tertiary': palette.surfaceTertiary,
    '--color-elevated': palette.elevated,
    '--color-text': palette.text,
    '--color-text-secondary-rgb': palette.textSecondary,
    '--color-text-tertiary-rgb': palette.textTertiary,
    '--color-sidebar': palette.sidebar,
    '--color-sidebar-hover': palette.sidebarHover,
    '--color-border': palette.border,
    '--color-divider': palette.border,
    '--color-accent-text': palette.accentText,
    '--color-tabbar-inactive': palette.tabBarInactive,
    '--color-drag-handle': palette.dragHandle,

    // Semantic color tokens (direct use, full colors).
    '--color-bg-primary': rgb(palette.surface),
    '--color-bg-secondary': rgb(palette.surfaceSecondary),
    '--color-bg-tertiary': rgb(palette.surfaceTertiary),
    '--color-text-primary': rgb(palette.text),
    '--color-text-secondary': rgb(palette.textSecondary),
    '--color-text-tertiary': rgb(palette.textTertiary),
    '--color-border-primary': rgb(palette.border),
    '--color-border-secondary': rgb(palette.border),
  }
}
