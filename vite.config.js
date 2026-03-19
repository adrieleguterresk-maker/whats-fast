import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Porta padrão do vercel dev
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
});
