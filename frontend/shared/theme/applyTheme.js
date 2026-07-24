import { resolveThemeId, THEME_CATALOG } from "./themes.js";
import { readStoredThemeId, THEME_STORAGE_KEY } from "./storage.js";

export function applyTheme(themeId) {
  const id = resolveThemeId(themeId);
  const theme = THEME_CATALOG.find((t) => t.id === id);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(
      "data-theme-mode",
      theme?.dark ? "dark" : "light",
    );
  }
}

export function applyThemeFromStorage() {
  applyTheme(readStoredThemeId());
}

export { THEME_STORAGE_KEY };
