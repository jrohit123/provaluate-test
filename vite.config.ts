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
    base: mode === 'testing' ? '/provaluate-test/' : '/',
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