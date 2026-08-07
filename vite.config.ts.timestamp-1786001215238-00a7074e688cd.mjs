// vite.config.ts
import { defineConfig } from "file:///D:/COMPLETE%20SYSTEM/React/node_modules/vite/dist/node/index.js";
import react from "file:///D:/COMPLETE%20SYSTEM/React/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///D:/COMPLETE%20SYSTEM/React/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "D:\\COMPLETE SYSTEM\\React";
var vite_config_default = defineConfig(({ mode }) => {
  return {
    base: "/",
    server: {
      host: "::",
      port: 8080
    },
    plugins: [
      react(),
      mode === "development" && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src"),
        "ebml": "ebml/lib/ebml.js"
      }
    },
    esbuild: {
      drop: mode === "production" || mode === "testing" ? ["console", "debugger"] : [],
      legalComments: "none"
    },
    build: {
      target: "esnext",
      sourcemap: false,
      minify: false,
      chunkSizeWarningLimit: 1e3,
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      rollupOptions: {
        maxParallelFileOps: 1
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxDT01QTEVURSBTWVNURU1cXFxcUmVhY3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXENPTVBMRVRFIFNZU1RFTVxcXFxSZWFjdFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovQ09NUExFVEUlMjBTWVNURU0vUmVhY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICByZXR1cm4ge1xyXG4gICAgYmFzZTogJy8nLFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IFwiOjpcIixcclxuICAgICAgcG9ydDogODA4MCxcclxuICAgIH0sXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHJlYWN0KCksXHJcbiAgICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiYgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICBdLmZpbHRlcihCb29sZWFuKSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgICBcImVibWxcIjogXCJlYm1sL2xpYi9lYm1sLmpzXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgZXNidWlsZDoge1xyXG4gICAgICBkcm9wOiAobW9kZSA9PT0gJ3Byb2R1Y3Rpb24nIHx8IG1vZGUgPT09ICd0ZXN0aW5nJykgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFtdLFxyXG4gICAgICBsZWdhbENvbW1lbnRzOiAnbm9uZScsXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgICAgbWluaWZ5OiBmYWxzZSxcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgICBhc3NldHNJbmxpbmVMaW1pdDogNDA5NixcclxuICAgICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxyXG4gICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgbWF4UGFyYWxsZWxGaWxlT3BzOiAxLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9O1xyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQWtRLFNBQVMsb0JBQW9CO0FBQy9SLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1I7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLFNBQVMsaUJBQWlCLGdCQUFnQjtBQUFBLElBQzVDLEVBQUUsT0FBTyxPQUFPO0FBQUEsSUFDaEIsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLFFBQ3BDLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsTUFBTyxTQUFTLGdCQUFnQixTQUFTLFlBQWEsQ0FBQyxXQUFXLFVBQVUsSUFBSSxDQUFDO0FBQUEsTUFDakYsZUFBZTtBQUFBLElBQ2pCO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsTUFDWCxRQUFRO0FBQUEsTUFDUix1QkFBdUI7QUFBQSxNQUN2QixtQkFBbUI7QUFBQSxNQUNuQixjQUFjO0FBQUEsTUFDZCxlQUFlO0FBQUEsUUFDYixvQkFBb0I7QUFBQSxNQUN0QjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
