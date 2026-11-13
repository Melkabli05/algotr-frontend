import { useEffect } from "react";
import { useEnv } from "./env";

export function EnvTint() {
  const env = useEnv();
  useEffect(() => {
    document.body.classList.toggle("env-live-page", env === "live");
  }, [env]);
  return null;
}
