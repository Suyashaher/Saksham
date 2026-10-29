import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

export interface SupportedLanguage {
  code: string;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
];

const savedLanguage = typeof window !== 'undefined'
  ? localStorage.getItem('saksham_language') || 'en'
  : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
    ta: { translation: ta },
    te: { translation: te },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

// Sync document lang attribute and localStorage on language changes
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('saksham_language', lng);
    document.documentElement.lang = lng;
  }
});

// Set initial document lang attribute
if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLanguage;
}

export default i18n;
