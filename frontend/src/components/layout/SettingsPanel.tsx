import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/ThemeContext'

function SettingsPanelComponent() {
  const { isDark, toggleDark, settingsPanelOpen, closeSettingsPanel } = useTheme()
  const { t, i18n } = useTranslation()

  if (!settingsPanelOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closeSettingsPanel}
        aria-hidden
      />
      <aside
        className="fixed top-0 end-0 h-full w-full max-w-sm bg-raised border-s border-registry z-50 flex flex-col animate-registry-in"
        role="dialog"
        aria-label={t('settings.title')}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-registry">
          <h2 className="font-serif text-lg font-semibold">{t('settings.title')}</h2>
          <button type="button" onClick={closeSettingsPanel} className="btn-ghost btn-sm">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <section>
            <p className="label-overline mb-3">{t('settings.color_mode')}</p>
            <button type="button" onClick={toggleDark} className="btn-secondary w-full justify-between">
              <span>{isDark ? t('settings.dark') : t('settings.light')}</span>
              <span className="text-muted text-xs">{isDark ? 'On' : 'Off'}</span>
            </button>
          </section>

          <section>
            <p className="label-overline mb-3">{t('settings.language')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['en', 'fr', 'bi'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => i18n.changeLanguage(code)}
                  className={`btn-sm py-2 border ${
                    i18n.language === code
                      ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)] font-medium'
                      : 'border-registry btn-secondary'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

export const SettingsPanel = memo(SettingsPanelComponent)
