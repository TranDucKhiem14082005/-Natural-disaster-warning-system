import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 127.0.0.1 rather than localhost: artisan serve / Reverb bind IPv4 only, while Node may resolve localhost to ::1.
  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
  const reverb = env.VITE_REVERB_URL || 'http://127.0.0.1:8080';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Same-origin calls in dev: no CORS setup needed on the Laravel side, mirrors Infra nginx.
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/storage': { target: backend, changeOrigin: true },
        '/app': { target: reverb, ws: true, changeOrigin: true },
      },
    },
  };
});
