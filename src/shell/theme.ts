import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "algotr-theme";

function saved(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(saved);
  useEffect(() => {
    document.body.classList.toggle("bp6-dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      return;
    }
  }, [theme]);
  return [theme, () => setTheme((current) => (current === "dark" ? "light" : "dark"))];
}

export const ThemeContext = createContext<Theme>("dark");

export function useDark(): boolean {
  return useContext(ThemeContext) === "dark";
}
