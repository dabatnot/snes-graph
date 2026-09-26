import i18n from "i18next";
import { initReactI18next } from "react-i18next";
i18n.use(initReactI18next).init({
  lng:
    localStorage.getItem("snes-graph-language") ??
    (navigator.language.startsWith("fr") ? "fr" : "en"),
  fallbackLng: "fr",
  resources: { fr: { translation: {} }, en: { translation: {} } },
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});
export const tr = (fr: string, en: string) =>
  i18n.t(fr, { defaultValue: i18n.language.startsWith("fr") ? fr : en });
export default i18n;
