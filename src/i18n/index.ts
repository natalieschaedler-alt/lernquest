import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'

const savedLang = (typeof localStorage !== 'undefined' ? localStorage.getItem('lq_lang') : null) ?? 'de'
const validLang = savedLang === 'en' ? 'en' : 'de'

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: validLang,
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
})

export default i18n
