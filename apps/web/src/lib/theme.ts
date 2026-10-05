// Each visitor's light/dark choice lives in a cookie, so the server can render the right
// theme straight away (no flash). No cookie = follow the device setting.
export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}
