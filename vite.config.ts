import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  return {
    base: '/',
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "ebml": "ebml/lib/ebml.js",
      },
    },
    esbuild: {
      drop: (mode === 'production' || mode === 'testing') ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      minify: false,
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      rollupOptions: {
        maxParallelFileOps: 1,
      },
    },
  };
});