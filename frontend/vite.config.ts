import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Get API URL for proxy - fallback to localhost for development
  const apiUrl = env.VITE_API_BASE_URL || env.VITE_DEV_API_URL || 'http://127.0.0.1:8000';
  
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    server: {
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          secure: apiUrl.startsWith('https'),
        },
      },
    },
    // Make environment variables available to the app
    define: {
      __API_URL__: JSON.stringify(apiUrl),
    },
  };
});
