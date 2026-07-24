import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import {
  THEME_CATALOG,
  resolveThemeId,
} from "../styles/themes.js";
import { applyTheme } from "../styles/applyTheme.js";
import {
  readStoredThemeId,
  writeStoredThemeId,
  THEME_STORAGE_KEY,
} from "@cf-shared/theme/storage.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(readStoredThemeId);

  const setThemeId = useCallback((id) => {
    const next = writeStoredThemeId(id);
    setThemeIdState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        setThemeIdState(resolveThemeId(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      themeOptions: THEME_CATALOG,
      isDark: THEME_CATALOG.find((t) => t.id === themeId)?.dark ?? true,
    }),
    [themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
