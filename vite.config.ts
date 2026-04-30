import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
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
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    esbuild: {
      // Drop console and debugger in production builds
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'three-ecosystem': ['three', '@react-three/fiber', '@react-three/drei'],
            'pdf-libs': ['pdfjs-dist', 'react-pdf', '@react-pdf/renderer'],
            'xlsx-libs': ['xlsx', 'xlsx-js-style', 'exceljs'],
            'pdf-gen': ['jspdf', 'jspdf-autotable'],
          },
        },
      },
    },
  };
});
