import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";

i18n
  .use(LanguageDetector)   // auto-detect browser language
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, fr: { translation: fr }, pt: { translation: pt } },
    fallbackLng: "en",
    supportedLngs: ["en", "es", "fr", "pt"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "focusmind_lang",
    },
  });

export default i18n;

// Supported languages metadata (used by LanguageSelector component)
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English",    flag: "🇺🇸" },
  { code: "es", label: "Español",    flag: "🇪🇸" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
  { code: "pt", label: "Português",  flag: "🇧🇷" },
];
