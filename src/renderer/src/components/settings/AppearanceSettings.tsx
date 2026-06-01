import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import { Pipette } from 'lucide-react'
import { ACCENT_COLOR_MAP } from '../../lib/appearance'

const ACCENT_COLORS = Object.entries(ACCENT_COLOR_MAP).map(
  ([name, palette]) => ({
    name,
    color: palette.color,
    labelKey: `settings.accentColor_${name}`,
  }),
)

const fontFamilyOptions = [
  { value: 'inherit', labelKey: 'settings.fontFamily_system' },
  {
    value: '"Noto Sans SC", sans-serif',
    labelKey: 'settings.fontFamily_notoSans',
  },
  {
    value: '"Noto Serif SC", serif',
    labelKey: 'settings.fontFamily_notoSerif',
  },
  {
    value: '"Microsoft YaHei", sans-serif',
    labelKey: 'settings.fontFamily_msYahei',
  },
  { value: '"SimSun", serif', labelKey: 'settings.fontFamily_simsun' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
]

const contentWidthOptions = [
  {
    key: 'narrow' as const,
    labelKey: 'settings.contentWidth_narrow',
    descKey: 'settings.contentWidthDesc_narrow',
    px: 500,
  },
  {
    key: 'normal' as const,
    labelKey: 'settings.contentWidth_normal',
    descKey: 'settings.contentWidthDesc_normal',
    px: 680,
  },
  {
    key: 'wide' as const,
    labelKey: 'settings.contentWidth_wide',
    descKey: 'settings.contentWidthDesc_wide',
    px: 900,
  },
  {
    key: 'custom' as const,
    labelKey: 'settings.contentWidth_custom',
    descKey: 'settings.contentWidthDesc_custom',
  },
]

const previewText =
  'Livo — The quick brown fox jumps over the lazy dog. 1234567890'

export function AppearanceSettings() {
  const general = useSettingSection('general')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()

  const isCustomAccent = !(general.accentColor in ACCENT_COLOR_MAP)
  const customAccentValue = /^#[0-9a-f]{6}$/i.test(general.accentColor)
    ? general.accentColor
    : '#ff5c00'

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t('settings.theme')}
        </label>
        <div className="flex gap-2">
          {(
            [
              { key: 'system', label: t('settings.theme_system') },
              { key: 'light', label: t('settings.theme_light') },
              { key: 'dark', label: t('settings.theme_dark') },
            ] as const
          ).map((theme) => (
            <button
              key={theme.key}
              onClick={() => {
                void updateSettingsSection('general', { theme: theme.key })
              }}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                general.theme === theme.key
                  ? 'border-accent bg-accent/5 font-medium text-accent'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t('settings.accentColor')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_COLORS.map((ac) => (
            <button
              key={ac.name}
              onClick={() =>
                void updateSettingsSection('general', { accentColor: ac.name })
              }
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                general.accentColor === ac.name
                  ? 'scale-110 border-text ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-dark'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{
                backgroundColor: ac.color,
                borderColor:
                  general.accentColor === ac.name ? ac.color : 'transparent',
              }}
              title={t(ac.labelKey)}
            />
          ))}

          {/* Custom hex color */}
          <label
            className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-all ${
              isCustomAccent
                ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-dark'
                : 'border-transparent hover:scale-105'
            }`}
            style={{
              background: isCustomAccent
                ? customAccentValue
                : 'conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)',
              borderColor: isCustomAccent ? customAccentValue : 'transparent',
            }}
            title={t('settings.accentColor_custom')}
          >
            <Pipette
              size={14}
              className={isCustomAccent ? 'text-white/90' : 'text-white'}
            />
            <input
              type="color"
              value={customAccentValue}
              onChange={(e) =>
                void updateSettingsSection('general', {
                  accentColor: e.target.value,
                })
              }
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {isCustomAccent && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.accentColor_custom')}
            </span>
            <input
              type="text"
              value={customAccentValue}
              onChange={(e) => {
                const value = e.target.value.trim()
                if (/^#[0-9a-f]{6}$/i.test(value)) {
                  void updateSettingsSection('general', { accentColor: value })
                }
              }}
              spellCheck={false}
              className="w-28 rounded-lg border bg-surface-secondary px-2.5 py-1.5 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
            />
          </div>
        )}
      </div>

      {/* Font size */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.fontSize')}: {general.fontSize}px
        </label>
        <input
          type="range"
          min={12}
          max={24}
          value={general.fontSize}
          onChange={(e) =>
            void updateSettingsSection('general', {
              fontSize: Number(e.target.value),
            })
          }
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-xs text-text-tertiary">
          <span>12px</span>
          <span>24px</span>
        </div>
      </div>

      {/* UI Font Family */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.uiFontFamily')}
        </label>
        <select
          value={general.uiFontFamily}
          onChange={(e) =>
            void updateSettingsSection('general', {
              uiFontFamily: e.target.value,
            })
          }
          className="w-full rounded-lg border bg-surface-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
        >
          {fontFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label ? option.label : t(option.labelKey!)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.uiFontFamilyDesc')}
        </p>
      </div>

      {/* Content Font Family */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.contentFontFamily')}
        </label>
        <select
          value={general.contentFontFamily}
          onChange={(e) =>
            void updateSettingsSection('general', {
              contentFontFamily: e.target.value,
            })
          }
          className="w-full rounded-lg border bg-surface-secondary px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
          style={{ fontFamily: general.contentFontFamily }}
        >
          {fontFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label ? option.label : t(option.labelKey!)}
            </option>
          ))}
        </select>
        <div
          className="mt-2 rounded-lg bg-surface-secondary p-3 text-sm dark:bg-surface-dark-tertiary"
          style={{
            fontFamily: general.contentFontFamily,
            fontSize: `${general.fontSize}px`,
            lineHeight: general.contentLineHeight,
          }}
        >
          {previewText}
        </div>
      </div>

      {/* Content Width */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {t('settings.contentWidth')}
        </label>
        <div className="flex flex-wrap gap-2">
          {contentWidthOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                void updateSettingsSection('general', {
                  contentWidth: option.key,
                })
              }}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                general.contentWidth === option.key
                  ? 'border-accent bg-accent/5 font-medium text-accent'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
              }`}
              title={t(option.descKey)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.contentWidthDesc')}
        </p>
      </div>

      {/* Custom Content Max Width Slider */}
      {general.contentWidth === 'custom' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.contentMaxWidth')}: {general.contentMaxWidth || 680}px
          </label>
          <input
            type="range"
            min={400}
            max={1400}
            step={10}
            value={general.contentMaxWidth || 680}
            onChange={(e) =>
              void updateSettingsSection('general', {
                contentMaxWidth: Number(e.target.value),
              })
            }
            className="w-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-xs text-text-tertiary">
            <span>400px ({t('settings.contentMaxWidth_narrow')})</span>
            <span>1400px ({t('settings.contentMaxWidth_wide')})</span>
          </div>
          <div className="relative mt-3 h-4 overflow-hidden rounded bg-surface-secondary dark:bg-surface-dark-tertiary">
            <div
              className="h-full rounded bg-accent/30 transition-all duration-200"
              style={{
                width: `${((general.contentMaxWidth || 680) / 1400) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Content Line Height */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.contentLineHeight')}: {general.contentLineHeight}
        </label>
        <input
          type="range"
          min={1.0}
          max={2.5}
          step={0.05}
          value={general.contentLineHeight}
          onChange={(e) =>
            void updateSettingsSection('general', {
              contentLineHeight: Number(e.target.value),
            })
          }
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-xs text-text-tertiary">
          <span>1.0 ({t('settings.lineHeight_compact')})</span>
          <span>2.5 ({t('settings.lineHeight_loose')})</span>
        </div>
        <div
          className="mt-3 rounded-lg bg-surface-secondary p-3 text-sm dark:bg-surface-dark-tertiary"
          style={{ lineHeight: general.contentLineHeight }}
        >
          Livo is an elegant RSS reader with multiple view modes. The quick
          brown fox jumps over the lazy dog. 1234567890
        </div>
      </div>

      {/* Reduce motion */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.reduceMotion')}
          </label>
          <p className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
            {t('settings.reduceMotionDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.reduceMotion}
          onChange={(v) =>
            void updateSettingsSection('general', { reduceMotion: v })
          }
        />
      </div>

      {/* Opaque sidebar */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t('settings.opaqueSidebar')}
          </label>
          <p className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
            {t('settings.opaqueSidebarDesc')}
          </p>
        </div>
        <ToggleSwitch
          checked={general.opaqueSidebar}
          onChange={(v) =>
            void updateSettingsSection('general', { opaqueSidebar: v })
          }
        />
      </div>

      {/* Custom CSS */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('settings.customCSS')}
        </label>
        <p className="mb-2 text-xs text-text-secondary dark:text-text-dark-secondary">
          {t('settings.customCSSDesc')}
        </p>
        <textarea
          value={general.customCSS || ''}
          onChange={(e) =>
            void updateSettingsSection('general', { customCSS: e.target.value })
          }
          placeholder={`${t('settings.customCSSPlaceholder')}\n.entry-content {\n  /* your styles */\n}`}
          className="w-full resize-y rounded-lg border bg-surface-secondary px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 dark:bg-surface-dark-tertiary"
          rows={5}
        />
      </div>
    </div>
  )
}

/** Reusable Toggle Switch component */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
