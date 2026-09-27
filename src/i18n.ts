import i18n from "i18next";
import { initReactI18next } from "react-i18next";
i18n.use(initReactI18next).init({
  lng: localStorage.getItem("snes-graph-language") === "fr" ? "fr" : "en",
  fallbackLng: "en",
  resources: { fr: { translation: {} }, en: { translation: {} } },
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});
document.documentElement.lang = i18n.language;
export const tr = (fr: string, en: string) =>
  i18n.t(fr, { defaultValue: i18n.language.startsWith("fr") ? fr : en });
export default i18n;
