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
        maxParallelFileOps: 2,
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
              if (id.includes('@react-pdf')) return 'vendor-react-pdf';
              if (id.includes('jspdf')) return 'vendor-jspdf';
              if (id.includes('exceljs')) return 'vendor-exceljs';
              if (id.includes('xlsx')) return 'vendor-xlsx';
              if (id.includes('@radix-ui')) return 'vendor-radix';
              if (id.includes('socket.io') || id.includes('recordrtc')) return 'vendor-realtime';
              if (id.includes('recharts')) return 'vendor-charts';
              if (id.includes('@tiptap')) return 'vendor-tiptap';
              if (id.includes('gsap')) return 'vendor-gsap';
              if (id.includes('react-joyride')) return 'vendor-joyride';
              if (id.includes('react-hot-toast')) return 'vendor-toast';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
