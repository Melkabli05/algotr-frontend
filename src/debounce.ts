import { useEffect, useState } from "react";

const DELAY_MS = 400;

/** The value as it was once it stopped changing for a moment, for checks the server runs. */
export function useDebounced<T>(value: T, delay = DELAY_MS): T {
  const key = JSON.stringify(value);
  const [found, setFound] = useState(key);
  useEffect(() => {
    const timer = setTimeout(() => setFound(key), delay);
    return () => clearTimeout(timer);
  }, [key, delay]);
  return JSON.parse(found) as T;
}
