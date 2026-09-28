import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { PORT } = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '');

  // The UI calls /api/..., which is forwarded to the backend root
  const apiProxy = {
    '/api': {
      target: `http://localhost:${PORT || 4000}`,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy: apiProxy },
    preview: { port: 4173, proxy: apiProxy },
  };
});
