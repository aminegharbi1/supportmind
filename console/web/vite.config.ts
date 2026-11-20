import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le front ne parle qu'à l'API FastAPI ; le proxy évite toute config CORS en local.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
