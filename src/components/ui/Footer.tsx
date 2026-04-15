import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-dark-border py-5 px-6 text-center mt-8">
      <div className="flex justify-center flex-wrap gap-4 font-body text-white/40 text-xs">
        <Link to="/datenschutz" className="hover:text-white/60 transition-colors">
          {t('landing.footer_privacy')}
        </Link>
        <Link to="/impressum" className="hover:text-white/60 transition-colors">
          {t('landing.footer_imprint')}
        </Link>
        <Link to="/agb" className="hover:text-white/60 transition-colors">
          {t('landing.footer_terms')}
        </Link>
        <a href="mailto:hallo@learnquest.app" className="hover:text-white/60 transition-colors">
          {t('landing.footer_contact')}
        </a>
      </div>
    </footer>
  )
}
