import { useTranslation } from 'react-i18next'

interface LanguageToggleProps {
  className?: string
}

export default function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { i18n, t } = useTranslation()
  const isDE = i18n.language === 'de'

  const toggle = () => {
    const next = isDE ? 'en' : 'de'
    void i18n.changeLanguage(next)
    localStorage.setItem('lq_lang', next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDE ? t('lang.switch_to_en') : t('lang.switch_to_de')}
      className={`font-body text-sm font-semibold cursor-pointer border border-dark-border bg-dark-card rounded-lg px-3 py-1.5 text-white hover:border-primary transition-colors ${className}`}
    >
      🌐 {isDE ? t('lang.en') : t('lang.de')}
    </button>
  )
}
