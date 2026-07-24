export const THEME_STORAGE_KEY = "hw-campus-skills-theme";

export function readStoredThemeId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(THEME_STORAGE_KEY);
}

export function writeStoredThemeId(id) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  }
  return id;
}
