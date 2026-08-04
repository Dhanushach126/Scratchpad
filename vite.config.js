import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
});
