import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const api = "http://localhost:8000";

export default defineConfig({
  base: "/ui/",
  plugins: [react()],
  server: {
    proxy: {
      "/stream": { target: "ws://localhost:8000", ws: true },
      "^/(?!ui(?:/|$))": api,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
