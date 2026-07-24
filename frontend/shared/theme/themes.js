export const THEME_CATALOG = [
  {
    id: "dark",
    label: "深色",
    desc: "默认深色主题",
    swatch: ["#0d1117", "#58a6ff"],
    dark: true,
  },
  {
    id: "light",
    label: "浅色",
    desc: "明亮主题",
    swatch: ["#ffffff", "#0969da"],
    dark: false,
  },
];

export function resolveThemeId(id) {
  return THEME_CATALOG.some((t) => t.id === id) ? id : THEME_CATALOG[0].id;
}
