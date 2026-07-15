import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000';

// Web version - configured for production deployment
export default defineConfig({
  plugins: [
    preact({
      // Disable Preact's built-in HMR — it causes duplicate DOM renders
      // by re-mounting components without properly cleaning up the old tree.
      // Full page reloads are used instead (fast with Preact's 3KB bundle).
      prefreshEnabled: false,
    }),
  ],
  css: {
    // Disable PostCSS — we use vanilla CSS and the workspace path has spaces
    // which breaks PostCSS config resolution
    postcss: {},
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/preact') || id.includes('node_modules/zustand')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 100,
  },
  optimizeDeps: {
    include: ['preact', 'zustand'],
  },
});
