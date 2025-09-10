import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react(), cloudflare()],
    define: {
      'import.meta.env.VITE_CF_TURNSTILE_SITE_KEY': JSON.stringify(env.VITE_CF_TURNSTILE_SITE_KEY),
      'import.meta.env.VITE_CF_TURNSTILE_SECRET_KEY': JSON.stringify(env.VITE_CF_TURNSTILE_SECRET_KEY),
      'import.meta.env.VITE_JWT_SECRET_KEY': JSON.stringify(env.VITE_JWT_SECRET_KEY),
    },
  };
});
