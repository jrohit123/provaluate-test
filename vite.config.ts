import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const deepgramKey = env.VITE_DEEPGRAM_API_KEY;
  if (!deepgramKey || deepgramKey.trim().length < 32) {
    console.warn(
      "⚠️ VITE_DEEPGRAM_API_KEY is missing or invalid in .env / .env.local — Deepgram (Chrome) transcription will not work."
    );
  } else {
    console.log("✅ VITE_DEEPGRAM_API_KEY is set — Deepgram transcription enabled for Chrome.");
  }

  return {
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
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three') || id.includes('@react-three')) return 'vendor-3d';
              if (id.includes('pdfjs-dist') || id.includes('jspdf')) return 'vendor-pdf';
              if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-excel';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
