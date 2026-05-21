import { useTheme } from '../../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { X, Monitor } from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'bi', label: 'Bislama' },
]

const colorPresets = [
  { id: 'navy', label: 'Navy', hex: '#004276' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'green', label: 'Emerald', hex: '#10b981' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'red', label: 'Rose', hex: '#f43f5e' },
]

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{label}</span>
      <div
        onClick={onChange}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer',
          checked ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-600'
        )}
      >
        <div className={clsx(
          'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 start-0.5',
          checked && 'translate-x-5 rtl:-translate-x-5'
        )} />
      </div>
    </label>
  )
}

function ModeCard({ active, dark, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer hover:shadow-card-md',
        active
          ? 'border-primary-500 shadow-glow'
          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
      )}
    >
      {/* Mini preview */}
      <div className={clsx(
        'w-full h-14 rounded-lg mb-2 overflow-hidden flex flex-col',
        dark ? 'bg-slate-900' : 'bg-slate-100'
      )}>
        {/* Mini header */}
        <div className={clsx('h-3 flex items-center px-1.5 gap-1', dark ? 'bg-slate-800' : 'bg-white')}>
          <div className={clsx('w-6 h-1.5 rounded', dark ? 'bg-primary-500' : 'bg-primary-500')} />
          <div className="flex-1" />
          <div className={clsx('w-1.5 h-1.5 rounded-full', dark ? 'bg-slate-600' : 'bg-slate-300')} />
          <div className={clsx('w-1.5 h-1.5 rounded-full', dark ? 'bg-slate-600' : 'bg-slate-300')} />
        </div>
        {/* Mini content */}
        <div className="flex flex-1 gap-1 p-1">
          <div className={clsx('w-5 rounded', dark ? 'bg-slate-800' : 'bg-white')} />
          <div className="flex-1 space-y-1">
            <div className={clsx('h-2 rounded w-full', dark ? 'bg-slate-700' : 'bg-slate-200')} />
            <div className={clsx('h-2 rounded w-3/4', dark ? 'bg-slate-700' : 'bg-slate-200')} />
            <div className={clsx('h-2 rounded w-1/2', dark ? 'bg-slate-700' : 'bg-slate-200')} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dark ? 'Dark' : 'Light'}</span>
        {active && (
          <div className="w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}
      </div>
    </button>
  )
}

export default function SettingsPanel() {
  const {
    isDark, toggleDark,
    isRTL, toggleRTL,
    colorPreset, setColorPreset,
    settingsPanelOpen, closeSettingsPanel
  } = useTheme()
  const { t, i18n } = useTranslation()

  if (!settingsPanelOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="settings-overlay"
        onClick={closeSettingsPanel}
      />

      {/* Panel */}
      <div className="fixed top-0 end-0 h-full w-80 bg-white dark:bg-slate-800 border-s border-slate-200 dark:border-slate-700 z-50 flex flex-col animate-slide-in-right rtl:animate-slide-in-left shadow-card-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Theme Settings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize your dashboard appearance</p>
          </div>
          <button
            onClick={closeSettingsPanel}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Color Mode */}
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Color Mode</h4>
            <div className="flex gap-3">
              <ModeCard active={!isDark} dark={false} onClick={() => isDark && toggleDark()} />
              <ModeCard active={isDark} dark={true} onClick={() => !isDark && toggleDark()} />
            </div>
          </div>

          {/* Color Presets */}
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Color Preset</h4>
            <div className="grid grid-cols-5 gap-2">
              {colorPresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setColorPreset(preset.id)}
                  title={preset.label}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150',
                    colorPreset === preset.id
                      ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                  style={colorPreset === preset.id ? { '--tw-ring-color': preset.hex } : {}}
                >
                  <div
                    className="w-8 h-8 rounded-full shadow-sm"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Layout</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Navigation uses a top menu bar below the header. On smaller screens, use the menu icon to open the full navigation drawer.
            </p>
          </div>

          {/* Regional / Language */}
          <div className="px-5 py-5 space-y-4 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('settings.regional')}
            </h4>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('settings.language')}</p>
              <div className="flex gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      i18n.resolvedLanguage === lang.code
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              checked={isRTL}
              onChange={toggleRTL}
              label={t('settings.rtl')}
            />
          </div>

          {/* Preview info */}
          <div className="px-5 pb-5">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/30">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shrink-0">
                  <Monitor size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live Preview</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    All changes apply instantly across the entire dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={closeSettingsPanel}
            className="w-full btn-gradient py-2.5 text-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </>
  )
}
